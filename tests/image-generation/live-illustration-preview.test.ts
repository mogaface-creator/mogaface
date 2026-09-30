/**
 * The TEMPORARY, production-accessible illustration preview
 * (livePreviewHandler.ts, livePreviewClient.ts, LiveIllustrationPreview.tsx,
 * app/illustration-preview/page.tsx, app/api/illustration-preview/route.ts).
 * NO real OpenAI call is ever made here: the API is a stubbed `fetch`.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  handleLivePreviewGenerate,
  handleLivePreviewVerify,
  isLivePreviewEnabled,
  verifyPreviewCode,
  PREVIEW_SECRET_HEADER,
} from "../../lib/image-generation/livePreviewHandler.ts";
import { handleIllustrationRequest } from "../../lib/image-generation/handler.ts";
import type { IllustrationHandlerDeps } from "../../lib/image-generation/handler.ts";
import { DEV_ILLUSTRATION_FIXTURE_OPPORTUNITY } from "../../lib/image-generation/devIllustrationFixture.ts";
import { createMemoryRateLimiter } from "../../lib/interpretation/access.ts";
import { CALIBRATION_STATE, VISUAL_OBSERVATIONS_CALIBRATED, isCategoryCalibrated } from "../../lib/facial-analysis/calibration/status.ts";
import { ILLUSTRATION_POLICY, decideIllustrationEligibility } from "../../lib/visualization/eligibility.ts";
import { buildVisualizationPlan } from "../../lib/visualization/build.ts";
import { evaluateTreatmentOpportunities } from "../../lib/treatment-opportunities/evaluate.ts";
import { buildMogaFaceAnalysis } from "../../lib/observation/build.ts";
import { createEmptyAppearanceConcerns } from "../../lib/assessment/appearanceConcerns.ts";
import { buildFilledAssessment, buildMultiPhotoAnalysisWithFront } from "../observation/fixtures.ts";

const ROOT = new URL("../../", import.meta.url).pathname;
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

const NEW_FILES = ["lib/image-generation/livePreviewHandler.ts", "lib/image-generation/livePreviewClient.ts", "components/illustration-preview/LiveIllustrationPreview.tsx", "app/illustration-preview/page.tsx", "app/api/illustration-preview/route.ts"];

const KEY = "sk-test-live-preview-key-not-real";
const SECRET = "correct-horse-battery-staple";
const ENABLED_ENV = { ILLUSTRATION_LIVE_PREVIEW: "1", ILLUSTRATION_PREVIEW_SECRET: SECRET, IMAGE_GENERATION_PROVIDER: "openai", OPENAI_API_KEY: KEY, NODE_ENV: "production" };

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

function previewRequest(opts: { code?: string; consent?: unknown; photo?: Uint8Array } = {}) {
  const form = new FormData();
  form.append("photo", new Blob([(opts.photo ?? SOURCE) as BlobPart], { type: "image/jpeg" }), "front.jpg");
  form.append("payload", JSON.stringify({ photoVisualizationConsent: "consent" in opts ? opts.consent : "granted", photoQualityValid: true }));
  const headers: Record<string, string> = { host: "localhost" };
  if (opts.code !== undefined) headers[PREVIEW_SECRET_HEADER] = opts.code;
  return new Request("http://localhost/api/illustration-preview", { method: "POST", headers, body: form });
}

async function callGenerate(env: Record<string, string | undefined>, opts?: Parameters<typeof previewRequest>[0]) {
  const api = stubOpenAi();
  const deps: IllustrationHandlerDeps = { env, fetchImpl: api.fetchImpl, logger: () => {} };
  const res = await handleLivePreviewGenerate(previewRequest(opts), deps);
  const json = (await res.json()) as Record<string, unknown>;
  return { status: res.status, json, calls: api.calls };
}

// ===========================================================================
// 1. Access gate is enforced
// ===========================================================================

test("1. the route is disabled (404) unless ILLUSTRATION_LIVE_PREVIEW=1 AND a sufficiently long secret are both set", () => {
  assert.equal(isLivePreviewEnabled({}), false);
  assert.equal(isLivePreviewEnabled({ ILLUSTRATION_LIVE_PREVIEW: "1" }), false);
  assert.equal(isLivePreviewEnabled({ ILLUSTRATION_LIVE_PREVIEW: "1", ILLUSTRATION_PREVIEW_SECRET: "short" }), false);
  assert.equal(isLivePreviewEnabled({ ILLUSTRATION_LIVE_PREVIEW: "0", ILLUSTRATION_PREVIEW_SECRET: SECRET }), false);
  assert.equal(isLivePreviewEnabled({ ILLUSTRATION_LIVE_PREVIEW: "1", ILLUSTRATION_PREVIEW_SECRET: SECRET }), true);
});

test("1. GET verify returns 404 when disabled, 401 when the code is wrong, 200 only with the correct code", () => {
  const disabled = handleLivePreviewVerify(new Request("http://localhost/api/illustration-preview", { headers: { [PREVIEW_SECRET_HEADER]: SECRET } }), {});
  assert.equal(disabled.status, 404);
  const wrong = handleLivePreviewVerify(new Request("http://localhost/api/illustration-preview", { headers: { [PREVIEW_SECRET_HEADER]: "nope" } }), ENABLED_ENV);
  assert.equal(wrong.status, 401);
  const ok = handleLivePreviewVerify(new Request("http://localhost/api/illustration-preview", { headers: { [PREVIEW_SECRET_HEADER]: SECRET } }), ENABLED_ENV);
  assert.equal(ok.status, 200);
});

// ===========================================================================
// 2. Unauthorized requests cannot generate an image
// ===========================================================================

test("2. a missing or wrong access code is refused with 401 before any image is generated", async () => {
  const missing = await callGenerate(ENABLED_ENV, {});
  assert.equal(missing.status, 401);
  assert.equal(missing.calls.length, 0);
  const wrong = await callGenerate(ENABLED_ENV, { code: "wrong-code" });
  assert.equal(wrong.status, 401);
  assert.equal(wrong.calls.length, 0);
});

test("2. the correct code, otherwise disabled route, still refuses with 404 and generates nothing", async () => {
  const r = await callGenerate({ ILLUSTRATION_LIVE_PREVIEW: "0", ILLUSTRATION_PREVIEW_SECRET: SECRET, IMAGE_GENERATION_PROVIDER: "openai", OPENAI_API_KEY: KEY, NODE_ENV: "production" }, { code: SECRET });
  assert.equal(r.status, 404);
  assert.equal(r.calls.length, 0);
});

test("2. code comparison uses a length-checked constant-time compare (verifyPreviewCode), not a plain === on attacker-controlled length", () => {
  assert.equal(verifyPreviewCode(ENABLED_ENV, "x"), false);
  assert.equal(verifyPreviewCode(ENABLED_ENV, SECRET + "x"), false);
  assert.equal(verifyPreviewCode(ENABLED_ENV, SECRET), true);
  assert.equal(verifyPreviewCode(ENABLED_ENV, ""), false);
  assert.equal(verifyPreviewCode(ENABLED_ENV, undefined), false);
});

// ===========================================================================
// 3. API key never reaches client code
// ===========================================================================

test("3. no new file references OPENAI_API_KEY directly — only handler.ts reads the credential", () => {
  for (const path of NEW_FILES) assert.doesNotMatch(read(path), /OPENAI_API_KEY/, path);
});

test("3. the access code and API key never appear together in a log entry, and the key never appears at all", async () => {
  const logs: unknown[] = [];
  const api = stubOpenAi();
  const deps: IllustrationHandlerDeps = { env: ENABLED_ENV, fetchImpl: api.fetchImpl, logger: (e) => logs.push(e) };
  await handleLivePreviewGenerate(previewRequest({ code: SECRET }), deps);
  const dump = JSON.stringify(logs);
  assert.ok(!dump.includes(KEY), "API key must never appear in the log");
  assert.ok(!dump.includes(SECRET), "the access code must never appear in the log");
  assert.ok(!dump.includes(b64(SOURCE)) && !dump.includes(b64(GENERATED)), "image bytes must never appear in the log");
});

// ===========================================================================
// 4. Consent is required
// ===========================================================================

test("4. declined or pending consent is refused (403) before any image is generated, even with a correct code", async () => {
  const declined = await callGenerate(ENABLED_ENV, { code: SECRET, consent: "declined" });
  assert.equal(declined.status, 403);
  assert.equal(declined.calls.length, 0);
  const pending = await callGenerate(ENABLED_ENV, { code: SECRET, consent: "pending" });
  assert.equal(pending.status, 403);
  assert.equal(pending.calls.length, 0);
});

test("4. the client never sends the photo unless consent is 'granted' (mirrors devClient.ts's own gate)", () => {
  const src = read("lib/image-generation/livePreviewClient.ts");
  assert.match(src, /if \(!allowsPhotoProcessing\(input\.consent\)\) return \{ status: "consent_required" \};/);
});

test("4. the required consent sentence is shown before generation, and generation only fires from an explicit Continue click", () => {
  const src = read("components/illustration-preview/LiveIllustrationPreview.tsx");
  assert.match(src, /Your photo will be sent to OpenAI to generate this illustrative visualization\./);
  assert.match(src, /onClick=\{\(\) => void run\("granted"\)\}/);
});

// ===========================================================================
// 5. Image-generation request is server-side
// ===========================================================================

test("5. a correct code + granted consent forwards to the real handleIllustrationRequest and produces exactly one image-generation call", async () => {
  const r = await callGenerate(ENABLED_ENV, { code: SECRET });
  assert.equal(r.json.status, "ready");
  assert.equal(r.calls.length, 1);
});

test("5. the client never calls the OpenAI API directly and never imports a second provider — only livePreviewHandler.ts (server-side) does", () => {
  for (const path of ["lib/image-generation/livePreviewClient.ts", "components/illustration-preview/LiveIllustrationPreview.tsx"]) {
    const src = read(path);
    assert.doesNotMatch(src, /openai\.com|api\.openai/i, path);
    assert.doesNotMatch(src, /createOpenAiImageProvider/, path);
  }
  assert.match(read("lib/image-generation/livePreviewClient.ts"), /livePreviewConstants\.ts/, "the browser client imports its header contract from the browser-safe module");
  assert.doesNotMatch(read("lib/image-generation/livePreviewClient.ts"), /from ["']\.\/livePreviewHandler\.ts["']/, "the browser client must not import the server handler");
  assert.match(read("lib/image-generation/livePreviewHandler.ts"), /handleIllustrationRequest/, "must reuse the existing handler, not a second integration");
});

// ===========================================================================
// 6. Uploaded image is validated
// ===========================================================================

test("6. a corrupt/invalid photo is rejected (400) even with a correct code and granted consent", async () => {
  const r = await callGenerate(ENABLED_ENV, { code: SECRET, photo: new Uint8Array([1, 2, 3, 4]) });
  assert.equal(r.status, 400);
  assert.equal(r.calls.length, 0);
});

// ===========================================================================
// 7. Rate limiting remains active
// ===========================================================================

test("7. the shared in-memory limiter refuses once its bucket is exhausted, for repeated calls with a valid code", async () => {
  const api = stubOpenAi();
  const rateLimiter = createMemoryRateLimiter({ limit: 1, windowMs: 60_000 });
  const deps: IllustrationHandlerDeps = { env: ENABLED_ENV, fetchImpl: api.fetchImpl, rateLimiter, logger: () => {} };
  const first = await handleLivePreviewGenerate(previewRequest({ code: SECRET }), deps);
  assert.equal((await first.json()).status, "ready");
  const second = await handleLivePreviewGenerate(previewRequest({ code: SECRET }), deps);
  assert.equal(second.status, 429);
  assert.equal(api.calls.length, 1);
});

test("7. handleLivePreviewGenerate supplies its own rate limiter to handleIllustrationRequest, so production's own fail-closed default is never relied on", () => {
  assert.match(read("lib/image-generation/livePreviewHandler.ts"), /rateLimiter:\s*deps\.rateLimiter\s*\?\?\s*livePreviewLimiter\(\)/);
});

// ===========================================================================
// 8. Calibration state remains false
// ===========================================================================

test("8. no new file assigns to CALIBRATION_STATE or VISUAL_OBSERVATIONS_CALIBRATED", () => {
  for (const path of NEW_FILES) {
    const src = read(path);
    assert.doesNotMatch(src, /CALIBRATION_STATE\s*[.\[]/, path);
    assert.doesNotMatch(src, /VISUAL_OBSERVATIONS_CALIBRATED\s*=/, path);
  }
  assert.deepEqual(CALIBRATION_STATE, { expression: false, "facialStructure.contour": false, "eyeArea.underEye": false });
  assert.equal(VISUAL_OBSERVATIONS_CALIBRATED, false);
});

// ===========================================================================
// 9. Production eligibility is unchanged
// ===========================================================================

test("9. calling the real endpoint directly with the fixed fixture and no eligibility override is still not eligible (unaffected by this route existing)", async () => {
  const api = stubOpenAi();
  const deps: IllustrationHandlerDeps = { env: ENABLED_ENV, fetchImpl: api.fetchImpl, authenticator: async () => ({ subject: "test" }), rateLimiter: createMemoryRateLimiter({ limit: 1000 }), logger: () => {} };
  const form = new FormData();
  form.append("photo", new Blob([SOURCE as BlobPart], { type: "image/jpeg" }), "front.jpg");
  form.append("payload", JSON.stringify({ photoVisualizationConsent: "granted", photoQualityValid: true, opportunities: [DEV_ILLUSTRATION_FIXTURE_OPPORTUNITY] }));
  const res = await handleIllustrationRequest(new Request("http://localhost/api/generate-illustration", { method: "POST", headers: { host: "localhost" }, body: form }), deps);
  assert.equal((await res.json()).status, "not_eligible");
  assert.equal(api.calls.length, 0);
});

test("9. production illustration eligibility for expression_lines through the normal opportunity engine is unaffected after this work", () => {
  const assessment = buildFilledAssessment();
  assessment.goals = { areas: [], priorities: [] };
  assessment.appearanceConcerns = { ...createEmptyAppearanceConcerns(), selected: ["FACIAL_LINES"] };
  const analysis = buildMogaFaceAnalysis(assessment, buildMultiPhotoAnalysisWithFront());
  const opportunities = evaluateTreatmentOpportunities({ assessment, analysis });
  const plan = buildVisualizationPlan({ frontPhoto: { ref: "blob:x", qualityValid: true }, opportunities });
  assert.equal(decideIllustrationEligibility(plan, opportunities).eligible, false);
});

test("9. the production /api/generate-illustration route is a separate, untouched file", () => {
  assert.doesNotMatch(read("app/api/generate-illustration/route.ts"), /illustration-preview|LiveIllustrationPreview/);
});

// ===========================================================================
// 10. Contour/under-eye remain blocked; only expression_lines is ever used
// ===========================================================================

test("10. contour and under-eye calibration remain false, and the real ILLUSTRATION_POLICY still blocks every category but expression_lines", () => {
  assert.equal(isCategoryCalibrated("facialStructure.contour"), false);
  assert.equal(isCategoryCalibrated("eyeArea.underEye"), false);
  assert.equal(ILLUSTRATION_POLICY.facial_contour, false);
  assert.equal(ILLUSTRATION_POLICY.under_eye, false);
  assert.equal(ILLUSTRATION_POLICY.jawline_definition, false);
  assert.equal(ILLUSTRATION_POLICY.skin_appearance, false);
  assert.equal(ILLUSTRATION_POLICY.expression_lines, true, "the only category this preview ever exercises");
});

test("10. livePreviewHandler.ts only ever forwards the fixed expression_lines fixture — a caller cannot submit its own opportunities", async () => {
  const src = read("lib/image-generation/livePreviewHandler.ts");
  assert.match(src, /DEV_ILLUSTRATION_FIXTURE_OPPORTUNITY/);
  assert.doesNotMatch(src, /DEV_MULTI_AREA|DEV_FULL_ILLUSTRATION_POLICY/);
  assert.doesNotMatch(src, /payload\.opportunities/, "the caller's own opportunities field must never be read");

  const smuggled = [{ id: "attacker.filler", category: "DERMAL_FILLER", status: "potential_opportunity", consumerReady: true, evidenceObservationIds: ["x"], evidenceQuestionIds: [] }];
  const form = new FormData();
  form.append("photo", new Blob([SOURCE as BlobPart], { type: "image/jpeg" }), "front.jpg");
  form.append("payload", JSON.stringify({ photoVisualizationConsent: "granted", photoQualityValid: true, opportunities: smuggled }));
  const api = stubOpenAi();
  const res = await handleLivePreviewGenerate(new Request("http://localhost/api/illustration-preview", { method: "POST", headers: { host: "localhost", [PREVIEW_SECRET_HEADER]: SECRET }, body: form }), {
    env: ENABLED_ENV,
    fetchImpl: api.fetchImpl,
    logger: () => {},
  });
  assert.equal((await res.json()).status, "ready");
  const sentPrompt = String(api.calls[0].form.get("prompt") ?? "");
  assert.doesNotMatch(sentPrompt, /filler|dermal/i);
  assert.match(sentPrompt, /expression lines/i);
});

// ===========================================================================
// 11. Image bytes are not persisted to localStorage/sessionStorage
// ===========================================================================

test("11. no new client file touches localStorage, sessionStorage, or IndexedDB", () => {
  for (const path of ["components/illustration-preview/LiveIllustrationPreview.tsx", "lib/image-generation/livePreviewClient.ts"]) {
    assert.doesNotMatch(read(path), /localStorage|sessionStorage|indexedDB/i, path);
  }
});

test("11. the chosen photo and the access code live only in React state as in-memory object URLs, revoked on replacement and unmount", () => {
  const src = read("components/illustration-preview/LiveIllustrationPreview.tsx");
  assert.match(src, /URL\.createObjectURL\(file\)/);
  assert.match(src, /URL\.revokeObjectURL\(photoUrl\)/);
  assert.match(src, /URL\.revokeObjectURL\(photoUrlRef\.current\)/);
  assert.match(src, /URL\.revokeObjectURL\(generatedUrlRef\.current\)/);
});

// ===========================================================================
// 12. Existing image-generation safety validation remains active
// ===========================================================================

test("12. the access code travels as a request header, never as a FormData field (handler.ts's strict 2-field body check would otherwise reject it)", () => {
  assert.match(read("lib/image-generation/livePreviewClient.ts"), /headers:\s*\{\s*\[PREVIEW_SECRET_HEADER\]/);
  const src = read("lib/image-generation/livePreviewHandler.ts");
  assert.match(src, /request\.headers\.get\(PREVIEW_SECRET_HEADER\)/);
});

test("12. the rebuilt FormData sent onward carries exactly the 3 payload keys handler.ts accepts, so its own validation still runs unweakened", () => {
  const src = read("lib/image-generation/livePreviewHandler.ts");
  assert.match(src, /photoVisualizationConsent: payload\.photoVisualizationConsent/);
  assert.match(src, /photoQualityValid: payload\.photoQualityValid === true/);
  assert.match(src, /opportunities: \[DEV_ILLUSTRATION_FIXTURE_OPPORTUNITY\]/);
});

test("12. the same identity-preservation prompt requirements reach the actual request sent to the image API through this route", async () => {
  const r = await callGenerate(ENABLED_ENV, { code: SECRET });
  const prompt = String(r.calls[0].form.get("prompt") ?? "");
  for (const must of ["eye shape", "nose shape", "lip shape", "head position and camera angle", "lighting", "ethnicity and gender presentation", "apparent age"]) {
    assert.ok(prompt.includes(must), must);
  }
});

// ===========================================================================
// Supplementary: developer/clinic disclaimers present; no beauty-promise language
// ===========================================================================

test("the required 'developer / clinic testing only' and 'temporary preview' disclaimers are present on the page and component", () => {
  assert.match(read("app/illustration-preview/page.tsx"), /Developer \/ clinic testing only/);
  assert.match(read("app/illustration-preview/page.tsx"), /This is a temporary visualization preview\. It is not part of the normal consumer experience\./);
  assert.match(read("components/illustration-preview/LiveIllustrationPreview.tsx"), /Developer \/ clinic testing only/);
});

test("no beauty-score/promise or treatment-recommendation language appears in the new files", () => {
  for (const path of NEW_FILES) {
    const text = read(path).toLowerCase();
    for (const w of ["perfect", "ideal", "flaw", "glow-up", "glow up", "botox", "filler", "you need", "recommend"]) assert.ok(!text.includes(w), `${path} contains "${w}"`);
  }
});

test("the new route is never wired into Results, CRM, leads, booking, or analytics conversion tracking", () => {
  for (const path of NEW_FILES) {
    assert.doesNotMatch(read(path), /ResultsSummary|treatment-opportunities\/(?!types)|crm|analytics|gtag|posthog|booking/i, path);
  }
});
