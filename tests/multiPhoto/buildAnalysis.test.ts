import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMultiPhotoAnalysis } from "../../lib/facial-analysis/multiPhoto/coordinator.ts";
import { createIdleRecord, MULTI_PHOTO_ANALYSIS_VERSION } from "../../lib/facial-analysis/multiPhoto/types.ts";
import { ANALYSIS_VERSION } from "../../lib/facial-analysis/analysis.ts";
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

function fullyAnalyzedFront(): PhotoAnalysisRecord {
  const landmarks = buildSymmetricFace();
  const measurements = calculateMeasurements(landmarks);
  const symmetry = calculateSymmetry(landmarks, measurements);
  const proportions = calculateProportions(measurements);
  return baseRecord("front", { landmarks, measurements, symmetry, proportions });
}

test("multiPhotoAnalysisVersion and the single-photo analysisVersion are separate, independently-tracked constants", () => {
  // Both happen to be "0.1.0" today (both are new). They track different
  // things — analysisVersion is the per-photo formulas (measurements.ts /
  // symmetry.ts / proportions.ts), multiPhotoAnalysisVersion is this
  // combination layer's own rules (combine.ts / consistency.ts) — so a
  // future change to one must not require bumping the other.
  assert.match(MULTI_PHOTO_ANALYSIS_VERSION, /^\d+\.\d+\.\d+$/);
  assert.match(ANALYSIS_VERSION, /^\d+\.\d+\.\d+$/);
});

test("buildMultiPhotoAnalysis stamps the assessment id, version, and a timestamp", () => {
  const result = buildMultiPhotoAnalysis("assessment-123", [fullyAnalyzedFront()]);
  assert.equal(result.assessmentId, "assessment-123");
  assert.equal(result.multiPhotoAnalysisVersion, MULTI_PHOTO_ANALYSIS_VERSION);
  assert.ok(!Number.isNaN(Date.parse(result.createdAt)));
});

test("a missing photo (fewer than 5 records) does not crash the build", () => {
  const result = buildMultiPhotoAnalysis("assessment-1", [fullyAnalyzedFront()]);
  assert.equal(result.photos.length, 1);
  assert.equal(result.consistency.consistent, true); // only 1 comparable photo — nothing to flag
});

test("a failed photo (status error) is carried through without breaking the other photos' results", () => {
  const front = fullyAnalyzedFront();
  const failed = baseRecord("rightFortyFive", {
    status: "error",
    errors: ["Face analysis failed on this image. Try a different photo."],
    faceFrameCoverage: null,
    meanBrightness: null,
  });
  const result = buildMultiPhotoAnalysis("assessment-1", [front, failed]);

  assert.equal(result.photos.find((p) => p.slot === "rightFortyFive")?.status, "error");
  // Front's own combined result is unaffected by the sibling failure.
  const widthHeight = result.combinedMeasurements.metrics.find((m) => m.metric === "Face width/height ratio");
  assert.equal(widthHeight?.value, front.measurements!.face.widthHeightRatio);
});

test("replacing one photo's record and rebuilding only changes results derived from that slot", () => {
  const front = fullyAnalyzedFront();
  const oldLeft45 = baseRecord("leftFortyFive", { faceFrameCoverage: { width: 0.4, height: 0.5 } });
  const before = buildMultiPhotoAnalysis("assessment-1", [front, oldLeft45]);

  const newLeft45 = baseRecord("leftFortyFive", { faceFrameCoverage: { width: 0.1, height: 0.15 } });
  const after = buildMultiPhotoAnalysis("assessment-1", [front, newLeft45]);

  // Front-derived combined measurements are identical before and after (front record untouched).
  assert.deepEqual(before.combinedMeasurements, after.combinedMeasurements);
  // The consistency check reacts to the replaced photo's new (very different) framing.
  assert.equal(before.consistency.consistent, true);
  assert.equal(after.consistency.consistent, false);
});

test("createIdleRecord starts a photo in the idle status with no results yet", () => {
  const file = { name: "front.jpg", size: 2048 } as File;
  const record = createIdleRecord("front", file);
  assert.equal(record.status, "idle");
  assert.equal(record.measurements, null);
  assert.equal(record.errors.length, 0);
});
