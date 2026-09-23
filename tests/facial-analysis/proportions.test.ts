import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateMeasurements } from "../../lib/facial-analysis/measurements.ts";
import { calculateProportions } from "../../lib/facial-analysis/proportions.ts";
import { buildSymmetricFace } from "./fixtures.ts";

test("proportions are finite and the three facial thirds sum to ~1", () => {
  const measurements = calculateMeasurements(buildSymmetricFace());
  const { metrics } = calculateProportions(measurements);

  for (const m of metrics) {
    assert.ok(Number.isFinite(m.value), `${m.metric} was not finite`);
  }

  const upper = metrics.find((m) => m.metric === "Upper third proportion")!.value;
  const middle = metrics.find((m) => m.metric === "Middle third proportion")!.value;
  const lower = metrics.find((m) => m.metric === "Lower third proportion")!.value;
  assert.ok(Math.abs(upper + middle + lower - 1) < 1e-9);
});

test("calculateProportions never divides by zero into NaN/Infinity", () => {
  const measurements = calculateMeasurements(buildSymmetricFace());
  measurements.face.width = 0;
  const { metrics } = calculateProportions(measurements);
  for (const m of metrics) {
    assert.ok(Number.isFinite(m.value));
  }
});
