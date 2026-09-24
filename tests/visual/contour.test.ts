import { test } from "node:test";
import assert from "node:assert/strict";
import { LANDMARK } from "../../lib/facial-analysis/landmarkMapping.ts";
import { calculateContourGeometry, nearSideOf } from "../../lib/facial-analysis/contour.ts";
import { contourFace } from "./fixtures.ts";

test("front contour: both sides measured, finite, and equal on a symmetric face", () => {
  const c = calculateContourGeometry(contourFace(), 1000, 1000, "front");
  assert.ok(c.right && c.left);
  for (const v of [c.right.cheekContourAngle, c.right.jawContourAngle]) assert.ok(v > 0 && v < 180);
  assert.ok(Math.abs(c.right.cheekContourAngle - c.left.cheekContourAngle) < 1e-9);
  assert.ok(Math.abs(c.right.jawContourAngle - c.left.jawContourAngle) < 1e-9);
  assert.equal(c.nearSide, null);
});

test("front contour: jaw/face width and lower-face ratios are relative (no units, no ideal)", () => {
  const c = calculateContourGeometry(contourFace(), 1000, 1000, "front");
  assert.ok(Math.abs(c.jawToFaceWidthRatio! - 0.8) < 1e-9); // 0.40 / 0.50
  assert.ok(Math.abs(c.lowerFaceContourRatio! - 0.25 / 0.4) < 1e-9);
});

test("front contour: an asymmetric outline changes only the affected side", () => {
  const lm = contourFace();
  lm[LANDMARK.leftOvalCheek] = { x: 0.7, y: 0.62, z: 0 };
  const c = calculateContourGeometry(lm, 1000, 1000, "front");
  assert.ok(Math.abs(c.right!.cheekContourAngle - c.left!.cheekContourAngle) > 1);
  assert.ok(Math.abs(c.right!.jawContourAngle - calculateContourGeometry(contourFace(), 1000, 1000, "front").right!.jawContourAngle) < 1e-9);
});

test("contour angles are computed in pixel space, so a non-square image does not distort them silently", () => {
  const square = calculateContourGeometry(contourFace(), 1000, 1000, "front").right!.jawContourAngle;
  const wide = calculateContourGeometry(contourFace(), 2000, 1000, "front").right!.jawContourAngle;
  assert.ok(Math.abs(square - wide) > 1);
});

test("45° contour: only the camera-facing side is reported, and no front-only ratios", () => {
  const lm = contourFace();
  lm[LANDMARK.noseTip] = { x: 0.35, y: 0.55, z: 0 }; // nose toward the subject's right edge → left cheek faces the camera
  assert.equal(nearSideOf(lm), "left");
  const c = calculateContourGeometry(lm, 1000, 1000, "threeQuarter");
  assert.equal(c.right, null);
  assert.ok(c.left);
  assert.equal(c.jawToFaceWidthRatio, null);
  assert.equal(c.lowerFaceContourRatio, null);
});

test("45° contour: a photo that is really frontal contributes nothing (missing angle, not a guess)", () => {
  const c = calculateContourGeometry(contourFace(), 1000, 1000, "threeQuarter");
  assert.equal(c.nearSide, null);
  assert.equal(c.right, null);
  assert.equal(c.left, null);
});

test("contour side is null (never NaN) when its landmarks coincide", () => {
  const lm = contourFace();
  lm[LANDMARK.rightOvalCheek] = { ...lm[LANDMARK.faceRightEdge] };
  assert.equal(calculateContourGeometry(lm, 1000, 1000, "front").right, null);
});
