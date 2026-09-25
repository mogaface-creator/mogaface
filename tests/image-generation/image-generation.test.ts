import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MAX_IMAGE_REFERENCE_LENGTH,
  REMOTE_IMAGE_APIS,
  createMockProvider,
  createRemoteImageProvider,
  generateVisualization,
  selectImageGenerationProvider,
  ImageGenerationError,
  type ImageGenerationProvider,
  type RemoteImageApi,
} from "../../lib/image-generation/index.ts";
import { buildVisualizationPlan } from "../../lib/visualization/build.ts";
import { assessmentWith, inputFor } from "../results/fixtures.ts";

const ROOT = new URL("../../", import.meta.url).pathname;
const SOURCE = { url: "blob:front", slot: "front" as const };
const opportunities = inputFor(assessmentWith({ selected: ["FACIAL_DEFINITION"] }), { open: true }).opportunities;
const plan = buildVisualizationPlan({ frontPhoto: { ref: "blob:front", qualityValid: true }, opportunities });
const notEligible = buildVisualizationPlan({ frontPhoto: null, opportunities });

function counting(impl: () => Promise<{ imageUrl: string; provider: string; createdAt: string }>): ImageGenerationProvider & { calls: number } {
  const p = { id: "counting", isMock: false, calls: 0, async generateIllustration() { p.calls++; return impl(); } };
  return p;
}

test("plan fixture is eligible", () => assert.equal(plan.status, "planned"));

test("mock provider: works with no key, returns a reference, and is flagged as a mock", async () => {
  const r = await generateVisualization({ sourceImage: SOURCE, plan, provider: createMockProvider({ latencyMs: 0 }), opportunities });
  assert.equal(r.status, "ready");
  assert.equal(r.provider, "mock");
  assert.equal(r.imageUrl, "blob:front"); // the mock does not generate anything: it returns the source
  assert.equal(r.isMock, true);
  assert.ok(!Number.isNaN(Date.parse(r.createdAt!)));
});

test("mock provider can render a distinct placeholder and can be told to fail", async () => {
  const shown = await generateVisualization({ sourceImage: SOURCE, plan, provider: createMockProvider({ latencyMs: 0, render: () => "data:image/svg+xml;utf8,after" }) });
  assert.equal(shown.imageUrl, "data:image/svg+xml;utf8,after");
  const failed = await generateVisualization({ sourceImage: SOURCE, plan, provider: createMockProvider({ latencyMs: 0, behavior: "fail" }) });
  assert.deepEqual([failed.status, failed.errorCode], ["failed", "provider_failed"]);
});

test("no provider configured → unavailable (not failed), and nothing is called", async () => {
  const r = await generateVisualization({ sourceImage: SOURCE, plan, provider: null });
  assert.deepEqual([r.status, r.errorCode], ["unavailable", "provider_not_configured"]);
});

test("a not-eligible plan never reaches a provider", async () => {
  const p = counting(async () => ({ imageUrl: "x", provider: "counting", createdAt: new Date().toISOString() }));
  const r = await generateVisualization({ sourceImage: SOURCE, plan: notEligible, provider: p });
  assert.deepEqual([r.status, r.errorCode], ["unavailable", "not_eligible"]);
  assert.equal(p.calls, 0);
  const noSource = await generateVisualization({ sourceImage: null, plan, provider: p });
  assert.equal(noSource.status, "unavailable");
  assert.equal(p.calls, 0);
});

test("an invalid plan never reaches a provider", async () => {
  const p = counting(async () => ({ imageUrl: "x", provider: "counting", createdAt: "" }));
  const bad = JSON.parse(JSON.stringify(plan));
  bad.changes[0].intensity = "dramatic";
  const r = await generateVisualization({ sourceImage: SOURCE, plan: bad, provider: p });
  assert.deepEqual([r.status, r.errorCode], ["failed", "invalid_plan"]);
  assert.equal(p.calls, 0);
});

test("failure never throws and is NOT retried: exactly one attempt", async () => {
  const p = counting(async () => { throw new Error("boom"); });
  const r = await generateVisualization({ sourceImage: SOURCE, plan, provider: p });
  assert.deepEqual([r.status, r.errorCode, r.provider], ["failed", "provider_failed", "counting"]);
  assert.equal(p.calls, 1);
  const typed = counting(async () => { throw new ImageGenerationError("timeout", "slow"); });
  assert.equal((await generateVisualization({ sourceImage: SOURCE, plan, provider: typed })).errorCode, "timeout");
  assert.equal(typed.calls, 1);
});

test("a provider that never answers times out instead of hanging", async () => {
  const p = counting(() => new Promise(() => {}));
  const r = await generateVisualization({ sourceImage: SOURCE, plan, provider: p, timeoutMs: 30 });
  assert.deepEqual([r.status, r.errorCode], ["failed", "timeout"]);
});

test("results that are empty or image-sized are refused: no large binaries are stored", async () => {
  const empty = counting(async () => ({ imageUrl: "", provider: "x", createdAt: "" }));
  assert.equal((await generateVisualization({ sourceImage: SOURCE, plan, provider: empty })).errorCode, "invalid_result");
  const huge = counting(async () => ({ imageUrl: "data:image/png;base64," + "A".repeat(MAX_IMAGE_REFERENCE_LENGTH), provider: "x", createdAt: "" }));
  const r = await generateVisualization({ sourceImage: SOURCE, plan, provider: huge });
  assert.deepEqual([r.status, r.errorCode], ["failed", "invalid_result"]);
  assert.equal(r.imageUrl, undefined);
});

// ---- provider selection from the environment ----

test("provider selection: unset → mock in development, NO provider in production", () => {
  assert.equal(selectImageGenerationProvider({ NODE_ENV: "development" })?.id, "mock");
  assert.equal(selectImageGenerationProvider({}) ?.id, "mock");
  assert.equal(selectImageGenerationProvider({ NODE_ENV: "production" }), null);
});

test("provider selection: 'mock', 'none', and unknown names", async () => {
  assert.equal(selectImageGenerationProvider({ IMAGE_GENERATION_PROVIDER: "mock", NODE_ENV: "production" })?.isMock, true);
  assert.equal(selectImageGenerationProvider({ IMAGE_GENERATION_PROVIDER: "none" }), null);
  const unknown = selectImageGenerationProvider({ IMAGE_GENERATION_PROVIDER: "acme-images", IMAGE_GENERATION_API_KEY: "sk-test" })!;
  assert.equal(unknown.isMock, false);
  const r = await generateVisualization({ sourceImage: SOURCE, plan, provider: unknown });
  assert.deepEqual([r.status, r.errorCode], ["unavailable", "provider_not_configured"]);
  assert.ok(!JSON.stringify(r).includes("sk-test"), "a key never appears in a result");
});

test("no real vendor adapter is registered, so a real provider cannot be silently active", () => {
  assert.deepEqual(Object.keys(REMOTE_IMAGE_APIS), []);
});

test("the remote-provider adapter structure: request built with the key, response parsed, failures reported — using a fake fetch", async () => {
  let seenAuth = "";
  const api: RemoteImageApi = {
    id: "fake-api",
    buildRequest: ({ prompt, apiKey }) => ({ url: "https://example.invalid/generate", init: { method: "POST", headers: { authorization: `Bearer ${apiKey}` }, body: prompt } }),
    parseResponse: async (res) => (await res.json()).url as string,
  };
  const ok = createRemoteImageProvider({
    api,
    apiKey: "test-key",
    fetchImpl: (async (_u: unknown, init?: RequestInit) => {
      seenAuth = (init?.headers as Record<string, string>).authorization;
      return new Response(JSON.stringify({ url: "https://example.invalid/out.png" }), { status: 200 });
    }) as typeof fetch,
  });
  const r = await generateVisualization({ sourceImage: SOURCE, plan, provider: ok });
  assert.deepEqual([r.status, r.imageUrl, r.isMock], ["ready", "https://example.invalid/out.png", false]);
  assert.equal(seenAuth, "Bearer test-key");
  assert.ok(!JSON.stringify(r).includes("test-key"));

  const httpError = createRemoteImageProvider({ api, apiKey: "k", fetchImpl: (async () => new Response("no", { status: 500 })) as typeof fetch });
  assert.equal((await generateVisualization({ sourceImage: SOURCE, plan, provider: httpError })).errorCode, "provider_failed");
  const down = createRemoteImageProvider({ api, apiKey: "k", fetchImpl: (async () => { throw new Error("offline"); }) as typeof fetch });
  assert.equal((await generateVisualization({ sourceImage: SOURCE, plan, provider: down })).status, "failed");
});

// ---- no secrets in the repository ----

test("no environment file with secrets is committed; .env.example only carries commented placeholders", () => {
  const envFiles = readdirSync(ROOT).filter((f) => f.startsWith(".env") && f !== ".env.example");
  assert.deepEqual(envFiles.filter((f) => existsSync(join(ROOT, f)) && !/^\.env\.(local|.*\.local)$/.test(f)), []);
  const example = readFileSync(join(ROOT, ".env.example"), "utf8");
  for (const name of ["IMAGE_GENERATION_PROVIDER", "IMAGE_GENERATION_API_KEY", "NEXT_PUBLIC_CONSULTATION_URL"]) assert.ok(example.includes(name));
  const assigned = example.split("\n").filter((l) => /^[A-Z_]+=./.test(l.trim()));
  assert.deepEqual(assigned, [], "no variable in .env.example has a value");
  assert.ok(!/sk-[A-Za-z0-9]{10,}/.test(example));
});
