import { test } from "node:test";
import assert from "node:assert/strict";
import { buildFacialStructureAnalysis, buildEyeAreaAnalysis } from "../../lib/observation/photoDomains.ts";
import { buildMultiPhotoAnalysisWithFront } from "./fixtures.ts";

test("facial structure has no measured observations without a multi-photo analysis (domain completeness: honest empty state)", () => {
  const result = buildFacialStructureAnalysis(null);
  assert.deepEqual(result.measured, []);
});

test("facial structure produces measured observations, all type=measured, from a complete front photo", () => {
  const analysis = buildMultiPhotoAnalysisWithFront();
  const result = buildFacialStructureAnalysis(analysis);
  assert.ok(result.measured.length > 0);
  for (const obs of result.measured) {
    assert.equal(obs.type, "measured");
    assert.equal(obs.confidence, "not_calibrated");
    assert.equal(obs.source, "front");
    assert.equal(obs.domain, "facial-structure");
    assert.ok(Number.isFinite(obs.value));
  }
  const widthObs = result.measured.find((o) => o.id === "facialStructure.faceWidth");
  assert.equal(widthObs?.value, analysis.photos[0].measurements!.face.width);
});

test("facial structure's inference is an honest not_available placeholder, never a real conclusion (inferred/unavailable observation)", () => {
  const result = buildFacialStructureAnalysis(null);
  assert.equal(result.inferences.length, 1);
  const inference = result.inferences[0];
  assert.equal(inference.observationType, "inferred");
  assert.equal(inference.status, "not_available");
  assert.deepEqual(inference.evidence, []);
  assert.equal(inference.methodology, null);
});

test("eye area measured observations come only from front, split correctly from facial-structure symmetry metrics", () => {
  const analysis = buildMultiPhotoAnalysisWithFront();
  const eyeArea = buildEyeAreaAnalysis(analysis);
  const structure = buildFacialStructureAnalysis(analysis);

  assert.ok(eyeArea.measured.some((o) => o.id === "eyeArea.interocularDistance"));
  assert.ok(eyeArea.measured.some((o) => o.label === "Eye width symmetry"));
  // Eye symmetry metrics must not also appear under facial structure.
  assert.ok(!structure.measured.some((o) => o.label === "Eye width symmetry"));
  // Nose/mouth/lower-face symmetry must not appear under eye area.
  assert.ok(!eyeArea.measured.some((o) => o.label === "Nose alignment"));
});

test("eye area has no user-reported or inferred observations yet (nothing collected, no defensible methodology)", () => {
  const eyeArea = buildEyeAreaAnalysis(buildMultiPhotoAnalysisWithFront());
  assert.deepEqual(eyeArea.userReported, []);
  assert.deepEqual(eyeArea.inferences, []);
});
