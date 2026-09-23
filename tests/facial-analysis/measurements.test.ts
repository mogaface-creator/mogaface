import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateMeasurements } from "../../lib/facial-analysis/measurements.ts";
import { buildSymmetricFace } from "./fixtures.ts";

test("calculateMeasurements returns finite, non-negative numbers for a valid face", () => {
  const measurements = calculateMeasurements(buildSymmetricFace());

  for (const group of Object.values(measurements)) {
    for (const value of Object.values(group as Record<string, number | null>)) {
      if (value === null) continue;
      assert.ok(Number.isFinite(value), `expected finite value, got ${value}`);
      assert.ok(value >= 0, `expected non-negative value, got ${value}`);
    }
  }
});

test("face width/height ratio matches the fixture geometry", () => {
  const m = calculateMeasurements(buildSymmetricFace());
  // face width = 0.75-0.25 = 0.5, face height = 0.85-0.15 = 0.7
  assert.ok(Math.abs(m.face.width - 0.5) < 1e-9);
  assert.ok(Math.abs(m.face.height - 0.7) < 1e-9);
  assert.ok(Math.abs(m.face.widthHeightRatio - 0.5 / 0.7) < 1e-9);
});

test("calculateMeasurements throws a clear error when landmarks are missing", () => {
  assert.throws(() => calculateMeasurements([]), /Landmark index \d+ missing/);
});
