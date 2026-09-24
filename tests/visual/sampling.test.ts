import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_MAX_FRAMES, frameId, planFrameTimes } from "../../lib/facial-analysis/video/sampling.ts";
import { MAX_VIDEO_BYTES, validateVideoMetadata } from "../../lib/facial-analysis/video/validate.ts";
import { META } from "./fixtures.ts";

test("frame plan: evenly spaced, inside the video, capped at maxFrames", () => {
  const times = planFrameTimes(10, 5);
  assert.equal(times.length, 5);
  assert.ok(times[0] > 0 && times[4] < 10);
  const steps = times.slice(1).map((t, i) => t - times[i]);
  assert.ok(steps.every((s) => Math.abs(s - steps[0]) < 1e-9));
  assert.equal(planFrameTimes(10).length, DEFAULT_MAX_FRAMES);
  assert.equal(planFrameTimes(10, 1).length, 1);
});

test("frame plan: degenerate durations and counts return no frames instead of NaN", () => {
  for (const d of [0, -3, Number.NaN, Number.POSITIVE_INFINITY]) assert.deepEqual(planFrameTimes(d), []);
  assert.deepEqual(planFrameTimes(10, 0), []);
});

test("provenance ids for frames", () => {
  assert.equal(frameId(14), "video_frame_14");
});

test("video metadata: a normal video is valid", () => {
  assert.deepEqual(validateVideoMetadata(META), { valid: true, errors: [], warnings: [] });
});

test("video metadata: non-video, too short, too long, unreadable, too small, too large are rejected", () => {
  const bad = (patch: object) => validateVideoMetadata({ ...META, ...patch });
  assert.match(bad({ mimeType: "image/png" }).errors.join(), /not a video/);
  assert.match(bad({ durationSec: 0.5 }).errors.join(), /too short/);
  assert.match(bad({ durationSec: 600 }).errors.join(), /too long/);
  assert.match(bad({ durationSec: Number.NaN }).errors.join(), /length could not be read/);
  assert.match(bad({ width: 100, height: 100 }).errors.join(), /resolution is too low/);
  assert.match(bad({ sizeBytes: MAX_VIDEO_BYTES + 1 }).errors.join(), /too large/);
});

test("video metadata: low resolution warns; null/missing metadata fails safely", () => {
  assert.equal(validateVideoMetadata({ ...META, width: 400, height: 300 }).warnings.length, 1);
  assert.equal(validateVideoMetadata(null).valid, false);
  assert.equal(validateVideoMetadata({}).valid, false);
});
