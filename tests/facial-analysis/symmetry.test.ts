import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateMeasurements } from "../../lib/facial-analysis/measurements.ts";
import { calculateSymmetry } from "../../lib/facial-analysis/symmetry.ts";
import { buildSymmetricFace, buildAsymmetricFace } from "./fixtures.ts";

test("a symmetric face scores a high overall symmetry index", () => {
  const landmarks = buildSymmetricFace();
  const symmetry = calculateSymmetry(landmarks, calculateMeasurements(landmarks));
  assert.ok(symmetry.overallSymmetryIndex > 95, `expected >95, got ${symmetry.overallSymmetryIndex}`);
  for (const metric of symmetry.metrics) {
    assert.ok(Number.isFinite(metric.symmetryIndex));
    assert.ok(metric.symmetryIndex >= 0 && metric.symmetryIndex <= 100);
  }
});

test("narrowing one eye lowers the eye-width symmetry index", () => {
  const symmetric = buildSymmetricFace();
  const asymmetric = buildAsymmetricFace();
  const a = calculateSymmetry(symmetric, calculateMeasurements(symmetric));
  const b = calculateSymmetry(asymmetric, calculateMeasurements(asymmetric));
  const eyeMetricA = a.metrics.find((m) => m.metric === "Eye width symmetry")!;
  const eyeMetricB = b.metrics.find((m) => m.metric === "Eye width symmetry")!;
  assert.ok(eyeMetricB.symmetryIndex < eyeMetricA.symmetryIndex);
});
