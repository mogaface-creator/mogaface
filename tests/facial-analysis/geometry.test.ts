import { test } from "node:test";
import assert from "node:assert/strict";
import {
  distance,
  horizontalDistance,
  verticalDistance,
  midpoint,
  angle,
  ratio,
  percentageDifference,
  normalizedDifference,
} from "../../lib/facial-analysis/geometry.ts";

test("distance computes euclidean distance", () => {
  assert.equal(distance({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
});

test("horizontalDistance/verticalDistance ignore the other axis", () => {
  assert.equal(horizontalDistance({ x: 1, y: 100 }, { x: 4, y: -50 }), 3);
  assert.equal(verticalDistance({ x: 1, y: 100 }, { x: 4, y: 108 }), 8);
});

test("midpoint averages both points", () => {
  assert.deepEqual(midpoint({ x: 0, y: 0 }, { x: 10, y: 20 }), { x: 5, y: 10 });
});

test("angle returns 90 for a right angle", () => {
  const result = angle({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 });
  assert.ok(Math.abs(result - 90) < 1e-9);
});

test("angle returns NaN for a degenerate (zero-length) vector instead of throwing", () => {
  const result = angle({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 1 });
  assert.ok(Number.isNaN(result));
});

test("ratio returns null on zero denominator instead of Infinity/NaN", () => {
  assert.equal(ratio(10, 0), null);
  assert.equal(ratio(10, 5), 2);
});

test("percentageDifference returns null when both values are zero", () => {
  assert.equal(percentageDifference(0, 0), null);
  assert.equal(percentageDifference(5, 10), 50);
});

test("normalizedDifference returns null on zero reference", () => {
  assert.equal(normalizedDifference(5, 10, 0), null);
  assert.equal(normalizedDifference(5, 10, 10), 50);
});
