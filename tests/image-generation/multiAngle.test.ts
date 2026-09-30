/**
 * Multi-angle illustration orchestration
 * (lib/image-generation/multiAngle.ts, trustedHandler.ts's reusable core).
 * NO real OpenAI call is ever made here: the API is a stubbed `fetch`. Real,
 * evidence-backed opportunities come from the REAL evaluateTreatmentOpportunities
 * engine (see realExpressionLinesInput below) — never a hand-built
 * TreatmentOpportunity and never DEV_ILLUSTRATION_FIXTURE_OPPORTUNITY.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { handleMultiAngleIllustrationRequest, ANGLE_SLOTS } from "../../lib/image-generation/multiAngle.ts";
import { createAnalysisRecord, getAnalysisRecord, __clearAnalysisRecordsForTests, __setAnalysisRecordForTests } from "../../lib/analysis-session/store.ts";
import { randomBytes } from "node:crypto";
import type { IllustrationHandlerDeps } from "../../lib/image-generation/handler.ts";
import { createMemoryRateLimiter } from "../../lib/interpretation/access.ts";
import { CALIBRATION_STATE } from "../../lib/facial-analysis/calibration/status.ts";
import { createEmptyAssessment } from "../../lib/assessment/defaults.ts";
import { buildMogaFaceAnalysis } from "../../lib/observation/build.ts";
import { measuredObservation } from "../../lib/observation/helpers.ts";
import type { Assessment } from "../../lib/assessment/types.ts";
import type { MogaFaceAnalysis } from "../../lib/observation/types.ts";

const ROOT = new URL("../../", import.meta.url).pathname;
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

const KEY = "sk-test-multiangle-key-not-real";
const ENABLED_ENV = { IMAGE_GENERATION_PROVIDER: "openai", OPENAI_API_KEY: KEY, NODE_ENV: "production" };

function fakeJpeg(w: number, h: number, size: number, fill = 9): Uint8Array {
  const b = new Uint8Array(size).fill(fill);
  b.set([0xff, 0xd8, 0xff, 0xc0, 0, 17, 8, h >> 8, h & 255, w >> 8, w & 255, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1], 0);
  return b;
}
// Deliberately different SIZES (not just fill bytes) so a test can tell which
// angle's actual source photo reached the provider for a given call.
const FRONT_SOURCE = fakeJpeg(900, 1200, 60_000, 9);
const LEFT_SOURCE = fakeJpeg(900, 1200, 62_000, 11);
const RIGHT_SOURCE = fakeJpeg(900, 1200, 64_000, 13);
function fakePng(w: number, h: number, size: number): Uint8Array {
  const b = new Uint8Array(size).fill(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52], 0);
  new DataView(b.buffer).setUint32(16, w);
  new DataView(b.buffer).setUint32(20, h);
  return b;
}
const GENERATED = fakePng(1024, 1536, 8_000);
const b64 = (b: Uint8Array) => Buffer.from(b).toString("base64");

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

/**
 * A record whose STORED opportunities already have consumerReady forced
 * true — simulating the one future, real state (expression calibration
 * actually complete), via the same test-only store injection
 * tests/analysis-session/security.test.ts uses. CALIBRATION_STATE is never
 * touched anywhere in this file.
 */
async function eligibleRecordDeps(overrides: Partial<IllustrationHandlerDeps> = {}) {
  const handle = (await createAnalysisRecord(realExpressionLinesInput()))!;
  const record = (await getAnalysisRecord(handle.analysisId, handle.sessionToken))!;
  const openedToken = randomBytes(32).toString("base64url");
  __setAnalysisRecordForTests({ ...record, opportunities: record.opportunities.map((o) => ({ ...o, consumerReady: true })) }, openedToken);
  // analysisSessionDeps deliberately uses a plain, unconfigured, non-production env — this file's
  // ENABLED_ENV sets NODE_ENV: "production" only to exercise the ILLUSTRATION handler's own
  // auth/rate-limit production checks; the analysis-session store's own production fail-closed
  // behavior is covered separately (tests/analysis-session/production-fail-closed.test.ts).
  const deps: IllustrationHandlerDeps = { env: ENABLED_ENV, authenticator: async () => ({ subject: "test-user" }), rateLimiter: createMemoryRateLimiter({ limit: 1000 }), logger: () => {}, eligibility: { calibrated: true }, analysisSessionDeps: { env: {} }, ...overrides };
  return { handle: { ...handle, sessionToken: openedToken }, deps };
}

function multiAngleRequest(opts: { analysisId?: unknown; sessionToken?: unknown; consent?: unknown; front?: Uint8Array | null; left?: Uint8Array; right?: Uint8Array } = {}) {
  const form = new FormData();
  const front = "front" in opts ? opts.front : FRONT_SOURCE;
  if (front) form.append("photo_front", new Blob([front as BlobPart], { type: "image/jpeg" }), "front.jpg");
  if (opts.left) form.append("photo_leftFortyFive", new Blob([opts.left as BlobPart], { type: "image/jpeg" }), "left.jpg");
  if (opts.right) form.append("photo_rightFortyFive", new Blob([opts.right as BlobPart], { type: "image/jpeg" }), "right.jpg");
  form.append("payload", JSON.stringify({ photoVisualizationConsent: "consent" in opts ? opts.consent : "granted", photoQualityValid: true, analysisId: opts.analysisId, sessionToken: opts.sessionToken }));
  return new Request("http://localhost/api/generate-illustration", { method: "POST", headers: { host: "localhost" }, body: form });
}

test("setup", () => {
  __clearAnalysisRecordsForTests();
});

// ===========================================================================
// Angle-specific source selection / no invented angle
// ===========================================================================

test("only the angles a photo was actually submitted for are attempted — front alone produces leftFortyFive/rightFortyFive as 'not_requested', never a fictional generation", async () => {
  const { handle, deps } = await eligibleRecordDeps();
  const calls: { form: FormData }[] = [];
  deps.fetchImpl = (async (_url, init) => {
    calls.push({ form: init!.body as FormData });
    return new Response(JSON.stringify({ data: [{ b64_json: b64(GENERATED) }] }), { status: 200 });
  }) as typeof fetch;
  const res = await handleMultiAngleIllustrationRequest(multiAngleRequest({ analysisId: handle.analysisId, sessionToken: handle.sessionToken }), deps);
  const body = (await res.json()) as { angles: Record<string, { status: string }> };
  assert.equal(body.angles.front.status, "ready");
  assert.equal(body.angles.leftFortyFive.status, "not_requested");
  assert.equal(body.angles.rightFortyFive.status, "not_requested");
  assert.equal(calls.length, 1, "only one image-generation call — for the one angle actually submitted");
});

test("each angle's actual submitted photo bytes reach the provider for THAT angle — front, left and right are never swapped or mixed up", async () => {
  const { handle, deps } = await eligibleRecordDeps();
  const calls: { form: FormData }[] = [];
  deps.fetchImpl = (async (_url, init) => {
    calls.push({ form: init!.body as FormData });
    return new Response(JSON.stringify({ data: [{ b64_json: b64(GENERATED) }] }), { status: 200 });
  }) as typeof fetch;
  await handleMultiAngleIllustrationRequest(multiAngleRequest({ analysisId: handle.analysisId, sessionToken: handle.sessionToken, left: LEFT_SOURCE, right: RIGHT_SOURCE }), deps);
  assert.equal(calls.length, 3);
  const sizesSent = calls.map((c) => (c.form.get("image") as File | null)?.size).sort((a, b) => (a ?? 0) - (b ?? 0));
  assert.deepEqual(sizesSent, [FRONT_SOURCE.length, LEFT_SOURCE.length, RIGHT_SOURCE.length].sort((a, b) => a - b), "each of the three distinct submitted photos reached the provider exactly once, unmixed");
});

// ===========================================================================
// Shared plan across three angles
// ===========================================================================

test("all three angles are generated from the SAME server-computed opportunities (the same record) — the plan cannot vary per angle since it is never rebuilt per angle", async () => {
  const { handle, deps } = await eligibleRecordDeps();
  const promptsPerCall: string[] = [];
  deps.fetchImpl = (async (_url, init) => {
    const form = init!.body as FormData;
    promptsPerCall.push(String(form.get("prompt") ?? ""));
    return new Response(JSON.stringify({ data: [{ b64_json: b64(GENERATED) }] }), { status: 200 });
  }) as typeof fetch;
  await handleMultiAngleIllustrationRequest(multiAngleRequest({ analysisId: handle.analysisId, sessionToken: handle.sessionToken, left: LEFT_SOURCE, right: RIGHT_SOURCE }), deps);
  assert.equal(promptsPerCall.length, 3);
  assert.equal(new Set(promptsPerCall).size, 1, "the exact same prompt (built from the exact same plan) is sent for every angle");
  assert.match(promptsPerCall[0], /expression lines/i);
});

// ===========================================================================
// Partial angle failure
// ===========================================================================

test("if one angle's provider call fails and the others succeed, the failing angle is reported failed while the successful ones are still ready — nothing is invented for the failure", async () => {
  const { handle, deps } = await eligibleRecordDeps();
  // right fails deterministically (by source size) on every attempt; front/left get a working stub.
  const calls: string[] = [];
  deps.fetchImpl = (async (_url, init) => {
    const form = init!.body as FormData;
    const img = form.get("image") as File;
    calls.push(String(img.size));
    if (img.size === RIGHT_SOURCE.length) return new Response("boom", { status: 500 });
    return new Response(JSON.stringify({ data: [{ b64_json: b64(GENERATED) }] }), { status: 200 });
  }) as typeof fetch;
  const res = await handleMultiAngleIllustrationRequest(multiAngleRequest({ analysisId: handle.analysisId, sessionToken: handle.sessionToken, left: LEFT_SOURCE, right: RIGHT_SOURCE }), deps);
  const body = (await res.json()) as { angles: Record<string, { status: string; attempts: number }> };
  assert.equal(body.angles.front.status, "ready");
  assert.equal(body.angles.leftFortyFive.status, "ready");
  assert.equal(body.angles.rightFortyFive.status, "failed");
});

// ===========================================================================
// Retry limit / image job state transitions
// ===========================================================================

test("a transient failure is retried at most once (two attempts total), never endlessly — a second failure marks the angle failed, not retried again", async () => {
  const { handle, deps } = await eligibleRecordDeps();
  let attempts = 0;
  deps.fetchImpl = (async () => {
    attempts++;
    return new Response("boom", { status: 500 });
  }) as typeof fetch;
  const res = await handleMultiAngleIllustrationRequest(multiAngleRequest({ analysisId: handle.analysisId, sessionToken: handle.sessionToken }), deps);
  const body = (await res.json()) as { angles: Record<string, { status: string; attempts: number }> };
  assert.equal(attempts, 2, "exactly one retry — never zero, never more than one");
  assert.equal(body.angles.front.attempts, 2);
  assert.equal(body.angles.front.status, "failed");
});

test("a genuine success on the first attempt is never retried", async () => {
  const { handle, deps } = await eligibleRecordDeps();
  let attempts = 0;
  deps.fetchImpl = (async () => {
    attempts++;
    return new Response(JSON.stringify({ data: [{ b64_json: b64(GENERATED) }] }), { status: 200 });
  }) as typeof fetch;
  const res = await handleMultiAngleIllustrationRequest(multiAngleRequest({ analysisId: handle.analysisId, sessionToken: handle.sessionToken }), deps);
  const body = (await res.json()) as { angles: Record<string, { status: string; attempts: number }> };
  assert.equal(attempts, 1);
  assert.equal(body.angles.front.attempts, 1);
  assert.equal(body.angles.front.status, "ready");
});

test("'not_eligible' and 'unavailable' outcomes are never retried — retrying cannot change eligibility or provider configuration", async () => {
  // A record whose opportunities are real but genuinely not eligible (real calibration, no override) — the honest, default path.
  const handle = (await createAnalysisRecord(realExpressionLinesInput()))!;
  let calls = 0;
  const deps: IllustrationHandlerDeps = { env: ENABLED_ENV, authenticator: async () => ({ subject: "test-user" }), rateLimiter: createMemoryRateLimiter({ limit: 1000 }), logger: () => {}, analysisSessionDeps: { env: {} }, fetchImpl: (async () => { calls++; return new Response(JSON.stringify({ data: [{ b64_json: b64(GENERATED) }] }), { status: 200 }); }) as typeof fetch };
  const res = await handleMultiAngleIllustrationRequest(multiAngleRequest({ analysisId: handle.analysisId, sessionToken: handle.sessionToken }), deps);
  const body = (await res.json()) as { angles: Record<string, { status: string; attempts: number }> };
  assert.equal(body.angles.front.status, "not_eligible");
  assert.equal(body.angles.front.attempts, 1, "not retried");
  assert.equal(calls, 0, "no provider call for an ineligible plan in the first place");
});

// ===========================================================================
// All three fail → honest unavailable state, never fabricated
// ===========================================================================

test("if all three angles fail, every angle is reported failed — never a fabricated image for any of them", async () => {
  const { handle, deps } = await eligibleRecordDeps();
  deps.fetchImpl = (async () => new Response("boom", { status: 500 })) as typeof fetch;
  const res = await handleMultiAngleIllustrationRequest(multiAngleRequest({ analysisId: handle.analysisId, sessionToken: handle.sessionToken, left: LEFT_SOURCE, right: RIGHT_SOURCE }), deps);
  const body = (await res.json()) as { angles: Record<string, { status: string }> };
  assert.deepEqual(Object.values(body.angles).map((a) => a.status), ["failed", "failed", "failed"]);
});

// ===========================================================================
// Server authorization — the multi-angle entry point cannot be bypassed either
// ===========================================================================

test("a made-up analysisId/sessionToken is rejected before any provider call, on the multi-angle endpoint too", async () => {
  let calls = 0;
  const deps: IllustrationHandlerDeps = { env: ENABLED_ENV, authenticator: async () => ({ subject: "t" }), rateLimiter: createMemoryRateLimiter({ limit: 1000 }), logger: () => {}, analysisSessionDeps: { env: {} }, fetchImpl: (async () => { calls++; return new Response("{}"); }) as typeof fetch };
  const res = await handleMultiAngleIllustrationRequest(multiAngleRequest({ analysisId: "nope", sessionToken: "nope" }), deps);
  assert.equal(res.status, 404);
  assert.equal(calls, 0);
});

test("declined consent is refused ONCE, up front — no angle is attempted", async () => {
  const { handle, deps } = await eligibleRecordDeps();
  let calls = 0;
  deps.fetchImpl = (async () => { calls++; return new Response(JSON.stringify({ data: [{ b64_json: b64(GENERATED) }] }), { status: 200 }); }) as typeof fetch;
  const res = await handleMultiAngleIllustrationRequest(multiAngleRequest({ analysisId: handle.analysisId, sessionToken: handle.sessionToken, left: LEFT_SOURCE, right: RIGHT_SOURCE, consent: "declined" }), deps);
  assert.equal(res.status, 403);
  assert.equal(calls, 0);
});

test("the multi-angle handler never reads opportunities/consumerReady/evidence data from the request — same as the single-angle trustedHandler.ts it's built on", () => {
  const src = read("lib/image-generation/multiAngle.ts");
  assert.doesNotMatch(src, /payload\.opportunities|payload\.consumerReady|payload\.evidenceObservationIds/);
  assert.match(src, /generateTrustedIllustrationForPhoto/);
});

test("front photo is required — a request with no front photo at all is rejected before any lookup", async () => {
  const res = await handleMultiAngleIllustrationRequest(multiAngleRequest({ front: null, left: LEFT_SOURCE, analysisId: "x", sessionToken: "y" }), { env: ENABLED_ENV, logger: () => {} });
  assert.equal(res.status, 400);
});

// ===========================================================================
// Calibration behavior remains intact
// ===========================================================================

test("CALIBRATION_STATE remains untouched by this file, and the honest default (no override) path is still not eligible for a real record", () => {
  assert.deepEqual(CALIBRATION_STATE, { expression: false, "facialStructure.contour": false, "eyeArea.underEye": false });
  const src = read("lib/image-generation/multiAngle.ts");
  assert.doesNotMatch(src, /CALIBRATION_STATE\s*[.\[]\s*\w+\s*=/);
  assert.doesNotMatch(src, /calibrated:\s*true/);
});

test("sequential, not parallel: angles are processed one at a time (a running counter never exceeds 1 concurrent call)", async () => {
  const { handle, deps } = await eligibleRecordDeps();
  let inFlight = 0;
  let maxInFlight = 0;
  deps.fetchImpl = (async () => {
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise((r) => setTimeout(r, 5));
    inFlight--;
    return new Response(JSON.stringify({ data: [{ b64_json: b64(GENERATED) }] }), { status: 200 });
  }) as typeof fetch;
  await handleMultiAngleIllustrationRequest(multiAngleRequest({ analysisId: handle.analysisId, sessionToken: handle.sessionToken, left: LEFT_SOURCE, right: RIGHT_SOURCE }), deps);
  assert.equal(maxInFlight, 1, "never more than one image-edit call in flight at once");
});

test("ANGLE_SLOTS names the three supported angles, in front/left/right order", () => {
  assert.deepEqual(ANGLE_SLOTS, ["front", "leftFortyFive", "rightFortyFive"]);
});
