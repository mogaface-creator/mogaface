import { test } from "node:test";
import assert from "node:assert/strict";
import { flowReducer, initialFlow, nextStep, photoOrder, photoProgress, type FlowAction, type FlowState } from "../../lib/camera-capture/flow.ts";
import { PHOTO_STEPS, PROFILE_STEPS, REQUIRED_STEPS } from "../../lib/camera-capture/types.ts";
import { PHOTO_SLOTS, REQUIRED_PHOTO_SLOTS } from "../../lib/assessment/types.ts";
import { photoMetadataFor } from "../../lib/assessment/photoMeta.ts";
import { photoFileName, fitSize, CAPTURE_MAX_SIDE } from "../../lib/camera-capture/capture.ts";
import { createEmptyAssessment } from "../../lib/assessment/defaults.ts";
import { sanitizeAssessment } from "../../lib/assessment/schema.ts";

const apply = (state: FlowState, ...actions: FlowAction[]) => actions.reduce(flowReducer, state);
const ready = () => apply(initialFlow(), { type: "REQUEST_CAMERA" }, { type: "CAMERA_READY" });
const capture = (s: FlowState) => apply(s, { type: "CAPTURED", slot: s.step! }, { type: "ACCEPT_PHOTO" });

test("view order: front → left 45° → right 45° → (optional profiles) → video", () => {
  assert.deepEqual(photoOrder(false), ["front", "leftFortyFive", "rightFortyFive"]);
  assert.deepEqual(photoOrder(true), ["front", "leftFortyFive", "rightFortyFive", "leftProfile", "rightProfile"]);
  assert.deepEqual(REQUIRED_STEPS.map((s) => s.slot), ["front", "leftFortyFive", "rightFortyFive"]);
  assert.deepEqual(PROFILE_STEPS.map((s) => s.slot), ["leftProfile", "rightProfile"]);
});

test("photo slots map onto the existing assessment slots — no parallel model", () => {
  assert.deepEqual(PHOTO_STEPS.map((s) => s.slot), PHOTO_SLOTS.map((p) => p.slot));
  assert.deepEqual(REQUIRED_STEPS.map((s) => s.slot), [...REQUIRED_PHOTO_SLOTS]);
  for (const { slot } of PHOTO_SLOTS) {
    assert.equal(photoFileName(slot), `${slot}.jpg`);
    const meta = photoMetadataFor(slot, { name: photoFileName(slot), size: 1234 });
    assert.deepEqual([meta.slot, meta.fileName, meta.sizeBytes], [slot, `${slot}.jpg`, 1234]);
    // A captured photo's metadata is valid in the existing assessment schema.
    const a = { ...createEmptyAssessment(), photos: [meta] } as unknown as Record<string, unknown>;
    assert.notEqual(sanitizeAssessment(JSON.parse(JSON.stringify(a))), null, slot);
  }
});

test("frame size for capture keeps the real aspect ratio and never upscales", () => {
  assert.deepEqual(fitSize(1280, 720), { width: 1280, height: 720 });
  assert.deepEqual(fitSize(3840, 2160), { width: CAPTURE_MAX_SIDE, height: 1080 });
  assert.deepEqual(fitSize(720, 1280), { width: 720, height: 1280 }); // portrait preserved
  assert.deepEqual(fitSize(0, 720), { width: 0, height: 0 });
});

test("happy path: intro → camera → front → left → right → profiles offer → video → complete", () => {
  let s = initialFlow();
  assert.equal(s.phase, "intro");
  s = apply(s, { type: "REQUEST_CAMERA" });
  assert.equal(s.phase, "requesting");
  s = apply(s, { type: "CAMERA_READY" });
  assert.deepEqual([s.phase, s.step], ["photo", "front"]);
  s = apply(s, { type: "CAPTURED", slot: "front" });
  assert.equal(s.phase, "review");
  s = apply(s, { type: "ACCEPT_PHOTO" });
  assert.deepEqual([s.phase, s.step, s.accepted], ["photo", "leftFortyFive", ["front"]]);
  s = capture(s);
  assert.equal(s.step, "rightFortyFive");
  s = capture(s);
  assert.deepEqual([s.phase, s.step], ["profiles_offer", null]);
  s = apply(s, { type: "SKIP_PROFILES" });
  assert.equal(s.phase, "video");
  s = apply(s, { type: "VIDEO_RECORDED" });
  assert.equal(s.phase, "video_review");
  s = apply(s, { type: "ACCEPT_VIDEO" });
  assert.deepEqual([s.phase, s.videoAccepted], ["complete", true]);
  assert.deepEqual(s.accepted, ["front", "leftFortyFive", "rightFortyFive"]);
});

test("retake: the same step is captured again and nothing is accepted", () => {
  let s = apply(ready(), { type: "CAPTURED", slot: "front" });
  s = apply(s, { type: "RETAKE" });
  assert.deepEqual([s.phase, s.step, s.accepted], ["photo", "front", []]);
  // a step cannot be skipped: accepting requires a review first
  assert.equal(apply(ready(), { type: "ACCEPT_PHOTO" }).phase, "photo");
});

test("only the step being captured can be captured (view transition guard)", () => {
  const s = ready();
  assert.equal(apply(s, { type: "CAPTURED", slot: "leftFortyFive" }).phase, "photo");
  assert.equal(apply(s, { type: "CAPTURED", slot: "front" }).phase, "review");
});

test("optional profiles: adding them captures left then right profile before the video", () => {
  let s = capture(capture(capture(ready())));
  assert.equal(s.phase, "profiles_offer");
  s = apply(s, { type: "ADD_PROFILES" });
  assert.deepEqual([s.phase, s.step], ["photo", "leftProfile"]);
  s = capture(s);
  assert.equal(s.step, "rightProfile");
  s = capture(s);
  assert.equal(s.phase, "video");
  assert.deepEqual(photoProgress(s), { done: 5, total: 5 });
});

test("video can be skipped or re-recorded", () => {
  const atVideo = apply(capture(capture(capture(ready()))), { type: "SKIP_PROFILES" });
  const skipped = apply(atVideo, { type: "SKIP_VIDEO" });
  assert.deepEqual([skipped.phase, skipped.videoAccepted], ["complete", false]);
  const again = apply(atVideo, { type: "VIDEO_RECORDED" }, { type: "RERECORD_VIDEO" });
  assert.equal(again.phase, "video");
});

test("photos captured earlier are remembered: the flow resumes at the first missing required view", () => {
  const s = apply(initialFlow(["front"]), { type: "REQUEST_CAMERA" }, { type: "CAMERA_READY" });
  assert.equal(s.step, "leftFortyFive");
  const all = apply(initialFlow(["front", "leftFortyFive", "rightFortyFive"]), { type: "REQUEST_CAMERA" }, { type: "CAMERA_READY" });
  assert.equal(all.phase, "profiles_offer");
  assert.equal(nextStep(["front"], false), "leftFortyFive");
  assert.equal(nextStep(["front", "leftFortyFive", "rightFortyFive"], false), null);
});

test("camera failure → error state with the kind; retry re-requests; the fallback is upload (handled by the parent)", () => {
  let s = apply(initialFlow(), { type: "REQUEST_CAMERA" }, { type: "CAMERA_FAILED", kind: "permission_denied" });
  assert.deepEqual([s.phase, s.error], ["error", "permission_denied"]);
  s = apply(s, { type: "RETRY" });
  assert.deepEqual([s.phase, s.error], ["requesting", null]);
  assert.equal(flowReducer(initialFlow(), { type: "RETRY" }).phase, "intro", "retry only applies to an error");
});

test("out-of-order actions are ignored", () => {
  const s = initialFlow();
  for (const a of [{ type: "CAMERA_READY" }, { type: "ACCEPT_PHOTO" }, { type: "RETAKE" }, { type: "ACCEPT_VIDEO" }, { type: "ADD_PROFILES" }, { type: "SKIP_VIDEO" }] as FlowAction[]) {
    assert.deepEqual(flowReducer(s, a), s, a.type);
  }
});

test("profile steps can be abandoned: 'Skip profile photos' goes straight to the video, but a required view can never be skipped", () => {
  const atProfile = apply(capture(capture(capture(ready()))), { type: "ADD_PROFILES" });
  assert.equal(atProfile.step, "leftProfile");
  const skipped = apply(atProfile, { type: "SKIP_PROFILES" });
  assert.deepEqual([skipped.phase, skipped.step], ["video", null]);
  assert.deepEqual(skipped.accepted, ["front", "leftFortyFive", "rightFortyFive"]);

  const onRequired = ready();
  assert.equal(onRequired.step, "front");
  assert.deepEqual(apply(onRequired, { type: "SKIP_PROFILES" }), onRequired, "front cannot be skipped");
  const at45 = capture(ready());
  assert.deepEqual(apply(at45, { type: "SKIP_PROFILES" }), at45, "a 45° view cannot be skipped");
});
