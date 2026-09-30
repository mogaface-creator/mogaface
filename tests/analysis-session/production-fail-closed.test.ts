/**
 * Production fail-closed proof for lib/analysis-session/store.ts.
 *
 * The in-memory fallback (tests/analysis-session/persistence.test.ts's
 * "when Supabase is not configured" test, and test A below) is
 * development-only. When `env.NODE_ENV === "production"`, persistence must
 * never silently use it: createAnalysisRecord/getAnalysisRecord must throw
 * AnalysisPersistenceUnavailableError, and every HTTP handler built on the
 * store (handleCreateAnalysisSession, handleTrustedIllustrationRequest,
 * handleMultiAngleIllustrationRequest) must turn that into a generic,
 * non-leaking response — never a stack trace, a Supabase error body, or
 * SUPABASE_SERVICE_ROLE_KEY — and must never reach the OpenAI provider.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createAnalysisRecord, getAnalysisRecord, AnalysisPersistenceUnavailableError, __clearAnalysisRecordsForTests } from "../../lib/analysis-session/store.ts";
import type { AnalysisSessionStoreDeps } from "../../lib/analysis-session/store.ts";
import type { AnalysisRecord } from "../../lib/analysis-session/types.ts";
import { handleCreateAnalysisSession } from "../../lib/analysis-session/handler.ts";
import { handleTrustedIllustrationRequest } from "../../lib/image-generation/trustedHandler.ts";
import { handleMultiAngleIllustrationRequest } from "../../lib/image-generation/multiAngle.ts";
import type { IllustrationHandlerDeps } from "../../lib/image-generation/handler.ts";
import { createMemoryRateLimiter } from "../../lib/interpretation/access.ts";
import { createEmptyAssessment } from "../../lib/assessment/defaults.ts";
import { buildMogaFaceAnalysis } from "../../lib/observation/build.ts";
import { measuredObservation } from "../../lib/observation/helpers.ts";
import type { Assessment } from "../../lib/assessment/types.ts";
import type { MogaFaceAnalysis } from "../../lib/observation/types.ts";

const VALID_ENV = { NEXT_PUBLIC_SUPABASE_URL: "https://fake-project.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "fake-service-role-key-not-real" };
const OPENAI_KEY = "sk-test-failclosed-key-not-real";

function realExpressionLinesInput(): { assessment: Assessment; analysis: MogaFaceAnalysis } {
  const assessment = createEmptyAssessment();
  assessment.appearanceConcerns = { ...assessment.appearanceConcerns, selected: ["FACIAL_LINES"], details: ["FOREHEAD_LINES"], priorities: ["FACIAL_LINES"] };
  const analysis = buildMogaFaceAnalysis(assessment, null);
  analysis.observations.push(
    measuredObservation({ id: "expression.browRaise.foreheadRegionMovementPct", domain: "expression", label: "Brow raise movement", value: 24, source: "video_frame_0" }),
    measuredObservation({ id: "expression.visibleForeheadLinePattern", domain: "expression", label: "Visible forehead line pattern", value: true, source: "video_frame_0" }),
  );
  return { assessment, analysis };
}

interface FakeRow {
  analysis_id: string;
  session_token_hash: string;
  record: AnalysisRecord;
  created_at: string;
  expires_at: string;
}

/** A minimal, healthy fake Supabase table — see persistence.test.ts for the fuller version this mirrors. Used here only by test G, to prove the happy path is unaffected. */
function createFakeSupabase() {
  const table = new Map<string, FakeRow>();
  const fetchImpl: typeof fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    const method = (init.method ?? "GET").toUpperCase();
    const analysisIdFilter = url.searchParams.get("analysis_id");
    const idFromFilter = analysisIdFilter?.startsWith("eq.") ? decodeURIComponent(analysisIdFilter.slice(3)) : null;
    if (method === "POST") {
      const body = JSON.parse(String(init.body)) as FakeRow;
      table.set(body.analysis_id, body);
      return new Response(null, { status: 201 });
    }
    if (method === "GET") {
      const rows = idFromFilter ? [table.get(idFromFilter)].filter((r): r is FakeRow => !!r) : [...table.values()];
      return Response.json(rows, { status: 200 });
    }
    if (method === "DELETE") {
      if (idFromFilter) table.delete(idFromFilter);
      return new Response(null, { status: 200 });
    }
    throw new Error(`unexpected method ${method}`);
  };
  return { fetchImpl, table };
}

function fakeJpeg(w: number, h: number, size: number): Uint8Array {
  const b = new Uint8Array(size).fill(9);
  b.set([0xff, 0xd8, 0xff, 0xc0, 0, 17, 8, h >> 8, h & 255, w >> 8, w & 255, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1], 0);
  return b;
}
const SOURCE = fakeJpeg(900, 1200, 60_000);

function singleRequest(opts: { analysisId?: unknown; sessionToken?: unknown } = {}) {
  const form = new FormData();
  form.append("photo", new Blob([SOURCE as BlobPart], { type: "image/jpeg" }), "front.jpg");
  form.append("payload", JSON.stringify({ photoVisualizationConsent: "granted", photoQualityValid: true, analysisId: opts.analysisId, sessionToken: opts.sessionToken }));
  return new Request("http://localhost/api/generate-illustration", { method: "POST", headers: { host: "localhost" }, body: form });
}

function multiRequest(opts: { analysisId?: unknown; sessionToken?: unknown } = {}) {
  const form = new FormData();
  form.append("photo_front", new Blob([SOURCE as BlobPart], { type: "image/jpeg" }), "front.jpg");
  form.append("payload", JSON.stringify({ photoVisualizationConsent: "granted", photoQualityValid: true, analysisId: opts.analysisId, sessionToken: opts.sessionToken }));
  return new Request("http://localhost/api/generate-illustration", { method: "POST", headers: { host: "localhost" }, body: form });
}

test("setup", () => {
  __clearAnalysisRecordsForTests();
});

// ===========================================================================
// A. development + missing Supabase config → existing local fallback remains
// ===========================================================================

test("A. development (no NODE_ENV=production) with no Supabase config still uses the in-memory fallback, unchanged", async () => {
  const deps: AnalysisSessionStoreDeps = { env: {} }; // no NODE_ENV, no Supabase vars — an ordinary local dev environment
  const handle = await createAnalysisRecord(realExpressionLinesInput(), deps);
  assert.ok(handle, "development must still work without Supabase configured");
  const record = await getAnalysisRecord(handle!.analysisId, handle!.sessionToken, deps);
  assert.ok(record, "and the record it created must be retrievable the normal way");
});

// ===========================================================================
// B. production + missing Supabase URL → fail closed
// ===========================================================================

test("B. production with the service-role key set but NEXT_PUBLIC_SUPABASE_URL missing throws, for both create and retrieve", async () => {
  const deps: AnalysisSessionStoreDeps = { env: { NODE_ENV: "production", SUPABASE_SERVICE_ROLE_KEY: VALID_ENV.SUPABASE_SERVICE_ROLE_KEY } };
  await assert.rejects(() => createAnalysisRecord(realExpressionLinesInput(), deps), AnalysisPersistenceUnavailableError);
  await assert.rejects(() => getAnalysisRecord("00000000-0000-0000-0000-000000000000", "any-token", deps), AnalysisPersistenceUnavailableError);
});

// ===========================================================================
// C. production + missing service-role key → fail closed
// ===========================================================================

test("C. production with NEXT_PUBLIC_SUPABASE_URL set but the service-role key missing throws", async () => {
  const deps: AnalysisSessionStoreDeps = { env: { NODE_ENV: "production", NEXT_PUBLIC_SUPABASE_URL: VALID_ENV.NEXT_PUBLIC_SUPABASE_URL } };
  await assert.rejects(() => createAnalysisRecord(realExpressionLinesInput(), deps), AnalysisPersistenceUnavailableError);
  await assert.rejects(() => getAnalysisRecord("00000000-0000-0000-0000-000000000000", "any-token", deps), AnalysisPersistenceUnavailableError);
});

// ===========================================================================
// D. production + malformed Supabase URL → fail closed
// ===========================================================================

test("D. production with a malformed or non-https NEXT_PUBLIC_SUPABASE_URL throws, exactly like a missing one", async () => {
  for (const badUrl of ["not-a-url", "ftp://example.com", "http://insecure.example.com", "   "]) {
    const deps: AnalysisSessionStoreDeps = { env: { NODE_ENV: "production", NEXT_PUBLIC_SUPABASE_URL: badUrl, SUPABASE_SERVICE_ROLE_KEY: VALID_ENV.SUPABASE_SERVICE_ROLE_KEY } };
    await assert.rejects(() => createAnalysisRecord(realExpressionLinesInput(), deps), AnalysisPersistenceUnavailableError, `url: ${JSON.stringify(badUrl)}`);
  }
});

// ===========================================================================
// E. production + persistence unavailable (configured, but the backend call
// itself fails) → no in-memory fallback
// ===========================================================================

test("E. production with valid-looking config but a failing Supabase backend throws, and never falls back to the in-memory store", async () => {
  const failingFetch: typeof fetch = async () => new Response("boom", { status: 500 });
  const deps: AnalysisSessionStoreDeps = { env: { ...VALID_ENV, NODE_ENV: "production" }, fetchImpl: failingFetch };
  await assert.rejects(() => createAnalysisRecord(realExpressionLinesInput(), deps), AnalysisPersistenceUnavailableError);

  // Prove it never falls back: a record that genuinely exists in the (separate, dev-only)
  // in-memory fallback must remain unreachable through this configured-but-failing production path.
  const devHandle = (await createAnalysisRecord(realExpressionLinesInput(), { env: {} }))!;
  await assert.rejects(() => getAnalysisRecord(devHandle.analysisId, devHandle.sessionToken, deps), AnalysisPersistenceUnavailableError);
});

// ===========================================================================
// F. production persistence failure → no OpenAI/provider call, and a
// generic, non-leaking response from both HTTP handlers
// ===========================================================================

test("F. when persistence is unavailable in production, /api/analysis-session returns a generic 503 that leaks nothing internal", async () => {
  const req = new Request("http://localhost/api/analysis-session", {
    method: "POST",
    headers: { host: "localhost", "content-type": "application/json" },
    body: JSON.stringify(realExpressionLinesInput()),
  });
  const res = await handleCreateAnalysisSession(req, { env: { NODE_ENV: "production" } }); // no Supabase config at all
  assert.equal(res.status, 503);
  const body = (await res.json()) as Record<string, unknown>;
  assert.deepEqual(Object.keys(body), ["error"], "the response body must contain nothing beyond a single generic error field");
  const raw = JSON.stringify(body);
  assert.doesNotMatch(raw, /SUPABASE_SERVICE_ROLE_KEY|service.role|fake-service-role-key|stack|at Object|AnalysisPersistenceUnavailableError/i);
});

test("F. when persistence is unavailable in production, /api/generate-illustration (single and multi-angle) fails closed with a generic 503 and never calls the image provider", async () => {
  let openAiCalls = 0;
  const fetchImpl: typeof fetch = async (input) => {
    const url = String(input);
    if (url.startsWith("https://api.openai.com/")) {
      openAiCalls++;
      return new Response(JSON.stringify({ data: [{ b64_json: "AA==" }] }), { status: 200 });
    }
    // Anything else (a Supabase call) fails, simulating an outage — no Supabase config is even
    // set below, so this stub should never actually be reached for a Supabase call either.
    return new Response("boom", { status: 500 });
  };
  const deps: IllustrationHandlerDeps = {
    env: { IMAGE_GENERATION_PROVIDER: "openai", OPENAI_API_KEY: OPENAI_KEY, NODE_ENV: "production" }, // no Supabase config
    fetchImpl,
    authenticator: async () => ({ subject: "test-user" }),
    rateLimiter: createMemoryRateLimiter({ limit: 1000 }),
    logger: () => {},
  };

  const single = await handleTrustedIllustrationRequest(singleRequest({ analysisId: "x", sessionToken: "y" }), deps);
  assert.equal(single.status, 503);
  const singleBody = (await single.json()) as Record<string, unknown>;
  assert.deepEqual(Object.keys(singleBody), ["error"]);

  const multi = await handleMultiAngleIllustrationRequest(multiRequest({ analysisId: "x", sessionToken: "y" }), deps);
  assert.equal(multi.status, 503);
  const multiBody = (await multi.json()) as Record<string, unknown>;
  assert.deepEqual(Object.keys(multiBody), ["error"]);

  assert.equal(openAiCalls, 0, "the OpenAI provider must never be reached when persistence is unavailable");
});

// ===========================================================================
// G. valid production Supabase configuration → normal trusted flow unchanged
// ===========================================================================

test("G. a genuinely valid, configured production Supabase store behaves exactly like before — normal create/retrieve and honest 'not found', never a thrown error", async () => {
  const supa = createFakeSupabase();
  const deps: AnalysisSessionStoreDeps = { env: { ...VALID_ENV, NODE_ENV: "production" }, fetchImpl: supa.fetchImpl };

  const handle = (await createAnalysisRecord(realExpressionLinesInput(), deps))!;
  assert.ok(handle);

  const record = await getAnalysisRecord(handle.analysisId, handle.sessionToken, deps);
  assert.ok(record, "a genuinely configured, healthy production Supabase store must still retrieve what it just created");

  const unknown = await getAnalysisRecord("00000000-0000-0000-0000-000000000000", handle.sessionToken, deps);
  assert.equal(unknown, null, "an unknown id is still a normal 'not found' — not a thrown error — when Supabase itself is healthy");

  const wrongToken = await getAnalysisRecord(handle.analysisId, "not-the-real-token", deps);
  assert.equal(wrongToken, null, "a wrong token is still a normal 'not found' — not a thrown error — when Supabase itself is healthy");
});
