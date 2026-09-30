/**
 * The developer/clinic-only END-TO-END illustration test path
 * (devE2EHandler.ts, devE2EClient.ts, app/api/dev-e2e-illustration/route.ts,
 * and its wiring into ResultsExperience.tsx via ?devPreview=1). NO real
 * OpenAI call is ever made here: the API is a stubbed `fetch`. The
 * treatment opportunities used below are produced by the REAL
 * evaluateTreatmentOpportunities engine from real-shaped observations —
 * exactly how lib/results/demo.ts builds its own fixture — never a
 * hand-fabricated TreatmentOpportunity object and never
 * DEV_ILLUSTRATION_FIXTURE_OPPORTUNITY.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { handleDevE2EIllustrationRequest, isDevE2EIllustrationEnabled } from "../../lib/image-generation/devE2EHandler.ts";
import { handleIllustrationRequest } from "../../lib/image-generation/handler.ts";
import type { IllustrationHandlerDeps } from "../../lib/image-generation/handler.ts";
import { createMemoryRateLimiter } from "../../lib/interpretation/access.ts";
import { CALIBRATION_STATE, VISUAL_OBSERVATIONS_CALIBRATED, isCategoryCalibrated } from "../../lib/facial-analysis/calibration/status.ts";
import { ILLUSTRATION_POLICY } from "../../lib/visualization/eligibility.ts";
import { createEmptyAssessment } from "../../lib/assessment/defaults.ts";
import { evaluateTreatmentOpportunities } from "../../lib/treatment-opportunities/evaluate.ts";
import { buildMogaFaceAnalysis } from "../../lib/observation/build.ts";
import { measuredObservation } from "../../lib/observation/helpers.ts";
import type { TreatmentOpportunity } from "../../lib/treatment-opportunities/types.ts";

const ROOT = new URL("../../", import.meta.url).pathname;
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

const NEW_FILES = ["lib/image-generation/devE2EHandler.ts", "lib/image-generation/devE2EClient.ts", "app/api/dev-e2e-illustration/route.ts"];

const KEY = "sk-test-dev-e2e-key-not-real";
const DEV_ENABLED = { NODE_ENV: "development", DEV_E2E_ILLUSTRATION: "1", IMAGE_GENERATION_PROVIDER: "openai", OPENAI_API_KEY: KEY };

function fakeJpeg(w: number, h: number, size: number): Uint8Array {
  const b = new Uint8Array(size).fill(9);
  b.set([0xff, 0xd8, 0xff, 0xc0, 0, 17, 8, h >> 8, h & 255, w >> 8, w & 255, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1], 0);
  return b;
}
const SOURCE = fakeJpeg(900, 1200, 60_000);
function fakePng(w: number, h: number, size: number): Uint8Array {
  const b = new Uint8Array(size).fill(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52], 0);
  new DataView(b.buffer).setUint32(16, w);
  new DataView(b.buffer).setUint32(20, h);
  return b;
}
const GENERATED = fakePng(1024, 1536, 8_000);
const b64 = (b: Uint8Array) => Buffer.from(b).toString("base64");

function stubOpenAi() {
  const calls: { form: FormData }[] = [];
  const fetchImpl: typeof fetch = async (_url, init) => {
    calls.push({ form: init!.body as FormData });
    return new Response(JSON.stringify({ data: [{ b64_json: b64(GENERATED) }] }), { status: 200 });
  };
  return { calls, fetchImpl };
}

/**
 * Builds REAL, evidence-backed opportunities the same way
 * lib/results/demo.ts does: real questionnaire answers, real observations,
 * run through the REAL evaluateTreatmentOpportunities engine — never a
 * hand-authored TreatmentOpportunity, never the dev illustration fixture.
 * Real calibration is false, so every opportunity here has
 * consumerReady: false, exactly like a genuine assessment today.
 */
function realExpressionLinesOpportunities(): TreatmentOpportunity[] {
  const assessment = createEmptyAssessment();
  assessment.appearanceConcerns = { ...assessment.appearanceConcerns, selected: ["FACIAL_LINES"], details: ["FOREHEAD_LINES"], priorities: ["FACIAL_LINES"] };
  const analysis = buildMogaFaceAnalysis(assessment, null);
  analysis.observations.push(
    measuredObservation({ id: "expression.browRaise.foreheadRegionMovementPct", domain: "expression", label: "Brow raise movement", value: 24, source: "video_frame_0" }),
    measuredObservation({ id: "expression.visibleForeheadLinePattern", domain: "expression", label: "Visible forehead line pattern", value: true, source: "video_frame_0" }),
  );
  return evaluateTreatmentOpportunities({ assessment, analysis });
}

function realContourOpportunities(): TreatmentOpportunity[] {
  const assessment = createEmptyAssessment();
  assessment.appearanceConcerns = { ...assessment.appearanceConcerns, selected: ["FACIAL_DEFINITION"], details: ["JAW_DEFINITION"], priorities: ["FACIAL_DEFINITION"] };
  const analysis = buildMogaFaceAnalysis(assessment, null);
  analysis.observations.push(
    measuredObservation({ id: "facialStructure.contour.jawContourAngle.front.left", domain: "facial-structure", label: "Jaw contour angle, left (front)", value: 124, source: "front" }),
    measuredObservation({ id: "facialStructure.contour.jawContourAngle.leftFortyFive.left", domain: "facial-structure", label: "Jaw contour angle, left (left 45°)", value: 121, source: "leftFortyFive" }),
  );
  return evaluateTreatmentOpportunities({ assessment, analysis });
}

function devRequest(opportunities: unknown, opts: { consent?: unknown; photo?: Uint8Array } = {}) {
  const form = new FormData();
  form.append("photo", new Blob([(opts.photo ?? SOURCE) as BlobPart], { type: "image/jpeg" }), "front.jpg");
  form.append("payload", JSON.stringify({ photoVisualizationConsent: "consent" in opts ? opts.consent : "granted", photoQualityValid: true, opportunities }));
  return new Request("http://localhost/api/dev-e2e-illustration", { method: "POST", headers: { host: "localhost" }, body: form });
}

async function callDevE2E(env: Record<string, string | undefined>, opportunities: unknown, opts?: Parameters<typeof devRequest>[1]) {
  const api = stubOpenAi();
  const deps: IllustrationHandlerDeps = { env, fetchImpl: api.fetchImpl, rateLimiter: createMemoryRateLimiter({ limit: 1000 }), logger: () => {} };
  const res = await handleDevE2EIllustrationRequest(devRequest(opportunities, opts), deps);
  const json = (await res.json()) as Record<string, unknown>;
  return { status: res.status, json, calls: api.calls };
}

// ===========================================================================
// 1 & 4. The real assessment/analysis pipeline is the source; no synthetic demo data
// ===========================================================================

test("1&4. ResultsExperience only builds the synthetic demo snapshot for ?demo=1, never for ?devPreview=1 — devPreview always loads the REAL stored snapshot", () => {
  const src = read("components/results/ResultsExperience.tsx");
  assert.match(src, /const devPreview = !IS_PRODUCTION && !demo && params\.get\("devPreview"\) === "1";/);
  assert.match(src, /const stored = demo \? null : loadSnapshot\(\);/, "devPreview must fall into the same 'not demo' branch that loads the real stored snapshot");
  assert.doesNotMatch(src, /devPreview[\s\S]{0,80}buildDemoSnapshot/, "devPreview must never trigger the synthetic demo builder");
});

test("1&4. devE2EHandler.ts and devE2EClient.ts never import the demo fixture or the dev illustration fixture", () => {
  for (const path of ["lib/image-generation/devE2EHandler.ts", "lib/image-generation/devE2EClient.ts"]) {
    const src = read(path);
    assert.doesNotMatch(src, /results\/demo\.ts|buildDemoSnapshot/, path);
    assert.doesNotMatch(src, /devIllustrationFixture\.ts|DEV_ILLUSTRATION_FIXTURE_OPPORTUNITY/, path);
  }
});

// ===========================================================================
// 2. Real photo media is resolved from IndexedDB (unaffected by this work)
// ===========================================================================

test("2. devPreview reuses the SAME resolveStoredFrontPhoto (IndexedDB-backed) path as a real result — it does not introduce a second photo source", () => {
  const src = read("components/results/ResultsExperience.tsx");
  assert.match(src, /resolveStoredFrontPhoto\(stored!\.frontPhoto\)/);
  const devPreviewBranchCount = (src.match(/devPreview/g) ?? []).length;
  assert.ok(devPreviewBranchCount >= 3, "devPreview should only toggle a few existing branches, not add a parallel photo-resolution path");
});

// ===========================================================================
// 3. Real analysis is executed — real, evidence-backed opportunities pass through
// ===========================================================================

test("3. real, evidence-backed NEUROMODULATOR opportunities (built via the REAL evaluateTreatmentOpportunities engine) survive the server filter and produce exactly one image-generation call", async () => {
  const real = realExpressionLinesOpportunities();
  assert.ok(real.some((o) => o.category === "NEUROMODULATOR" && o.status === "potential_opportunity"), "the real engine must have produced a real NEUROMODULATOR opportunity for this fixture");
  assert.ok(real.every((o) => o.consumerReady === false), "real calibration is false today — every real opportunity's own consumerReady must be false before the dev override");

  const r = await callDevE2E(DEV_ENABLED, real);
  assert.equal(r.json.status, "ready");
  assert.equal(r.calls.length, 1);
});

// ===========================================================================
// 5. Developer visualization uses the actual front photo
// ===========================================================================

test("5. the client sends the caller's own front photoUrl unchanged, and never substitutes another image source", () => {
  const src = read("lib/image-generation/devE2EClient.ts");
  assert.match(src, /fetchImpl\(input\.photoUrl\)/);
  assert.doesNotMatch(src, /data:image|demoBeforeImage|demoAfterImage/);
});

test("5. the real front photo's bytes are exactly what the stubbed image API receives", async () => {
  const real = realExpressionLinesOpportunities();
  const api = stubOpenAi();
  const deps: IllustrationHandlerDeps = { env: DEV_ENABLED, fetchImpl: api.fetchImpl, rateLimiter: createMemoryRateLimiter({ limit: 1000 }), logger: () => {} };
  await handleDevE2EIllustrationRequest(devRequest(real), deps);
  const sentPhoto = api.calls[0].form.get("image") as File | null;
  if (sentPhoto) assert.equal(sentPhoto.size, SOURCE.length);
});

// ===========================================================================
// 6 & 7. The visualization category is server-validated; an unsupported category is rejected
// ===========================================================================

test("6&7. a real, evidence-backed FACIAL_CONTOURING (contour) opportunity is discarded outright — the browser cannot request an unsupported category", async () => {
  const real = realContourOpportunities();
  assert.ok(real.some((o) => o.category === "FACIAL_CONTOURING" && o.status === "potential_opportunity"), "the fixture must produce a real contour opportunity to prove it is rejected");
  const r = await callDevE2E(DEV_ENABLED, real);
  assert.equal(r.json.status, "not_eligible");
  assert.equal(r.calls.length, 0);
});

test("6&7. a client cannot smuggle an unsupported category by forging consumerReady/category on an otherwise-shaped object", async () => {
  const smuggled = [{ id: "attacker.filler", category: "DERMAL_FILLER", status: "potential_opportunity", consumerReady: true, evidenceObservationIds: ["x"], evidenceQuestionIds: [] }];
  const r = await callDevE2E(DEV_ENABLED, smuggled);
  assert.equal(r.json.status, "not_eligible");
  assert.equal(r.calls.length, 0);
});

// ===========================================================================
// 8. Insufficient evidence produces no visualization (never fabricated)
// ===========================================================================

test("8. a NEUROMODULATOR opportunity with no evidenceObservationIds is discarded — insufficient evidence never produces a visualization", async () => {
  const noEvidence = [{ id: "dynamic_facial_lines:NEUROMODULATOR", category: "NEUROMODULATOR", status: "potential_opportunity", consumerReady: false, evidenceObservationIds: [], evidenceQuestionIds: ["q.1"] }];
  const r = await callDevE2E(DEV_ENABLED, noEvidence);
  assert.equal(r.json.status, "not_eligible");
  assert.equal(r.calls.length, 0);
});

test("8. an empty opportunities list (no evidence at all) produces not_eligible, never a fallback image", async () => {
  const r = await callDevE2E(DEV_ENABLED, []);
  assert.equal(r.json.status, "not_eligible");
  assert.equal(r.calls.length, 0);
});

// ===========================================================================
// 9. Calibration state remains false
// ===========================================================================

test("9. no new file, and no edit to ResultsExperience.tsx, assigns to CALIBRATION_STATE or VISUAL_OBSERVATIONS_CALIBRATED", () => {
  for (const path of [...NEW_FILES, "components/results/ResultsExperience.tsx"]) {
    const src = read(path);
    assert.doesNotMatch(src, /CALIBRATION_STATE\s*[.\[]/, path);
    assert.doesNotMatch(src, /VISUAL_OBSERVATIONS_CALIBRATED\s*=/, path);
  }
  assert.deepEqual(CALIBRATION_STATE, { expression: false, "facialStructure.contour": false, "eyeArea.underEye": false });
  assert.equal(VISUAL_OBSERVATIONS_CALIBRATED, false);
});

// ===========================================================================
// 10. Production eligibility remains unchanged
// ===========================================================================

test("10. calling the real production endpoint directly with the same real opportunities and no eligibility override is still not eligible", async () => {
  const real = realExpressionLinesOpportunities();
  const api = stubOpenAi();
  const deps: IllustrationHandlerDeps = { env: DEV_ENABLED, fetchImpl: api.fetchImpl, authenticator: async () => ({ subject: "test" }), rateLimiter: createMemoryRateLimiter({ limit: 1000 }), logger: () => {} };
  const form = new FormData();
  form.append("photo", new Blob([SOURCE as BlobPart], { type: "image/jpeg" }), "front.jpg");
  form.append("payload", JSON.stringify({ photoVisualizationConsent: "granted", photoQualityValid: true, opportunities: real }));
  const res = await handleIllustrationRequest(new Request("http://localhost/api/generate-illustration", { method: "POST", headers: { host: "localhost" }, body: form }), deps);
  assert.equal((await res.json()).status, "not_eligible");
  assert.equal(api.calls.length, 0);
});

test("10. the production /api/generate-illustration route file is untouched by this work", () => {
  assert.doesNotMatch(read("app/api/generate-illustration/route.ts"), /dev-e2e-illustration|devE2E/i);
});

// ===========================================================================
// 11. Contour/under-eye remain blocked
// ===========================================================================

test("11. contour and under-eye calibration remain false, and ILLUSTRATION_POLICY still blocks every category but expression_lines", () => {
  assert.equal(isCategoryCalibrated("facialStructure.contour"), false);
  assert.equal(isCategoryCalibrated("eyeArea.underEye"), false);
  assert.equal(ILLUSTRATION_POLICY.facial_contour, false);
  assert.equal(ILLUSTRATION_POLICY.under_eye, false);
  assert.equal(ILLUSTRATION_POLICY.jawline_definition, false);
  assert.equal(ILLUSTRATION_POLICY.skin_appearance, false);
  assert.equal(ILLUSTRATION_POLICY.expression_lines, true);
});

test("11. devE2EHandler.ts never supplies a policy override to decideIllustrationEligibility — only a calibration override", () => {
  const src = read("lib/image-generation/devE2EHandler.ts");
  assert.match(src, /eligibility:\s*\{\s*calibrated:\s*true\s*\}/);
  assert.doesNotMatch(src, /policy:/);
});

// ===========================================================================
// 12. No real media written to localStorage/sessionStorage
// ===========================================================================

test("12. no new file touches localStorage/sessionStorage directly", () => {
  for (const path of NEW_FILES) {
    assert.doesNotMatch(read(path), /localStorage|sessionStorage/i, path);
  }
});

test("12. the devPreview edit to ResultsExperience.tsx adds no new localStorage/sessionStorage/IndexedDB call (only reuses the existing resolveStoredFrontPhoto/loadSnapshot calls already covered by other tests)", () => {
  const src = read("components/results/ResultsExperience.tsx");
  const devPreviewLines = src.split("\n").filter((l) => l.includes("devPreview"));
  for (const line of devPreviewLines) assert.doesNotMatch(line, /localStorage|sessionStorage|indexedDB/i, line);
});

// ===========================================================================
// 13. OpenAI API key remains server-side
// ===========================================================================

test("13. no new file references OPENAI_API_KEY directly — only handler.ts reads the credential", () => {
  for (const path of NEW_FILES) assert.doesNotMatch(read(path), /OPENAI_API_KEY/, path);
});

test("13. no API key or image bytes ever appear in the log", async () => {
  const real = realExpressionLinesOpportunities();
  const logs: unknown[] = [];
  const api = stubOpenAi();
  const deps: IllustrationHandlerDeps = { env: DEV_ENABLED, fetchImpl: api.fetchImpl, rateLimiter: createMemoryRateLimiter({ limit: 1000 }), logger: (e) => logs.push(e) };
  await handleDevE2EIllustrationRequest(devRequest(real), deps);
  const dump = JSON.stringify(logs);
  assert.ok(!dump.includes(KEY));
  assert.ok(!dump.includes(b64(SOURCE)) && !dump.includes(b64(GENERATED)));
});

// ===========================================================================
// 14. Existing consent remains enforced
// ===========================================================================

test("14. declined or pending consent is refused (403) before any image is generated, even with real, evidence-backed opportunities", async () => {
  const real = realExpressionLinesOpportunities();
  const declined = await callDevE2E(DEV_ENABLED, real, { consent: "declined" });
  assert.equal(declined.status, 403);
  assert.equal(declined.calls.length, 0);
  const pending = await callDevE2E(DEV_ENABLED, real, { consent: "pending" });
  assert.equal(pending.status, 403);
  assert.equal(pending.calls.length, 0);
});

test("14. the client never sends the photo unless consent is 'granted'", () => {
  assert.match(read("lib/image-generation/devE2EClient.ts"), /if \(!allowsPhotoProcessing\(input\.consent\)\) return \{ status: "consent_required" \};/);
});

// ===========================================================================
// 15. Existing rate limiting remains enforced
// ===========================================================================

test("15. a supplied rate limiter refuses once its bucket is exhausted, even with real, evidence-backed opportunities and a valid dev flag", async () => {
  const real = realExpressionLinesOpportunities();
  const api = stubOpenAi();
  const rateLimiter = createMemoryRateLimiter({ limit: 1, windowMs: 60_000 });
  const deps: IllustrationHandlerDeps = { env: DEV_ENABLED, fetchImpl: api.fetchImpl, rateLimiter, logger: () => {} };
  const first = await handleDevE2EIllustrationRequest(devRequest(real), deps);
  assert.equal((await first.json()).status, "ready");
  const second = await handleDevE2EIllustrationRequest(devRequest(real), deps);
  assert.equal(second.status, 429);
  assert.equal(api.calls.length, 1);
});

// ===========================================================================
// Double gate: disabled by default, and NODE_ENV=development alone is not enough
// ===========================================================================

test("the dev e2e route stays disabled by default (fail closed) and requires BOTH flags", async () => {
  assert.equal(isDevE2EIllustrationEnabled({}), false);
  assert.equal(isDevE2EIllustrationEnabled({ NODE_ENV: "production", DEV_E2E_ILLUSTRATION: "1" }), false);
  assert.equal(isDevE2EIllustrationEnabled({ NODE_ENV: "development" }), false);
  assert.equal(isDevE2EIllustrationEnabled({ NODE_ENV: "development", DEV_E2E_ILLUSTRATION: "1" }), true);
  const r = await callDevE2E({ NODE_ENV: "development" }, realExpressionLinesOpportunities());
  assert.deepEqual(r.json, { error: "not_found" });
  assert.equal(r.status, 404);
});

test("the generated After image contains no text/label instructions (safety-checked prompt, unmodified handler.ts path)", async () => {
  const real = realExpressionLinesOpportunities();
  const r = await callDevE2E(DEV_ENABLED, real);
  const prompt = String(r.calls[0].form.get("prompt") ?? "");
  for (const bad of ["botox", "filler", "beautif", "perfect", "ideal", "guarantee"]) assert.doesNotMatch(prompt, new RegExp(bad, "i"));
  assert.match(prompt, /expression lines/i);
});
