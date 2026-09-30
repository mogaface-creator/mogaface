/**
 * The trusted analysis-session store: the ONE place a client-submitted
 * analysis becomes a server-owned record, and the ONE place a later request
 * may read one back. This is the boundary lib/image-generation/handler.ts's
 * own TRUST NOTE describes as missing ("the server has no analysis of its
 * own... Verifying the evidence itself needs server-side persisted
 * analysis, which does not exist yet").
 *
 * What this DOES guarantee: `opportunities` and any illustration-eligibility
 * decision are computed here, once, server-side, via the real, unmodified
 * evaluateTreatmentOpportunities / buildVisualizationPlan /
 * decideIllustrationEligibility — never accepted as a pre-built object from
 * a client, on this call or any later one that references this record.
 *
 * What this does NOT guarantee: that the raw `analysis.observations` values
 * were genuinely measured from a real photo/video. MogaFace's face-landmark
 * engine (@mediapipe/tasks-vision, GPU-delegate WASM) is a browser-only
 * package — it explicitly guards `typeof window === "undefined"` (see
 * lib/facial-analysis/faceLandmarker.ts) and has no supported Node.js
 * runtime path, and ARCHITECTURE.md documents this as a deliberate choice
 * ("the whole pipeline runs in the user's browser... there is nothing here
 * that needs a server to compute"). Re-deriving raw measurements server-side
 * would mean replacing the analysis engine itself, which is out of scope
 * here (reuse the existing engine; do not rewrite the measurement
 * algorithms). This module closes the specific, PROVEN exploit — a client
 * submitting a pre-built TreatmentOpportunity / consumerReady claim directly
 * — not the separate, harder problem of independently verifying pixels.
 *
 * Storage: Supabase Postgres (see supabaseClient.ts and
 * supabase/migrations/20260929000000_create_analysis_sessions.sql), the
 * REAL shared backend a real Vercel deployment needs — POST
 * /api/analysis-session and POST /api/generate-illustration are two
 * separate route.ts files, deployed as separate serverless functions with
 * independent process memory on Vercel's default setup (no vercel.json /
 * function-bundling override exists in this repo), so nothing kept only in
 * one function's memory can be trusted to still be there on the next
 * request. When NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not
 * set (e.g. local development without a Supabase project configured), this
 * module falls back to an in-memory Map — enough to develop and test
 * against, but explicitly NOT the production path; see
 * isSupabaseConfigured() below and the "IMPORTANT" note in this repo's
 * .env.example. A console warning is logged once per process when this
 * fallback is used, so it is never silently mistaken for the real thing.
 *
 * PRODUCTION REQUIRES SHARED PERSISTENT ANALYSIS-SESSION STORAGE. THE
 * IN-MEMORY FALLBACK IS DEVELOPMENT-ONLY. When `env.NODE_ENV === "production"`
 * and Supabase is not validly configured — or a configured Supabase call
 * itself fails — createAnalysisRecord/getAnalysisRecord throw
 * AnalysisPersistenceUnavailableError instead of silently using the
 * in-memory Map. This is deliberate: the in-memory Map is exactly the
 * cross-serverless-invocation bug this module exists to fix, so production
 * must never be able to fall into it, even transiently. Callers (see
 * handler.ts, lib/image-generation/trustedHandler.ts,
 * lib/image-generation/multiAngle.ts) catch this and return a generic,
 * non-leaking 503 — never a stack trace, never a Supabase error body, never
 * the service-role key.
 */

import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { sanitizeAssessment } from "../assessment/schema.ts";
import { isValidObservation } from "../observation/validate.ts";
import type { MogaFaceAnalysis } from "../observation/types.ts";
import { FACIAL_ANALYSIS_METHODOLOGY_VERSION } from "../observation/versions.ts";
import { evaluateTreatmentOpportunities } from "../treatment-opportunities/evaluate.ts";
import { TREATMENT_OPPORTUNITY_ENGINE_VERSION } from "../treatment-opportunities/versions.ts";
import { buildVisualizationPlan } from "../visualization/build.ts";
import { decideIllustrationEligibility } from "../visualization/eligibility.ts";
import { buildPredictionPlan } from "../visualization/predict.ts";
import type { AngleSlot } from "../image-generation/angles.ts";
import { isSupabaseConfigured, supabaseRequest } from "./supabaseClient.ts";
import type { SupabaseEnv } from "./supabaseClient.ts";
import { ANALYSIS_RECORD_VERSION } from "./types.ts";
import type { AnalysisRecord, AnalysisSessionHandle } from "./types.ts";

const TTL_MS = 60 * 60_000; // one hour — long enough for one assessment session, short enough to bound either store's growth

/**
 * Thrown by createAnalysisRecord/getAnalysisRecord instead of silently
 * falling back to the in-memory Map when `env.NODE_ENV === "production"` and
 * durable, shared persistence is not actually available (missing/invalid
 * Supabase config, or a configured Supabase call itself failing). Callers
 * MUST catch this and return a generic server error — never expose its
 * message (which is safe/generic itself, but treat it as internal) to the
 * browser, and never let it be interpreted as "record not found".
 */
export class AnalysisPersistenceUnavailableError extends Error {
  constructor() {
    super("Analysis-session persistence is unavailable: production requires a valid, shared Supabase configuration; the in-memory fallback is development-only.");
    this.name = "AnalysisPersistenceUnavailableError";
  }
}

const isProductionEnv = (env: SupabaseEnv): boolean => env.NODE_ENV === "production";

export interface AnalysisSessionStoreDeps {
  /** Defaults to process.env. Injectable so tests can exercise either the Supabase path or the fallback deterministically, without depending on the ambient shell environment. */
  env?: SupabaseEnv;
  fetchImpl?: typeof fetch;
}

interface StoredEntry {
  record: AnalysisRecord;
  tokenHash: Buffer;
}

// The fallback ONLY — never read or written when Supabase is configured. See the module comment.
const fallbackRecords = new Map<string, StoredEntry>();
let warnedAboutFallback = false;
function warnFallbackOnce() {
  if (warnedAboutFallback) return;
  warnedAboutFallback = true;
  console.warn("[analysis-session] Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY) — falling back to in-memory storage. This is fine for local development, but is NOT safe across separate serverless invocations in production. See lib/analysis-session/store.ts's module comment.");
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * The only structural check this module makes on a client-submitted
 * analysis: it must be an object with an `observations` array whose entries
 * are individually well-formed (see lib/observation/validate.ts). This does
 * NOT prove any observation was genuinely measured — see the module comment.
 */
function isPlausibleAnalysis(value: unknown): value is MogaFaceAnalysis {
  if (!isPlainObject(value)) return false;
  const observations = value.observations;
  if (!Array.isArray(observations)) return false;
  if (observations.length > 500) return false; // sanity bound, not a real limit on genuine analyses
  return observations.every((o) => isValidObservation(o));
}

const newToken = () => randomBytes(32).toString("base64url");
/** A real, one-way SHA-256 digest — this value is what actually gets persisted (to Supabase or the fallback Map), so, unlike a transient in-process value, it must never let the raw bearer token be recovered from a table read/backup/export. */
const hashToken = (token: string): Buffer => createHash("sha256").update(token, "utf8").digest();

function resolveDeps(deps: AnalysisSessionStoreDeps): { env: SupabaseEnv; fetchImpl: typeof fetch } {
  return { env: deps.env ?? (process.env as SupabaseEnv), fetchImpl: deps.fetchImpl ?? fetch };
}

interface SupabaseRow {
  analysis_id: string;
  session_token_hash: string;
  record: AnalysisRecord;
  created_at: string;
  expires_at: string;
}

/**
 * Creates a trusted analysis record from client-submitted input. `assessment`
 * is sanitized (structural validation, unrelated to the forgery this module
 * closes — questionnaire answers are legitimately user-reported). `analysis`
 * is structurally checked only (see isPlausibleAnalysis); `opportunities` are
 * NEVER read from the input — they are computed here, from `analysis`, via
 * the real engine. Returns null on malformed input. Throws
 * AnalysisPersistenceUnavailableError — never falls back to the in-memory
 * Map — when production persistence is unavailable (see the module comment).
 */
export async function createAnalysisRecord(
  input: { assessment: unknown; analysis: unknown; photoQualityValid?: unknown; hasLeftFortyFive?: unknown; hasRightFortyFive?: unknown },
  deps: AnalysisSessionStoreDeps = {},
): Promise<AnalysisSessionHandle | null> {
  const { env, fetchImpl } = resolveDeps(deps);
  const configured = isSupabaseConfigured(env);
  const production = isProductionEnv(env);
  if (!configured) {
    if (production) throw new AnalysisPersistenceUnavailableError();
    warnFallbackOnce();
  }

  const assessment = sanitizeAssessment(input.assessment);
  if (!assessment) return null;
  if (!isPlausibleAnalysis(input.analysis)) return null;
  const analysis = input.analysis;

  // "front" always: required for eligibility itself. Informational only — see AnalysisRecord's own doc comment.
  const availableAngles: AngleSlot[] = ["front", ...(input.hasLeftFortyFive === true ? (["leftFortyFive"] as const) : []), ...(input.hasRightFortyFive === true ? (["rightFortyFive"] as const) : [])];

  const opportunities = evaluateTreatmentOpportunities({ assessment, analysis });
  // qualityValid here only shapes the informational `illustrationEligible` preview below — it is
  // NOT a trust boundary; the real photo is independently validated server-side at generation time
  // (handler.ts's validateSourcePhoto, unchanged).
  const frontPhoto = { ref: "server-analysis-session", qualityValid: input.photoQualityValid === true };
  const plan = buildVisualizationPlan({ frontPhoto, opportunities });
  // No calibration/policy override — the real, unmodified, production decision, exactly as /api/generate-illustration itself computes it.
  const calibratedEligible = decideIllustrationEligibility(plan, opportunities).eligible;
  // The goal-driven prediction pathway (see predict.ts's module comment) — independent of
  // CALIBRATION_STATE, never a replacement for the calibrated pathway above.
  const predictionPlan = buildPredictionPlan({ assessment, analysis, frontPhoto });
  const eligible = calibratedEligible || predictionPlan.status === "planned";

  const id = randomUUID();
  const sessionToken = newToken();
  const tokenHash = hashToken(sessionToken);
  const now = Date.now();
  const expiresAt = new Date(now + TTL_MS).toISOString();
  const record: AnalysisRecord = {
    id,
    version: ANALYSIS_RECORD_VERSION,
    methodologyVersion: { analysis: FACIAL_ANALYSIS_METHODOLOGY_VERSION, treatmentOpportunities: TREATMENT_OPPORTUNITY_ENGINE_VERSION },
    assessment,
    analysis,
    opportunities,
    predictionPlan,
    createdAt: new Date(now).toISOString(),
    status: "active",
    availableAngles,
  };

  if (configured) {
    const res = await supabaseRequest(
      env,
      "/analysis_sessions",
      { method: "POST", headers: { prefer: "return=minimal" }, body: JSON.stringify({ analysis_id: id, session_token_hash: tokenHash.toString("hex"), record, expires_at: expiresAt }) },
      fetchImpl,
    ).catch(() => null);
    if (!res || !res.ok) {
      // A write failure must never silently fall back to the (unshared) in-memory map. In
      // production this is exactly "persistence unavailable" — fail closed, same as missing config.
      if (production) throw new AnalysisPersistenceUnavailableError();
      return null;
    }
  } else {
    fallbackRecords.set(id, { record, tokenHash });
  }

  return { analysisId: id, sessionToken, illustrationEligible: eligible, availableAngles, expiresAt };
}

/**
 * The ONLY way to read a record back. Requires the exact token issued at
 * creation (constant-time compared, against the stored SHA-256 hash — the
 * raw token itself is never persisted anywhere); a missing/wrong token, an
 * unknown id, or an expired record all return null — indistinguishable from
 * each other, so a caller can't use this to enumerate valid ids. An expired
 * Supabase row is best-effort deleted on lookup (not required for
 * correctness — expiry is always re-checked in code on every read — just
 * table hygiene). Throws AnalysisPersistenceUnavailableError — never null,
 * never the in-memory Map — when production persistence is unavailable: that
 * failure mode must never be indistinguishable from "not found" (a caller
 * could otherwise use an outage to probe whether an id merely doesn't exist),
 * and must never let a caller proceed as if a record had been resolved.
 */
export async function getAnalysisRecord(analysisId: string, sessionToken: string, deps: AnalysisSessionStoreDeps = {}): Promise<AnalysisRecord | null> {
  const { env, fetchImpl } = resolveDeps(deps);
  const configured = isSupabaseConfigured(env);
  const production = isProductionEnv(env);
  if (!configured) {
    if (production) throw new AnalysisPersistenceUnavailableError();
    warnFallbackOnce();
  }

  if (typeof analysisId !== "string" || typeof sessionToken !== "string" || sessionToken.length === 0) return null;

  let storedHashHex: string;
  let record: AnalysisRecord;
  let expiresAtMs: number;

  if (configured) {
    const res = await supabaseRequest(env, `/analysis_sessions?analysis_id=eq.${encodeURIComponent(analysisId)}&select=*`, { method: "GET" }, fetchImpl).catch(() => null);
    if (!res || !res.ok) {
      if (production) throw new AnalysisPersistenceUnavailableError();
      return null;
    }
    let rows: SupabaseRow[];
    try {
      rows = (await res.json()) as SupabaseRow[];
    } catch {
      if (production) throw new AnalysisPersistenceUnavailableError();
      return null;
    }
    const row = rows[0];
    if (!row) return null;
    storedHashHex = row.session_token_hash;
    record = row.record;
    expiresAtMs = Date.parse(row.expires_at);
    if (Date.now() > expiresAtMs) {
      void supabaseRequest(env, `/analysis_sessions?analysis_id=eq.${encodeURIComponent(analysisId)}`, { method: "DELETE" }, fetchImpl).catch(() => {});
      return null;
    }
  } else {
    const entry = fallbackRecords.get(analysisId);
    if (!entry) return null;
    if (Date.now() - Date.parse(entry.record.createdAt) > TTL_MS) {
      fallbackRecords.delete(analysisId);
      return null;
    }
    storedHashHex = entry.tokenHash.toString("hex");
    record = entry.record;
  }

  const submitted = hashToken(sessionToken);
  const stored = Buffer.from(storedHashHex, "hex");
  if (submitted.length !== stored.length) return null; // timingSafeEqual requires equal-length buffers
  if (!timingSafeEqual(submitted, stored)) return null;
  return record;
}

/** Test-only: clears the in-memory fallback store between test files. Never called from production code. */
export function __clearAnalysisRecordsForTests(): void {
  fallbackRecords.clear();
}

/**
 * Test-only: inserts a fully-formed AnalysisRecord directly into the
 * in-memory fallback, bypassing createAnalysisRecord's own (honest, real)
 * opportunity computation — the one way tests simulate "what store.ts will
 * compute once expression calibration is real" without touching
 * CALIBRATION_STATE anywhere. Never called from production code; production
 * records are only ever created via createAnalysisRecord.
 */
export function __setAnalysisRecordForTests(record: AnalysisRecord, sessionToken: string): void {
  fallbackRecords.set(record.id, { record, tokenHash: hashToken(sessionToken) });
}
