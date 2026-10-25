import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBenchmarkImagePrompt, selectedTreatmentKeys, parseClinicalVisionResult, runClinicalVisionScan } from "../../lib/submissions/clinicalVision.ts";
import { reviewPassed, reviewAfterImage } from "../../lib/submissions/imageReview.ts";
import { generateAfterImage } from "../../lib/submissions/imageJob.ts";
import { createSubmission, getSubmission } from "../../lib/submissions/store.ts";

const plan = () => parseClinicalVisionResult({ observations: [{ key: "forehead", observation: "A few visible horizontal lines; lighting may exaggerate their contrast." }] }, ["forehead"]);

test("selected areas never unlock a generic makeover; hair requires both selection and opt-in", () => {
  assert.deepEqual(selectedTreatmentKeys(["OVERALL_APPEARANCE", "unknown"]), []);
  assert.deepEqual(selectedTreatmentKeys(["FACIAL_LINES", "HAIR"]), ["forehead"]);
  assert.deepEqual(selectedTreatmentKeys(["FACIAL_LINES", "HAIR"], true), ["forehead", "hair"]);
  assert.equal(buildBenchmarkImagePrompt({ firstName: "Anyone" }), "");
  const p = plan();
  assert.equal(p.opportunities.length, 1);
  assert.deepEqual(p.pillars.map((item: { key: string }) => item.key), ["forehead"]);
  assert.match(p.imagePrompt!, /Slightly soften existing forehead lines/);
  assert.doesNotMatch(p.imagePrompt!, /green wall|beige|brown\/tan|curly|Micro-filler|define.*jaw/i);
  assert.equal(p.harmonyScore, undefined);
  assert.equal(p.symmetryIndex, undefined);
});

test("unselected, duplicate, missing or malformed model observations fail closed", () => {
  for (const value of [null, {}, { observations: [{ key: "hair", observation: "Thin" }] }, { observations: [{ key: "forehead", observation: 42 }] }, { observations: [{ key: "forehead", observation: "Lines" }, { key: "forehead", observation: "Lines" }] }]) {
    const result = parseClinicalVisionResult(value, ["forehead"]);
    assert.equal(result.status, "unavailable");
    assert.deepEqual(result.opportunities, []);
    assert.equal(result.imagePrompt, undefined);
  }
  const empty = parseClinicalVisionResult({ observations: [] }, ["forehead"]);
  assert.equal(empty.status, "ready");
  assert.equal(empty.imagePrompt, "");
});

test("quality review requires every explicit boolean; missing, string or uncertain results reject", () => {
  const good = { samePerson: true, naturalTexture: true, preservedLighting: true, preservedUnselectedAreas: true, subtleChanges: true };
  assert.equal(reviewPassed(good), true);
  for (const key of Object.keys(good)) assert.equal(reviewPassed({ ...good, [key]: false }), false);
  assert.equal(reviewPassed({ ...good, samePerson: "true" }), false);
  assert.equal(reviewPassed(null), false);
});

function png(marker: number): Buffer {
  const b = Buffer.alloc(2100, marker); b.set([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]); b.writeUInt32BE(512,16); b.writeUInt32BE(512,20); return b;
}

test("vision failures produce no invented report; quality failures never return a deliverable", async () => {
  const previousFetch = globalThis.fetch;
  const previousEnv = { ...process.env };
  try {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.IMAGE_GENERATION_PROVIDER = "openai";
    let calls = 0;
    globalThis.fetch = async () => { calls++; return new Response("unavailable", { status: 503 }); };
    const failed = await runClinicalVisionScan({ beforeBytes: png(0), beforeMime: "image/png", intakeConcerns: ["FACIAL_LINES"] });
    assert.equal(failed.status, "unavailable");
    assert.deepEqual(failed.opportunities, []);
    const beforeCalls = calls;
    assert.equal((await generateAfterImage({ beforeBytes: png(0), beforeMime: "image/png", record: null, clinicalVision: failed })).ok, false);
    assert.equal(calls, beforeCalls);

    let allowReview = false;
    globalThis.fetch = async (url, init) => {
      calls++;
      if (String(url).endsWith("/images/edits")) {
        const form = init!.body as FormData;
        assert.equal(form.get("quality"), "high");
        assert.equal(form.get("prompt"), plan().imagePrompt);
        return Response.json({ data: [{ b64_json: png(1).toString("base64") }] });
      }
      return Response.json({ choices: [{ message: { content: JSON.stringify({ samePerson: true, naturalTexture: allowReview, preservedLighting: true, preservedUnselectedAreas: true, subtleChanges: true }) } }] });
    };
    const input = { beforeBytes: png(0), beforeMime: "image/png" as const, record: null, clinicalVision: plan() };
    const rejected = await generateAfterImage(input);
    assert.equal(rejected.ok, false);
    if (!rejected.ok) {
      assert.equal(rejected.reason, "image_quality_review_failed");
      assert.equal(rejected.review?.status, "rejected");
      assert.equal(rejected.debugPreview, undefined);
    }
    Object.assign(process.env, { NODE_ENV: "development" });
    const debug = await generateAfterImage({ ...input, debugPreview: true });
    assert.equal(debug.ok, false);
    if (!debug.ok) assert.equal(debug.debugPreview?.base64, png(1).toString("base64"));
    Object.assign(process.env, { NODE_ENV: "production" });
    const production = await generateAfterImage({ ...input, debugPreview: true });
    assert.equal(production.ok, false);
    if (!production.ok) assert.equal(production.debugPreview, undefined);
    allowReview = true;
    assert.equal((await generateAfterImage(input)).ok, true);
    assert.deepEqual(await generateAfterImage({ ...input, customPrompt: "Make a different person" }), { ok: false, reason: "custom_prompt_disabled" });
  } finally {
    globalThis.fetch = previousFetch;
    for (const key of Object.keys(process.env)) if (!(key in previousEnv)) delete process.env[key];
    Object.assign(process.env, previousEnv);
  }
});

test("submission persistence retains the explicit consent choice", async () => {
  for (const consent of ["granted", "declined"] as const) {
    const id = await createSubmission({ leadId: null, analysisId: null, beforeImageBytes: png(0), beforeImageMime: "image/png", photoVisualizationConsent: consent }, { env: {} });
    assert.ok(id);
    assert.equal((await getSubmission(id, { env: {} }))?.photo_visualization_consent, consent);
  }
});


test("review service failures are distinct from rejected image quality", async () => {
  const previousFetch = globalThis.fetch;
  const input = { apiKey: "test", model: "test", before: "data:image/png;base64,AAAA", after: "data:image/png;base64,BBBB", prompt: "forehead" };
  try {
    globalThis.fetch = async () => new Response("busy", { status: 429 });
    assert.deepEqual(await reviewAfterImage(input), { status: "unavailable", code: "review_provider_error", httpStatus: 429 });
    globalThis.fetch = async () => Response.json({ choices: [{ message: { content: "{broken" } }] });
    assert.deepEqual(await reviewAfterImage(input), { status: "unavailable", code: "review_invalid_response" });
    globalThis.fetch = async () => { throw new DOMException("Timed out", "TimeoutError"); };
    assert.deepEqual(await reviewAfterImage(input), { status: "unavailable", code: "review_timeout" });
  } finally { globalThis.fetch = previousFetch; }
});
