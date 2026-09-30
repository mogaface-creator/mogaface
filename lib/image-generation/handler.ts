/**
 * The server-side illustration endpoint, as a plain function so it can be
 * tested without Next. app/api/generate-illustration/route.ts is a thin wrapper.
 *
 * Order of checks — each one stops the request, and the image API is called
 * only after ALL of them pass:
 *   1. Is an image provider switched on and keyed?            no → { available: false }
 *   2. Same-origin request?                                     no → 403
 *   3. Authenticated? (none exists yet → refused in production) no → 401
 *   4. Entitled? (a hook; allows everyone until one exists)     no → 403
 *   5. Within the rate limit? (no store yet → refused in prod)  no → 429 / 503
 *   6. Well-formed multipart body of sensible size?             no → 400 / 413
 *   7. Has the person consented to photo processing?            no → 403
 *   8. Is the photo a real, sensibly-sized image?               no → 400
 *   9. A trusted, server-built PredictionPlan (payload.predictionPlan,
 *      forwarded only by trustedHandler.ts/multiAngle.ts from the
 *      analysis-session record — see lib/visualization/predict.ts) is used
 *      when present, structurally valid and "planned". Otherwise, the plan
 *      is rebuilt FROM THE OPPORTUNITIES on the server and eligibility is
 *      decided the original way. Either way, client-supplied plans,
 *      prompts, descriptions and consumer-ready flags are never trusted —
 *      only a plan this same server already built and stored.
 *                                                                 no → { status: "not_eligible" }
 *  10. Build the prompt from the approved changes and safety-check it.
 *  11. Call the image API, bounded by a timeout, and validate the result.
 * Everything after 8 answers HTTP 200 with a status, never a technical error:
 * the report stays intact and the UI shows its calm placeholder.
 *
 * Nothing about the photo is stored or logged: the bytes live in memory for
 * this request only. Logs are one line of metadata.
 *
 * TRUST NOTE: the server has no analysis of its own, so it cannot verify that
 * the opportunities a client sends are genuine — it re-derives everything it can
 * (plan, prompt, consumer-readiness against the calibration gate) and requires
 * authentication before anything runs. Verifying the evidence itself needs
 * server-side persisted analysis, which does not exist yet.
 */

import { createMemoryRateLimiter, devAuthenticator } from "../interpretation/access.ts";
import type { Authenticator, RateLimiter } from "../interpretation/access.ts";
import type { AnalysisSessionStoreDeps } from "../analysis-session/store.ts";
import { isConsumerReady } from "../facial-analysis/calibration/status.ts";
import { OPPORTUNITY_STATUSES, TREATMENT_CATEGORIES } from "../treatment-opportunities/types.ts";
import type { TreatmentOpportunity } from "../treatment-opportunities/types.ts";
import { buildVisualizationPlan } from "../visualization/build.ts";
import { allowsPhotoProcessing } from "../visualization/consent.ts";
import { decideIllustrationEligibility } from "../visualization/eligibility.ts";
import type { EligibilityOptions } from "../visualization/eligibility.ts";
import { ILLUSTRATIVE_AFTER } from "../visualization/types.ts";
import type { VisualizationChange, VisualizationPlan } from "../visualization/types.ts";
import { isValidVisualizationPlan } from "../visualization/validate.ts";
import { visualizedAreaFor } from "../visualization/present.ts";
import { isUploadedPhoto, validateSourcePhoto } from "./output.ts";
import { createOpenAiImageProvider, DEFAULT_IMAGE_MODEL, DEFAULT_IMAGE_TIMEOUT_MS } from "./openaiImages.ts";
import type { OpenAiProviderErrorDetail } from "./openaiImages.ts";
import { generateVisualization } from "./provider.ts";

export const MAX_REQUEST_BYTES = 12_000_000;
const MAX_PAYLOAD_CHARS = 100_000;
const PAYLOAD_KEYS = new Set(["photoVisualizationConsent", "photoQualityValid", "opportunities", "predictionPlan"]);

type Env = Record<string, string | undefined>;

export interface IllustrationLogEntry {
  event: "illustrate";
  requestId: string;
  provider: string;
  model?: string;
  outcome: "disabled" | "denied" | "rejected" | "not_eligible" | "ready" | "failed";
  status: number;
  reason?: string;
  /** Present only when the OpenAI call itself failed: its HTTP status and its own error code/type/message — never the key, the prompt, or image bytes (see openaiImages.ts's onProviderError). */
  providerError?: OpenAiProviderErrorDetail;
  durationMs: number;
}

/** A hook for a future entitlement model (plans, credits, per-user limits). It allows everyone until one exists. */
export type EntitlementCheck = (subject: string) => Promise<{ allowed: boolean; reason?: string }>;

export interface IllustrationHandlerDeps {
  env: Env;
  fetchImpl?: typeof fetch;
  authenticator?: Authenticator | null;
  rateLimiter?: RateLimiter | null;
  entitlement?: EntitlementCheck;
  /** Tests only: the route never sets this, so production always uses the closed calibration gate and the real policy. */
  eligibility?: EligibilityOptions;
  /**
   * Tests/dev-only: the production route never sets this, so production
   * always builds the plan the normal way, from real opportunities via
   * buildVisualizationPlan. Exists ONLY for the dev-only composite fixture
   * (see devTestHandler.ts and devIllustrationFixture.ts's
   * buildDevMultiAreaPlan): three of its five categories have no real
   * opportunity→category route in build.ts's APPROVED map by design (there is
   * no genuine evidence path for them), so a plan for them can't be
   * constructed the normal way from opportunities at all — this substitutes
   * the plan-building step only; every check downstream (eligibility, safety,
   * consent, the image call, output validation) still runs unmodified.
   */
  buildPlan?: typeof buildVisualizationPlan;
  logger?: (entry: IllustrationLogEntry) => void;
  timeoutMs?: number;
  now?: () => number;
  requestId?: () => string;
  /**
   * Overrides the deps passed to the analysis-session store (see
   * lib/analysis-session/store.ts) when trustedHandler.ts/multiAngle.ts
   * resolve analysisId+sessionToken into a trusted record. Defaults to
   * `{ env, fetchImpl }` — the real route (app/api/generate-illustration)
   * never sets this, so production always shares the SAME process.env and
   * fetch implementation between the OpenAI provider and Supabase, exactly
   * like a real deployment. Exists so tests can construct a "production"
   * env for THIS handler's own auth/rate-limit checks without also having
   * to wire a fake Supabase backend for the analysis-session store.
   */
  analysisSessionDeps?: AnalysisSessionStoreDeps;
}

export const isIllustrationEnabled = (env: Env): boolean => env.IMAGE_GENERATION_PROVIDER?.trim().toLowerCase() === "openai" && !!env.OPENAI_API_KEY?.trim();

export function illustrationTimeoutMs(env: Env): number {
  const n = Number(env.IMAGE_GENERATION_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? Math.min(58_000, Math.max(10_000, Math.round(n))) : DEFAULT_IMAGE_TIMEOUT_MS;
}
export const illustrationModel = (env: Env): string => env.IMAGE_GENERATION_MODEL?.trim() || DEFAULT_IMAGE_MODEL;

let sharedDevLimiter: RateLimiter | null = null;
// ponytail: a small per-process limit for development; the shared-store limiter is the production control (see access.ts).
const devLimiter = () => (sharedDevLimiter ??= createMemoryRateLimiter({ limit: 3, windowMs: 60 * 60_000 }));

export const defaultIllustrationLogger = (entry: IllustrationLogEntry) => console.info(JSON.stringify(entry));

const isText = (v: unknown, max: number): v is string => typeof v === "string" && v.length > 0 && v.length <= max;
const textList = (v: unknown): string[] | null => (Array.isArray(v) && v.length <= 50 && v.every((x) => isText(x, 200)) ? (v as string[]) : null);

/**
 * Rebuilds the only fields the plan needs from the client's list. `consumerReady` is
 * re-derived against the calibration gate — a forged `true` cannot bypass it.
 */
export function sanitizeOpportunities(raw: unknown, calibrated?: boolean): TreatmentOpportunity[] | null {
  if (!Array.isArray(raw) || raw.length > 20) return null;
  const out: TreatmentOpportunity[] = [];
  for (const o of raw as Record<string, unknown>[]) {
    if (!o || typeof o !== "object" || !isText(o.id, 100)) return null;
    if (o.category !== null && !(TREATMENT_CATEGORIES as readonly unknown[]).includes(o.category)) return null;
    if (!(OPPORTUNITY_STATUSES as readonly unknown[]).includes(o.status)) return null;
    const obs = textList(o.evidenceObservationIds);
    const q = textList(o.evidenceQuestionIds);
    if (!obs || !q) return null;
    out.push({
      id: o.id,
      category: o.category,
      status: o.status,
      consumerReady: o.consumerReady === true && isConsumerReady(obs, calibrated),
      evidenceObservationIds: obs,
      evidenceQuestionIds: q,
    } as unknown as TreatmentOpportunity); // only the fields the plan reads; the rest of the engine's record is not needed here
  }
  return out;
}

export async function handleIllustrationRequest(request: Request, deps: IllustrationHandlerDeps): Promise<Response> {
  const now = deps.now ?? Date.now;
  const started = now();
  const requestId = request.headers.get("x-request-id") ?? request.headers.get("x-vercel-id") ?? deps.requestId?.() ?? crypto.randomUUID();
  const log = deps.logger ?? defaultIllustrationLogger;
  const production = deps.env.NODE_ENV === "production";
  const enabled = isIllustrationEnabled(deps.env);
  // Set only if the OpenAI call itself fails (see the provider construction below) — safe detail for the "failed" log entry only, never sent to the browser.
  let providerErrorDetail: OpenAiProviderErrorDetail | undefined;

  const done = (outcome: IllustrationLogEntry["outcome"], status: number, body: unknown, reason?: string, headers?: Record<string, string>) => {
    log({
      event: "illustrate",
      requestId,
      provider: enabled ? "openai-images" : "none",
      ...(enabled && { model: illustrationModel(deps.env) }),
      outcome,
      status,
      ...(reason && { reason }),
      ...(providerErrorDetail && { providerError: providerErrorDetail }),
      durationMs: now() - started,
    });
    return Response.json(body, { status, headers });
  };

  // 1. Off by default.
  if (!enabled) return done("disabled", 200, { available: false }, "provider_disabled");

  // 2. Same origin only.
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) return done("denied", 403, { error: "forbidden" }, "cross_origin");

  // 3. Authentication. Production has none yet, so it refuses.
  const authenticator = deps.authenticator ?? (production ? null : devAuthenticator);
  if (!authenticator) return done("denied", 401, { error: "unauthorized" }, "authentication_not_configured");
  const who = await authenticator(request);
  if (!who) return done("denied", 401, { error: "unauthorized" }, "unauthenticated");

  // 4. Entitlement hook.
  if (deps.entitlement) {
    const e = await deps.entitlement(who.subject);
    if (!e.allowed) return done("denied", 403, { error: "not_entitled" }, e.reason ?? "not_entitled");
  }

  // 5. Rate limit. Production has no shared store yet, so it refuses rather than pretend.
  const limiter = deps.rateLimiter ?? (production ? null : devLimiter());
  if (!limiter) return done("denied", 503, { error: "unavailable" }, "rate_limiter_not_configured");
  const decision = await limiter.check(`illustration:${who.subject}`);
  if (!decision.allowed) return done("denied", 429, { error: "rate_limited" }, "rate_limited", { "retry-after": String(decision.retryAfterSeconds) });

  // 6. The body: bounded multipart with exactly a photo and a payload.
  if (Number(request.headers.get("content-length") ?? 0) > MAX_REQUEST_BYTES) return done("rejected", 413, { error: "too_large" }, "too_large");
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return done("rejected", 400, { error: "invalid_request" }, "invalid_multipart");
  }
  const photo = form.get("photo");
  const payloadText = form.get("payload");
  const fields = [...form.keys()];
  if (!isUploadedPhoto(photo) || typeof payloadText !== "string" || fields.some((k) => k !== "photo" && k !== "payload") || fields.length !== 2) return done("rejected", 400, { error: "invalid_request" }, "invalid_fields");
  if (photo.size > MAX_REQUEST_BYTES) return done("rejected", 413, { error: "too_large" }, "photo_too_large");
  if (payloadText.length > MAX_PAYLOAD_CHARS) return done("rejected", 413, { error: "too_large" }, "payload_too_large");
  let payload: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(payloadText);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || Object.keys(parsed).some((k) => !PAYLOAD_KEYS.has(k))) throw new Error("shape");
    payload = parsed as Record<string, unknown>;
  } catch {
    return done("rejected", 400, { error: "invalid_request" }, "invalid_payload");
  }

  // 7. Consent to photo processing. Only "granted" passes.
  if (!allowsPhotoProcessing(payload.photoVisualizationConsent)) return done("denied", 403, { error: "consent_required" }, `consent_${typeof payload.photoVisualizationConsent === "string" ? payload.photoVisualizationConsent : "missing"}`);

  // 8. The photo itself.
  const bytes = new Uint8Array(await photo.arrayBuffer());
  const source = validateSourcePhoto(bytes, photo.type);
  if (!source.ok) return done("rejected", 400, { error: "invalid_photo" }, "invalid_photo");

  // 9. A trusted, already-built PredictionPlan takes precedence when present and valid (see
  // predict.ts's module comment for why this is a separate, independent pathway from the
  // opportunities-based one below — never a weaker check, just a different evidence source).
  // Structural validation here is defense in depth: this value is server-forwarded, never
  // client-submitted (PAYLOAD_KEYS admits the key, but the real public route only ever reaches
  // this function via trustedHandler.ts/multiAngle.ts, which build the FormData themselves from
  // the trusted analysis-session record — see their own doc comments).
  const predictionPlan = isValidVisualizationPlan(payload.predictionPlan) ? (payload.predictionPlan as VisualizationPlan) : null;
  let plan: VisualizationPlan;
  let approvedChanges: VisualizationChange[];
  let opportunities: TreatmentOpportunity[] | undefined;
  if (predictionPlan && predictionPlan.status === "planned") {
    plan = predictionPlan;
    approvedChanges = predictionPlan.changes;
  } else {
    const sanitized = sanitizeOpportunities(payload.opportunities, deps.eligibility?.calibrated);
    if (!sanitized) return done("rejected", 400, { error: "invalid_request" }, "invalid_opportunities");
    opportunities = sanitized;
    const builtPlan = (deps.buildPlan ?? buildVisualizationPlan)({ frontPhoto: { ref: "upload", qualityValid: payload.photoQualityValid === true }, opportunities });
    const eligibility = decideIllustrationEligibility(builtPlan, opportunities, deps.eligibility);
    if (!eligibility.eligible) return done("not_eligible", 200, { status: "not_eligible", reason: eligibility.reason }, eligibility.reason ?? "not_eligible");
    plan = builtPlan;
    approvedChanges = eligibility.approvedChanges;
  }

  // 10–11. Render only the approved changes; the prompt is built and safety-checked inside generateVisualization.
  const provider = createOpenAiImageProvider({
    apiKey: deps.env.OPENAI_API_KEY!.trim(),
    model: illustrationModel(deps.env),
    size: deps.env.IMAGE_GENERATION_SIZE?.trim() || undefined,
    quality: deps.env.IMAGE_GENERATION_QUALITY?.trim() || undefined,
    inputFidelity: deps.env.IMAGE_GENERATION_INPUT_FIDELITY?.trim() || undefined,
    fetchImpl: deps.fetchImpl,
    timeoutMs: deps.timeoutMs ?? illustrationTimeoutMs(deps.env),
    onProviderError: (detail) => {
      providerErrorDetail = detail;
    },
  });
  const outcome = await generateVisualization({
    sourceImage: { url: "upload", slot: "front", bytes: source.bytes, mimeType: source.mimeType },
    plan: { ...plan, changes: approvedChanges },
    provider,
    opportunities, // undefined on the PredictionPlan path — there is no TreatmentOpportunity[] to cross-check against; the plan's own structural validation already covers it
    photoConsent: "granted",
    timeoutMs: (deps.timeoutMs ?? illustrationTimeoutMs(deps.env)) + 500, // the provider's own abort fires first
    maxImageChars: 20_000_000,
  });
  const dataUrl = outcome.status === "ready" ? outcome.imageUrl : undefined;
  const match = dataUrl ? /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(dataUrl) : null;
  const providerCode = providerErrorDetail?.code && /^[a-z0-9_]{1,80}$/i.test(providerErrorDetail.code) ? providerErrorDetail.code : undefined;
  if (outcome.status !== "ready" || !match) return done("failed", 200, { status: "failed", errorCode: outcome.errorCode ?? "invalid_result", ...(providerCode ? { providerCode } : {}) }, outcome.errorCode ?? "invalid_result");

  return done("ready", 200, {
    status: "ready",
    image: { mimeType: match[1], base64: match[2] },
    illustrativeAfter: { kind: "illustrative_after", label: ILLUSTRATIVE_AFTER.label, aiLabel: ILLUSTRATIVE_AFTER.aiLabel, notice: ILLUSTRATIVE_AFTER.notice, generatedByAi: true, provider: outcome.provider, createdAt: outcome.createdAt },
    // Which areas THIS generation actually illustrated — from the real, server-authoritative
    // plan that drove it (predictionPlan or the legacy opportunities path), never a client-side
    // guess. The consumer UI must render cards from this, not from its own local preview, which
    // (being computed client-side from the calibration-gated pathway only) can disagree with
    // what a PredictionPlan-driven generation actually shows — see ResultsExperience.tsx.
    changes: approvedChanges.map(visualizedAreaFor),
  });
}
