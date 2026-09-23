import { test } from "node:test";
import assert from "node:assert/strict";
import { combineMeasurements } from "../../lib/facial-analysis/multiPhoto/combine.ts";
import { calculateMeasurements } from "../../lib/facial-analysis/measurements.ts";
import { calculateSymmetry } from "../../lib/facial-analysis/symmetry.ts";
import { calculateProportions } from "../../lib/facial-analysis/proportions.ts";
import { buildSymmetricFace } from "../facial-analysis/fixtures.ts";
import type { PhotoAnalysisRecord, PhotoSlot } from "../../lib/facial-analysis/multiPhoto/types.ts";

function baseRecord(slot: PhotoSlot, overrides: Partial<PhotoAnalysisRecord> = {}): PhotoAnalysisRecord {
  return {
    slot,
    status: "complete",
    fileName: `${slot}.jpg`,
    sizeBytes: 1000,
    imageWidth: 1200,
    imageHeight: 1600,
    faceCount: 1,
    faceFrameCoverage: null,
    meanBrightness: null,
    quality: null,
    viewValidation: null,
    landmarks: null,
    measurements: null,
    symmetry: null,
    proportions: null,
    errors: [],
    warnings: [],
    processingTimeMs: 100,
    ...overrides,
  };
}

function fullyAnalyzed(slot: PhotoSlot): PhotoAnalysisRecord {
  const landmarks = buildSymmetricFace();
  const measurements = calculateMeasurements(landmarks);
  const symmetry = calculateSymmetry(landmarks, measurements);
  const proportions = calculateProportions(measurements);
  return baseRecord(slot, { landmarks, measurements, symmetry, proportions });
}

test("combineMeasurements uses the front photo as the source for frontal proportions and symmetry", () => {
  const front = fullyAnalyzed("front");
  const result = combineMeasurements([front]);

  const widthHeight = result.metrics.find((m) => m.metric === "Face width/height ratio");
  assert.ok(widthHeight);
  assert.equal(widthHeight!.value, front.measurements!.face.widthHeightRatio);
  assert.equal(widthHeight!.sourceView, "front");

  const symmetryMetric = result.metrics.find((m) => m.metric === "Overall symmetry index");
  assert.equal(symmetryMetric?.value, front.symmetry!.overallSymmetryIndex);
  assert.equal(symmetryMetric?.sourceView, "front");

  // Every proportion metric computed for front should be represented.
  for (const p of front.proportions!.metrics) {
    const combined = result.metrics.find((m) => m.metric === p.metric);
    assert.equal(combined?.value, p.value);
    assert.equal(combined?.sourceView, "front");
  }
});

test("combineMeasurements returns Not available (null) for frontal proportions when there is no front photo", () => {
  const result = combineMeasurements([]);
  const frontal = result.metrics.find((m) => m.metric === "Frontal proportions");
  assert.equal(frontal?.value, null);
  assert.equal(frontal?.sourceView, null);
  assert.ok(frontal?.reason && frontal.reason.length > 0);
});

test("a 45-degree photo never substitutes for a missing front photo (incompatible views are not combined)", () => {
  const threeQuarterOnly = fullyAnalyzed("leftFortyFive");
  const result = combineMeasurements([threeQuarterOnly]);
  const frontal = result.metrics.find((m) => m.metric === "Frontal proportions");
  assert.equal(frontal?.value, null);
});

test("combineMeasurements never averages across views, even when both front and 45 degree data exist", () => {
  const front = fullyAnalyzed("front");
  const threeQuarter = fullyAnalyzed("leftFortyFive");
  // Force a different ratio on the 45-degree record so an accidental average would be detectable.
  threeQuarter.measurements = { ...threeQuarter.measurements!, face: { width: 1, height: 1, widthHeightRatio: 999 } };

  const result = combineMeasurements([front, threeQuarter]);
  const widthHeight = result.metrics.find((m) => m.metric === "Face width/height ratio");
  assert.equal(widthHeight?.value, front.measurements!.face.widthHeightRatio);
  assert.notEqual(widthHeight?.value, 999);
});

test("profile-specific metrics are always Not available placeholders, never fabricated", () => {
  const result = combineMeasurements([fullyAnalyzed("front"), fullyAnalyzed("leftProfile"), fullyAnalyzed("rightProfile")]);
  for (const metric of ["Nose projection (profile)", "Chin projection (profile)", "Facial convexity (profile)"]) {
    const entry = result.metrics.find((m) => m.metric === metric);
    assert.equal(entry?.value, null);
    assert.equal(entry?.sourceView, null);
  }
});

test("an incomplete front record (missing symmetry/proportions) is treated as no front photo", () => {
  const incompleteFront = baseRecord("front", { measurements: calculateMeasurements(buildSymmetricFace()) });
  const result = combineMeasurements([incompleteFront]);
  const frontal = result.metrics.find((m) => m.metric === "Frontal proportions");
  assert.equal(frontal?.value, null);
});
