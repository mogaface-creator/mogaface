import { test } from "node:test";
import assert from "node:assert/strict";
import { EXPRESSION_STEPS, INITIAL_RECORDING, TOTAL_RECORDING_MS, pickRecorderMimeType, recordingFileName, recordingReducer, stepAt, type RecordingAction, type RecordingState } from "../../lib/camera-capture/recording.ts";
import { describeCaptureRecord, FALLBACK_REASON } from "../../lib/camera-capture/feedback.ts";
import { buildCompleteFrontRecord } from "../observation/fixtures.ts";

const run = (s: RecordingState, ...a: RecordingAction[]) => a.reduce(recordingReducer, s);

// ---- expression timeline ----

test("timeline: Relax → Raise your eyebrows → Frown → Smile → Squint, three seconds each (~15 s)", () => {
  assert.deepEqual(EXPRESSION_STEPS.map((s) => s.id), ["RELAX", "BROW_RAISE", "FROWN", "SMILE", "SQUINT"]);
  assert.deepEqual(EXPRESSION_STEPS.map((s) => s.prompt), ["Relax your face", "Raise your eyebrows", "Frown naturally", "Smile naturally", "Gently squint"]);
  assert.ok(EXPRESSION_STEPS.every((s) => s.seconds === 3));
  assert.equal(TOTAL_RECORDING_MS, 15_000);
  assert.ok(TOTAL_RECORDING_MS >= 10_000 && TOTAL_RECORDING_MS <= 20_000);
  assert.equal(EXPRESSION_STEPS[0].id, "RELAX", "starts neutral: the existing analysis needs a still opening");
});

test("timeline: stepAt locates the step, counts down, and clamps at the end", () => {
  assert.deepEqual([stepAt(0).step.id, stepAt(0).secondsLeft, stepAt(0).done], ["RELAX", 3, false]);
  assert.equal(stepAt(2999).step.id, "RELAX");
  assert.equal(stepAt(3000).step.id, "BROW_RAISE");
  assert.equal(stepAt(6500).step.id, "FROWN");
  assert.equal(stepAt(9000).step.id, "SMILE");
  assert.equal(stepAt(14_999).step.id, "SQUINT");
  assert.deepEqual([stepAt(15_000).done, stepAt(99_999).step.id], [true, "SQUINT"]);
  assert.deepEqual([stepAt(-5).step.id, stepAt(Number.NaN).step.id], ["RELAX", "RELAX"]);
});

// ---- recording state machine ----

test("recording state: idle → recording → ticks advance steps → finishes by itself at the end", () => {
  let s = run(INITIAL_RECORDING, { type: "START" });
  assert.equal(s.status, "recording");
  s = run(s, { type: "TICK", elapsedMs: 4000 });
  assert.deepEqual([s.status, s.step], ["recording", 1]);
  s = run(s, { type: "TICK", elapsedMs: 15_000 });
  assert.deepEqual([s.status, s.elapsedMs], ["finished", TOTAL_RECORDING_MS]);
  assert.equal(run(s, { type: "TICK", elapsedMs: 100 }).status, "finished", "ticks after the end are ignored");
});

test("recording state: manual stop, cancel, failure, reset; START is idempotent while recording", () => {
  const rec = run(INITIAL_RECORDING, { type: "START" });
  assert.equal(run(rec, { type: "START" }), rec);
  assert.equal(run(rec, { type: "STOP" }).status, "finished");
  assert.equal(run(rec, { type: "CANCEL" }).status, "cancelled");
  const failed = run(rec, { type: "FAIL", message: "The recording didn't work." });
  assert.deepEqual([failed.status, failed.error], ["error", "The recording didn't work."]);
  assert.deepEqual(run(failed, { type: "RESET" }), INITIAL_RECORDING);
  assert.equal(run(INITIAL_RECORDING, { type: "TICK", elapsedMs: 500 }).status, "idle", "cannot tick before starting");
  assert.equal(run(INITIAL_RECORDING, { type: "STOP" }).status, "idle");
});

test("recorder format: first supported container wins; none supported → null (recording is offered as skippable)", () => {
  assert.equal(pickRecorderMimeType((t) => t === "video/webm"), "video/webm");
  assert.equal(pickRecorderMimeType(() => true), "video/webm;codecs=vp9");
  assert.equal(pickRecorderMimeType((t) => t === "video/mp4"), "video/mp4");
  assert.equal(pickRecorderMimeType(() => false), null);
  assert.equal(recordingFileName("video/mp4"), "expression.mp4");
  assert.equal(recordingFileName("video/webm;codecs=vp9"), "expression.webm");
});

// ---- capture review feedback (existing analysis → simple words) ----

test("capture review: an accepted photo shows plain positives and no numbers", () => {
  const f = describeCaptureRecord(buildCompleteFrontRecord());
  assert.deepEqual(f, { ok: true, positives: ["Good lighting", "Face centered", "Head position good"], reasons: [] });
});

test("capture review: a photo the existing quality gate rejected is 'retake' with one simple reason each", () => {
  const rec = (errors: string[], warnings: string[] = []) => ({ ...buildCompleteFrontRecord(), status: "blocked" as const, errors, warnings, quality: { valid: false, errors, warnings, qualityScore: 50 } });
  assert.deepEqual(describeCaptureRecord(rec(["No face detected. Use a clear, front-facing photo with good lighting."])).reasons, ["We couldn't see your face clearly."]);
  const multi = describeCaptureRecord(rec(["Face is partially cut off. Make sure your whole face is visible in the frame."], ["Image appears too dark. Try a photo with more even lighting."]));
  assert.equal(multi.ok, false);
  assert.deepEqual(multi.reasons, ["Part of your face was cut off — keep it fully in view.", "The photo was too dark — find a brighter spot."]);
  assert.deepEqual(describeCaptureRecord(rec(["something unexpected"])).reasons, [FALLBACK_REASON]);
  for (const f of [multi, describeCaptureRecord(rec(["x"]))]) assert.doesNotMatch(f.reasons.join(" "), /\d|landmark|yaw|roll|threshold/i);
});

test("capture review: an accepted photo with a warning drops the matching positive instead of over-claiming", () => {
  const rec = { ...buildCompleteFrontRecord(), warnings: ["Image appears too dark. Try a photo with more even lighting."] };
  const f = describeCaptureRecord(rec);
  assert.equal(f.ok, true);
  assert.ok(!f.positives.includes("Good lighting"));
  assert.ok(f.positives.includes("Face centered"));
});
