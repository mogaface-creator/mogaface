/**
 * The development-only supervised illustration test path (devTestHandler.ts,
 * devIllustrationFixture.ts, devClient.ts, DevIllustrationTest.tsx). NO real
 * OpenAI call is ever made here: the API is a stubbed `fetch`.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { handleDevIllustrationTestRequest } from "../../lib/image-generation/devTestHandler.ts";
import { DEV_ILLUSTRATION_FIXTURE_OPPORTUNITY, isDevIllustrationTestEnabled } from "../../lib/image-generation/devIllustrationFixture.ts";
import { handleIllustrationRequest } from "../../lib/image-generation/handler.ts";
import type { IllustrationHandlerDeps } from "../../lib/image-generation/handler.ts";
import { createSingleFlight } from "../../lib/image-generation/singleFlight.ts";
import { createMemoryRateLimiter } from "../../lib/interpretation/access.ts";
import { VISUAL_OBSERVATIONS_CALIBRATED } from "../../lib/facial-analysis/calibration/status.ts";

const ROOT = new URL("../../", import.meta.url).pathname;
const KEY = "sk-test-dev-illustration-key-not-real";

function fakeJpeg(w: number, h: number, size: number): Uint8Array {
  const b = new Uint8Array(size).fill(9);
  b.set([0xff, 0xd8, 0xff, 0xc0, 0, 17, 8, h >> 8, h & 255, w >> 8, w & 255, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1], 0);
  return b;
}
function fakePng(w: number, h: number, size: number): Uint8Array {
  const b = new Uint8Array(size).fill(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52], 0);
  new DataView(b.buffer).setUint32(16, w);
  new DataView(b.buffer).setUint32(20, h);
  return b;
}
const SOURCE = fakeJpeg(900, 1200, 60_000);
const GENERATED = fakePng(1024, 1536, 8_000);
const b64 = (b: Uint8Array) => Buffer.from(b).toString("base64");

const DEV_ENABLED = { NODE_ENV: "development", DEV_ILLUSTRATION_TEST: "1", IMAGE_GENERATION_PROVIDER: "openai", OPENAI_API_KEY: KEY };

function stubOpenAi() {
  const calls: { url: string; form: FormData }[] = [];
  const fetchImpl: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), form: init!.body as FormData });
    return new Response(JSON.stringify({ data: [{ b64_json: b64(GENERATED) }] }), { status: 200 });
  };
  return { calls, fetchImpl };
}

function devRequest(opts: { consent?: unknown; opportunities?: unknown; photo?: Uint8Array; fixture?: unknown } = {}) {
  const form = new FormData();
  form.append("photo", new Blob([(opts.photo ?? SOURCE) as BlobPart], { type: "image/jpeg" }), "front.jpg");
  form.append(
    "payload",
    JSON.stringify({ photoVisualizationConsent: "consent" in opts ? opts.consent : "granted", photoQualityValid: true, opportunities: opts.opportunities, fixture: opts.fixture }),
  );
  return new Request("http://localhost/api/dev-illustration-test", { method: "POST", headers: { host: "localhost" }, body: form });
}

async function callDev(env: Record<string, string | undefined>, overrides: Partial<IllustrationHandlerDeps> = {}, opts?: Parameters<typeof devRequest>[0]) {
  const api = stubOpenAi();
  const deps: IllustrationHandlerDeps = { env, fetchImpl: api.fetchImpl, rateLimiter: createMemoryRateLimiter({ limit: 1000 }), logger: () => {}, ...overrides };
  const res = await handleDevIllustrationTestRequest(devRequest(opts), deps);
  const json = (await res.json()) as Record<string, unknown>;
  return { status: res.status, json, calls: api.calls };
}

// =====================================================================================

test("production cannot activate the development fixture, even with the test flag set", async () => {
  const r = await callDev({ ...DEV_ENABLED, NODE_ENV: "production" });
  assert.equal(r.status, 404);
  assert.equal(r.calls.length, 0);
});

test("the development flag is required — NODE_ENV=development alone is not enough", async () => {
  const missing = await callDev({ NODE_ENV: "development", IMAGE_GENERATION_PROVIDER: "openai", OPENAI_API_KEY: KEY });
  assert.equal(missing.status, 404);
  const wrongValue = await callDev({ ...DEV_ENABLED, DEV_ILLUSTRATION_TEST: "true" });
  assert.equal(wrongValue.status, 404);
  assert.equal(isDevIllustrationTestEnabled({ NODE_ENV: "development" }), false);
  assert.equal(isDevIllustrationTestEnabled({ NODE_ENV: "production", DEV_ILLUSTRATION_TEST: "1" }), false);
  assert.equal(isDevIllustrationTestEnabled({ NODE_ENV: "development", DEV_ILLUSTRATION_TEST: "1" }), true);
});

test("VISUAL_OBSERVATIONS_CALIBRATED remains false — this test path never touches it", () => {
  assert.equal(VISUAL_OBSERVATIONS_CALIBRATED, false);
  assert.doesNotMatch(readFileSync(join(ROOT, "lib/image-generation/devTestHandler.ts"), "utf8"), /VISUAL_OBSERVATIONS_CALIBRATED\s*=/);
  assert.doesNotMatch(readFileSync(join(ROOT, "lib/facial-analysis/calibration/status.ts"), "utf8"), /VISUAL_OBSERVATIONS_CALIBRATED\s*:\s*boolean\s*=\s*true/);
});

test("production eligibility is unchanged: the real endpoint, called directly with the dev fixture and no calibration override, is still not eligible", async () => {
  const api = stubOpenAi();
  const deps: IllustrationHandlerDeps = { env: DEV_ENABLED, fetchImpl: api.fetchImpl, rateLimiter: createMemoryRateLimiter({ limit: 1000 }), logger: () => {} }; // no `eligibility` override — exactly what app/api/generate-illustration/route.ts passes
  const form = new FormData();
  form.append("photo", new Blob([SOURCE as BlobPart], { type: "image/jpeg" }), "front.jpg");
  form.append("payload", JSON.stringify({ photoVisualizationConsent: "granted", photoQualityValid: true, opportunities: [DEV_ILLUSTRATION_FIXTURE_OPPORTUNITY] }));
  const res = await handleIllustrationRequest(new Request("http://localhost/api/generate-illustration", { method: "POST", headers: { host: "localhost" }, body: form }), deps);
  const json = (await res.json()) as Record<string, unknown>;
  assert.equal(json.status, "not_eligible");
  assert.equal(api.calls.length, 0);
});

test("consent is still required on the dev test path — declined or pending never reach the image API", async () => {
  const declined = await callDev(DEV_ENABLED, {}, { consent: "declined" });
  assert.equal(declined.status, 403);
  assert.equal(declined.calls.length, 0);
  const pending = await callDev(DEV_ENABLED, {}, { consent: "pending" });
  assert.equal(pending.status, 403);
  assert.equal(pending.calls.length, 0);
});

test("unsupported/foreign opportunities sent by the caller are discarded outright — only the fixed fixture is ever used", async () => {
  const smuggled = [{ id: "attacker.filler", category: "DERMAL_FILLER", status: "potential_opportunity", consumerReady: true, evidenceObservationIds: ["x"], evidenceQuestionIds: [] }];
  const r = await callDev(DEV_ENABLED, {}, { opportunities: smuggled });
  assert.equal(r.json.status, "ready");
  assert.equal(r.calls.length, 1);
  const sentPrompt = String((r.calls[0].form.get("prompt") as string) ?? "");
  assert.doesNotMatch(sentPrompt, /filler|dermal/i);
  assert.match(sentPrompt, /expression lines/i);
  assert.match(sentPrompt, /forehead/i);
});

test("exactly one image-generation call happens per dev-test request", async () => {
  const r = await callDev(DEV_ENABLED);
  assert.equal(r.json.status, "ready");
  assert.equal(r.calls.length, 1);
});

// =====================================================================================
// C, D, E, F, J: the multi-area composite fixture ("fixture": "multi")
// =====================================================================================

test("C: the multi-area fixture produces all five areas here, while the real production endpoint (no dev override) still rejects them all", async () => {
  const multi = await callDev(DEV_ENABLED, {}, { fixture: "multi" });
  assert.equal(multi.json.status, "ready");
  assert.equal(multi.calls.length, 1);

  // the SAME fixture opportunities, sent to the REAL production endpoint (no eligibility override) — never eligible
  const { DEV_MULTI_AREA_FIXTURE_OPPORTUNITIES_LIST } = await import("../../lib/image-generation/devIllustrationFixture.ts");
  const api = stubOpenAi();
  const deps: IllustrationHandlerDeps = { env: DEV_ENABLED, fetchImpl: api.fetchImpl, rateLimiter: createMemoryRateLimiter({ limit: 1000 }), logger: () => {} };
  const form = new FormData();
  form.append("photo", new Blob([SOURCE as BlobPart], { type: "image/jpeg" }), "front.jpg");
  form.append("payload", JSON.stringify({ photoVisualizationConsent: "granted", photoQualityValid: true, opportunities: DEV_MULTI_AREA_FIXTURE_OPPORTUNITIES_LIST }));
  const res = await handleIllustrationRequest(new Request("http://localhost/api/generate-illustration", { method: "POST", headers: { host: "localhost" }, body: form }), deps);
  const json = (await res.json()) as Record<string, unknown>;
  assert.equal(json.status, "not_eligible");
  assert.equal(api.calls.length, 0);
});

test("D–E: the multi-area prompt sent to the image API carries all five approved instructions and nothing unsafe", async () => {
  const r = await callDev(DEV_ENABLED, {}, { fixture: "multi" });
  assert.equal(r.json.status, "ready");
  const prompt = String(r.calls[0].form.get("prompt") ?? "");
  assert.equal(prompt.split("\n").filter((l) => l.startsWith("- ")).length, 5);
  for (const region of ["forehead", "lower face contour", "jawline", "under eye area", "skin overall"]) assert.match(prompt, new RegExp(region, "i"));
  for (const bad of ["beautif", "attractive", "perfect", "ideal", "glow up", "flaw", "botox", "filler", "inject", "guarantee"]) assert.doesNotMatch(prompt, new RegExp(bad, "i"));
});

test("F: identity-preservation requirements reach the actual request sent to the image API for the multi-area fixture", async () => {
  const r = await callDev(DEV_ENABLED, {}, { fixture: "multi" });
  const prompt = String(r.calls[0].form.get("prompt") ?? "");
  for (const must of ["eye shape", "nose shape", "lip shape", "head position and camera angle", "lighting", "ethnicity and gender presentation", "apparent age"]) {
    assert.ok(prompt.includes(must), must);
  }
});

test("J: no API key or image bytes appear in the log for the multi-area fixture either", async () => {
  const logs: unknown[] = [];
  const api = stubOpenAi();
  const deps: IllustrationHandlerDeps = { env: DEV_ENABLED, fetchImpl: api.fetchImpl, rateLimiter: createMemoryRateLimiter({ limit: 1000 }), logger: (e) => logs.push(e) };
  await handleDevIllustrationTestRequest(devRequest({ fixture: "multi" }), deps);
  const dump = JSON.stringify(logs);
  assert.ok(!dump.includes(KEY), "API key must never appear in the log");
  assert.ok(!dump.includes(b64(SOURCE)) && !dump.includes(b64(GENERATED)), "image bytes must never appear in the log");
  assert.doesNotMatch(dump, /authorization|bearer/i);
});

test("the default fixture (no 'fixture' field) is 'single' — unchanged from before the multi-area fixture existed", async () => {
  const noField = await callDev(DEV_ENABLED); // devRequest() sends fixture: undefined
  const explicit = await callDev(DEV_ENABLED, {}, { fixture: "single" });
  assert.equal(noField.json.status, "ready");
  assert.equal(explicit.json.status, "ready");
  assert.equal(noField.calls[0].form.get("prompt"), explicit.calls[0].form.get("prompt"));
  assert.equal(noField.calls[0].form.get("prompt")?.toString().split("\n").filter((l) => l.startsWith("- ")).length, 1);
});

test("createSingleFlight: a concurrent call is dropped, not queued — one underlying call for two overlapping invocations", async () => {
  let underlyingCalls = 0;
  let releaseFirst!: () => void;
  const slow = async () => {
    underlyingCalls++;
    await new Promise<void>((resolve) => (releaseFirst = resolve));
    return "done";
  };
  const guarded = createSingleFlight(slow);
  const first = guarded();
  const second = guarded(); // fired while `first` is still in flight
  assert.equal(await second, null);
  releaseFirst();
  assert.equal(await first, "done");
  assert.equal(underlyingCalls, 1);

  // once the first call has finished, a later call is a fresh, allowed request — not dropped
  const third = guarded();
  releaseFirst(); // `slow()` re-assigned this to the new call's own resolver
  assert.equal(await third, "done");
  assert.equal(underlyingCalls, 2);
});

test("no automatic call on page load or re-render: the dev control only fires from its onClick handlers, never a useEffect", () => {
  const src = readFileSync(join(ROOT, "components/results/DevIllustrationTest.tsx"), "utf8");
  assert.doesNotMatch(src, /useEffect/);
  const runCalls = src.split("\n").filter((l) => /\brun\(/.test(l) && !/const run/.test(l));
  assert.ok(runCalls.length >= 1 && runCalls.every((l) => /onClick/.test(l)), runCalls.join("\n"));
  assert.match(src, /guarded\(/); // the single-flight guard is actually used, not just imported
});

test("the dev route returns a plain 404 when disabled — indistinguishable from the route not existing", async () => {
  const r = await callDev({ NODE_ENV: "development" });
  assert.deepEqual(r.json, { error: "not_found" });
  assert.equal(r.status, 404);
});

test("structure: the dev route/handler/client never read the OpenAI credential directly — only handler.ts does", () => {
  for (const path of ["lib/image-generation/devTestHandler.ts", "lib/image-generation/devIllustrationFixture.ts", "lib/image-generation/devClient.ts", "app/api/dev-illustration-test/route.ts", "components/results/DevIllustrationTest.tsx"]) {
    assert.doesNotMatch(readFileSync(join(ROOT, path), "utf8"), /OPENAI_API_KEY/, path);
  }
});
