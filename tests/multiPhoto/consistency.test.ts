import { test } from "node:test";
import assert from "node:assert/strict";
import { checkConsistency } from "../../lib/facial-analysis/multiPhoto/consistency.ts";
import type { PhotoAnalysisRecord, PhotoSlot } from "../../lib/facial-analysis/multiPhoto/types.ts";

function makeRecord(slot: PhotoSlot, overrides: Partial<PhotoAnalysisRecord> = {}): PhotoAnalysisRecord {
  return {
    slot,
    status: "complete",
    fileName: `${slot}.jpg`,
    sizeBytes: 1000,
    imageWidth: 1200,
    imageHeight: 1600,
    faceCount: 1,
    faceFrameCoverage: { width: 0.4, height: 0.5 },
    meanBrightness: 120,
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

test("fewer than two comparable photos produces no metrics and counts as consistent", () => {
  const result = checkConsistency([makeRecord("front")]);
  assert.equal(result.consistent, true);
  assert.deepEqual(result.metrics, []);
});

test("similar face-frame coverage and brightness across photos is consistent", () => {
  const records = [
    makeRecord("front", { faceFrameCoverage: { width: 0.4, height: 0.5 }, meanBrightness: 120 }),
    makeRecord("leftFortyFive", { faceFrameCoverage: { width: 0.42, height: 0.5 }, meanBrightness: 130 }),
    makeRecord("rightFortyFive", { faceFrameCoverage: { width: 0.39, height: 0.5 }, meanBrightness: 125 }),
  ];
  const result = checkConsistency(records);
  assert.equal(result.consistent, true);
  assert.deepEqual(result.warnings, []);
});

test("a photo taken much closer/farther away is flagged as inconsistent framing", () => {
  const records = [
    makeRecord("front", { faceFrameCoverage: { width: 0.4, height: 0.5 } }),
    makeRecord("leftFortyFive", { faceFrameCoverage: { width: 0.1, height: 0.15 } }),
  ];
  const result = checkConsistency(records);
  assert.equal(result.consistent, false);
  assert.ok(result.warnings.some((w) => w.toLowerCase().includes("distance") || w.toLowerCase().includes("crop")));
  const frameMetric = result.metrics.find((m) => m.metric === "Face size in frame");
  assert.equal(frameMetric?.consistent, false);
});

test("very different lighting between photos is flagged", () => {
  const records = [
    makeRecord("front", { meanBrightness: 60 }),
    makeRecord("leftProfile", { meanBrightness: 200 }),
  ];
  const result = checkConsistency(records);
  assert.equal(result.consistent, false);
  const brightnessMetric = result.metrics.find((m) => m.metric === "Estimated brightness");
  assert.equal(brightnessMetric?.consistent, false);
});

test("records without faceFrameCoverage/meanBrightness are excluded from those metrics rather than crashing", () => {
  const records = [
    makeRecord("front", { faceFrameCoverage: null, meanBrightness: null }),
    makeRecord("leftProfile", { faceFrameCoverage: null, meanBrightness: null }),
  ];
  const result = checkConsistency(records);
  assert.equal(result.consistent, true);
  assert.deepEqual(result.metrics, []);
});
