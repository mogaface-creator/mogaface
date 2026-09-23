import { test } from "node:test";
import assert from "node:assert/strict";
import { checkPhotoQuality } from "../../lib/facial-analysis/quality.ts";
import { buildSymmetricFace } from "./fixtures.ts";

test("no face detected is invalid with a clear error", () => {
  const result = checkPhotoQuality({ imageWidth: 1000, imageHeight: 1000, faceCount: 0 });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("No face detected")));
});

test("two faces detected is invalid with a clear error", () => {
  const result = checkPhotoQuality({ imageWidth: 1000, imageHeight: 1000, faceCount: 2 });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("Multiple faces")));
});

test("a well-framed single face at good resolution is valid", () => {
  const result = checkPhotoQuality({
    imageWidth: 1200,
    imageHeight: 1600,
    faceCount: 1,
    landmarks: buildSymmetricFace(),
  });
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test("extremely small face in frame is invalid", () => {
  const landmarks = buildSymmetricFace().map((p) => ({
    x: 0.5 + (p.x - 0.5) * 0.05,
    y: 0.5 + (p.y - 0.5) * 0.05,
    z: p.z,
  }));
  const result = checkPhotoQuality({ imageWidth: 1200, imageHeight: 1600, faceCount: 1, landmarks });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("too small")));
});

test("face cropped at the image edge is invalid", () => {
  const landmarks = buildSymmetricFace().map((p) => ({ x: p.x - 0.3, y: p.y, z: p.z }));
  const result = checkPhotoQuality({ imageWidth: 1200, imageHeight: 1600, faceCount: 1, landmarks });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("cut off")));
});

test("resolution below the hard floor is invalid", () => {
  const result = checkPhotoQuality({
    imageWidth: 200,
    imageHeight: 200,
    faceCount: 1,
    landmarks: buildSymmetricFace(),
  });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes("resolution")));
});

test("qualityScore is always a finite number between 0 and 100", () => {
  const result = checkPhotoQuality({ imageWidth: 50, imageHeight: 50, faceCount: 3 });
  assert.ok(Number.isFinite(result.qualityScore));
  assert.ok(result.qualityScore! >= 0 && result.qualityScore! <= 100);
});
