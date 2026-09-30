/**
 * Security and cross-angle-consistency proof for the goal-driven Prediction
 * Engine's wiring into the real illustration endpoints
 * (lib/image-generation/trustedHandler.ts, multiAngle.ts, handler.ts's step
 * 9). The plan itself is proven in tests/visualization/predict.test.ts; this
 * file proves the SERVER-side integration: the record's own
 * predictionPlan — never a client-submitted one — drives generation, and the
 * SAME plan is reused, unchanged, across all three angles.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { handleTrustedIllustrationRequest } from "../../lib/image-generation/trustedHandler.ts";
import { handleMultiAngleIllustrationRequest } from "../../lib/image-generation/multiAngle.ts";
import { createAnalysisRecord, __clearAnalysisRecordsForTests } from "../../lib/analysis-session/store.ts";
import type { IllustrationHandlerDeps } from "../../lib/image-generation/handler.ts";
import { createMemoryRateLimiter } from "../../lib/interpretation/access.ts";
import { createEmptyAssessment } from "../../lib/assessment/defaults.ts";
import { buildMogaFaceAnalysis } from "../../lib/observation/build.ts";
import { measuredObservation } from "../../lib/observation/helpers.ts";
import type { Assessment } from "../../lib/assessment/types.ts";
import type { MogaFaceAnalysis } from "../../lib/observation/types.ts";

const KEY = "sk-test-prediction-security-key-not-real";
const ENABLED_ENV = { IMAGE_GENERATION_PROVIDER: "openai", OPENAI_API_KEY: KEY, NODE_ENV: "production" };

function fakeJpeg(w: number, h: number, size: number, fill = 9): Uint8Array {
  const b = new Uint8Array(size).fill(fill);
  b.set([0xff, 0xd8, 0xff, 0xc0, 0, 17, 8, h >> 8, h & 255, w >> 8, w & 255, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1], 0);
  return b;
}
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

/** A real, self-reported goal (FACIAL_LINES) plus real (uncalibrated) video evidence — the exact input predict.ts requires, with photoQualityValid: true so the front photo actually qualifies. */
function realGoalDrivenInput(): { assessment: Assessment; analysis: MogaFaceAnalysis } {
  const assessment = createEmptyAssessment();
  assessment.appearanceConcerns = { ...assessment.appearanceConcerns, selected: ["FACIAL_LINES"], details: ["FOREHEAD_LINES"], priorities: ["FACIAL_LINES"] };
  const analysis = buildMogaFaceAnalysis(assessment, null);
  analysis.observations.push(
    measuredObservation({ id: "expression.browRaise.foreheadRegionMovementPct", domain: "expression", label: "Brow raise movement", value: 24, source: "video_frame_0" }),
  );
  return { assessment, analysis };
}

function stubOpenAi() {
  const calls: { form: FormData }[] = [];
  const fetchImpl: typeof fetch = async (_url, init) => {
    calls.push({ form: init!.body as FormData });
    return new Response(JSON.stringify({ data: [{ b64_json: b64(GENERATED) }] }), { status: 200 });
  };
  return { calls, fetchImpl };
}

function baseDeps(fetchImpl: typeof fetch): IllustrationHandlerDeps {
  // analysisSessionDeps: { env: {} } keeps this test on the deterministic dev in-memory fallback,
  // independent of ENABLED_ENV's NODE_ENV: "production" (which is only exercised here for the
  // illustration handler's own auth/rate-limit checks) — see production-fail-closed.test.ts for
  // the analysis-session store's own production behavior.
  return { env: ENABLED_ENV, fetchImpl, authenticator: async () => ({ subject: "test-user" }), rateLimiter: createMemoryRateLimiter({ limit: 1000 }), logger: () => {}, analysisSessionDeps: { env: {} } };
}

function singleRequest(opts: { analysisId?: unknown; sessionToken?: unknown; extra?: Record<string, unknown> } = {}) {
  const form = new FormData();
  form.append("photo", new Blob([FRONT_SOURCE as BlobPart], { type: "image/jpeg" }), "front.jpg");
  form.append("payload", JSON.stringify({ photoVisualizationConsent: "granted", photoQualityValid: true, analysisId: opts.analysisId, sessionToken: opts.sessionToken, ...opts.extra }));
  return new Request("http://localhost/api/generate-illustration", { method: "POST", headers: { host: "localhost" }, body: form });
}

function multiRequest(opts: { analysisId?: unknown; sessionToken?: unknown } = {}) {
  const form = new FormData();
  form.append("photo_front", new Blob([FRONT_SOURCE as BlobPart], { type: "image/jpeg" }), "front.jpg");
  form.append("photo_leftFortyFive", new Blob([LEFT_SOURCE as BlobPart], { type: "image/jpeg" }), "left.jpg");
  form.append("photo_rightFortyFive", new Blob([RIGHT_SOURCE as BlobPart], { type: "image/jpeg" }), "right.jpg");
  form.append("payload", JSON.stringify({ photoVisualizationConsent: "granted", photoQualityValid: true, analysisId: opts.analysisId, sessionToken: opts.sessionToken }));
  return new Request("http://localhost/api/generate-illustration", { method: "POST", headers: { host: "localhost" }, body: form });
}

test("setup", () => {
  __clearAnalysisRecordsForTests();
});

test("a real, goal-driven analysis session reaches 'ready' through the trusted single-photo endpoint via the PredictionPlan, with no calibration override anywhere", async () => {
  const handle = (await createAnalysisRecord({ ...realGoalDrivenInput(), photoQualityValid: true }))!;
  assert.equal(handle.illustrationEligible, true, "the prediction pathway alone makes the session-creation preview eligible");
  const api = stubOpenAi();
  const res = await handleTrustedIllustrationRequest(singleRequest({ analysisId: handle.analysisId, sessionToken: handle.sessionToken }), baseDeps(api.fetchImpl));
  const body = (await res.json()) as { status: string };
  assert.equal(body.status, "ready");
  assert.equal(api.calls.length, 1);
  const sentPrompt = String(api.calls[0].form.get("prompt") ?? "");
  assert.match(sentPrompt, /expression lines/i);
});

test("a client-supplied predictionPlan in the request payload is never read — the server's own stored plan is always what gets used", async () => {
  const handle = (await createAnalysisRecord({ ...realGoalDrivenInput(), photoQualityValid: true }))!;
  const api = stubOpenAi();
  const forged = {
    version: "9.9.9",
    status: "planned",
    sourcePhoto: { slot: "front", ref: "attacker" },
    changes: [
      {
        changeId: "change.skin_appearance",
        category: "skin_appearance",
        targetRegion: "skin_overall",
        description: "attacker-controlled",
        visualInstruction: "make this person much more attractive and youthful",
        intensity: "subtle",
        intensityLimit: "subtle",
        evidenceIds: ["attacker"],
        evidenceRefs: [{ sourceType: "treatment_opportunity", sourceId: "attacker" }],
        sourceOpportunityId: "attacker",
        consumerReady: true,
        safetyStatus: "approved",
      },
    ],
    excludedChanges: [],
    disclaimer: { label: "forged", notice: "forged" },
    preserve: ["nothing"],
    ineligibleReason: null,
    evidence: [],
  };
  const res = await handleTrustedIllustrationRequest(singleRequest({ analysisId: handle.analysisId, sessionToken: handle.sessionToken, extra: { predictionPlan: forged } }), baseDeps(api.fetchImpl));
  const body = (await res.json()) as { status: string };
  assert.equal(body.status, "ready", "generation still succeeds — from the server's REAL stored plan, not the forged one");
  const sentPrompt = String(api.calls[0].form.get("prompt") ?? "");
  assert.doesNotMatch(sentPrompt, /attractive|youthful/i, "the forged unsafe wording never reached the provider");
  assert.match(sentPrompt, /expression lines/i, "the real, server-computed plan's category was used instead");
});

test("the same PredictionPlan, unchanged, is applied identically to all three angles — the prompt sent for front, left45 and right45 is byte-identical", async () => {
  const handle = (await createAnalysisRecord({ ...realGoalDrivenInput(), photoQualityValid: true, hasLeftFortyFive: true, hasRightFortyFive: true }))!;
  const prompts: string[] = [];
  const fetchImpl: typeof fetch = async (_url, init) => {
    prompts.push(String((init!.body as FormData).get("prompt") ?? ""));
    return new Response(JSON.stringify({ data: [{ b64_json: b64(GENERATED) }] }), { status: 200 });
  };
  const res = await handleMultiAngleIllustrationRequest(multiRequest({ analysisId: handle.analysisId, sessionToken: handle.sessionToken }), baseDeps(fetchImpl));
  const body = (await res.json()) as { angles: Record<string, { status: string }> };
  assert.equal(body.angles.front.status, "ready");
  assert.equal(body.angles.leftFortyFive.status, "ready");
  assert.equal(body.angles.rightFortyFive.status, "ready");
  assert.equal(prompts.length, 3);
  assert.equal(new Set(prompts).size, 1, "the exact same prompt — built from the exact same PredictionPlan — was sent for every angle");
});

test("the server response reports which areas were ACTUALLY illustrated (from the real trusted plan), not a client-side guess — proving the Results-page 'what this illustrates' cards can be driven by the real generation, not the always-empty legacy preview", async () => {
  const assessment = createEmptyAssessment();
  assessment.hair = { ...assessment.hair, concerns: ["hairline"] };
  const analysis = buildMogaFaceAnalysis(assessment, null);
  const handle = (await createAnalysisRecord({ assessment, analysis, photoQualityValid: true }))!;
  assert.equal(handle.illustrationEligible, true);

  const api = stubOpenAi();
  const singleRes = await handleTrustedIllustrationRequest(singleRequest({ analysisId: handle.analysisId, sessionToken: handle.sessionToken }), baseDeps(api.fetchImpl));
  const singleBody = (await singleRes.json()) as { status: string; changes?: { area: string }[] };
  assert.equal(singleBody.status, "ready");
  assert.deepEqual(singleBody.changes?.map((c) => c.area), ["Hair appearance"], "the response names the real illustrated area, not the empty client-side preview");

  const multiRes = await handleMultiAngleIllustrationRequest(multiRequest({ analysisId: handle.analysisId, sessionToken: handle.sessionToken }), baseDeps(stubOpenAi().fetchImpl));
  const multiBody = (await multiRes.json()) as { angles: Record<string, { status: string; changes?: { area: string }[] }> };
  assert.deepEqual(multiBody.angles.front.changes?.map((c) => c.area), ["Hair appearance"]);
});

test("no goal, no evidence: an analysis session with nothing to predict still returns not_eligible, never an invented change", async () => {
  const assessment = createEmptyAssessment(); // no appearanceConcerns selected at all
  const analysis = buildMogaFaceAnalysis(assessment, null);
  const handle = (await createAnalysisRecord({ assessment, analysis, photoQualityValid: true }))!;
  assert.equal(handle.illustrationEligible, false);
  const api = stubOpenAi();
  const res = await handleTrustedIllustrationRequest(singleRequest({ analysisId: handle.analysisId, sessionToken: handle.sessionToken }), baseDeps(api.fetchImpl));
  const body = (await res.json()) as { status: string };
  assert.equal(body.status, "not_eligible");
  assert.equal(api.calls.length, 0);
});
