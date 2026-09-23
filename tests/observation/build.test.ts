import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMogaFaceAnalysis } from "../../lib/observation/build.ts";
import { validateObservation } from "../../lib/observation/validate.ts";
import { ANALYSIS_LIMITATIONS } from "../../lib/observation/limitations.ts";
import { FACIAL_ANALYSIS_METHODOLOGY_VERSION, OBSERVATION_ENGINE_VERSION } from "../../lib/observation/versions.ts";
import { buildFilledAssessment, buildMultiPhotoAnalysisWithFront } from "./fixtures.ts";

test("versions object records methodology, observation engine, analysis, multi-photo, and assessment versions", () => {
  const result = buildMogaFaceAnalysis(buildFilledAssessment(), buildMultiPhotoAnalysisWithFront());
  assert.equal(result.versions.facialAnalysisMethodologyVersion, FACIAL_ANALYSIS_METHODOLOGY_VERSION);
  assert.equal(result.versions.observationEngineVersion, OBSERVATION_ENGINE_VERSION);
  assert.match(result.versions.analysisVersion, /^\d+\.\d+\.\d+$/);
  assert.equal(result.versions.multiPhotoAnalysisVersion, "0.1.0");
  assert.equal(result.versions.assessmentVersion, "0.1.0");
});

test("multiPhotoAnalysisVersion is null (not fabricated) when no photo analysis has run yet", () => {
  const result = buildMogaFaceAnalysis(buildFilledAssessment(), null);
  assert.equal(result.versions.multiPhotoAnalysisVersion, null);
});

test("limitations are carried through verbatim and are never empty", () => {
  const result = buildMogaFaceAnalysis(buildFilledAssessment(), null);
  assert.deepEqual(result.limitations, ANALYSIS_LIMITATIONS);
  assert.ok(result.limitations.length > 0);
});

test("the flattened observations list contains every domain's observations and each one is well-formed", () => {
  const result = buildMogaFaceAnalysis(buildFilledAssessment(), buildMultiPhotoAnalysisWithFront());

  const expectedCount =
    result.facialStructure.measured.length +
    result.eyeArea.measured.length +
    result.eyeArea.userReported.length +
    result.hair.userReported.length +
    result.facialHair.userReported.length +
    result.skin.userReported.length +
    result.lifestyle.userReported.length +
    result.style.userReported.length;

  assert.equal(result.observations.length, expectedCount);
  assert.ok(result.observations.length > 10);
  for (const obs of result.observations) {
    assert.deepEqual(validateObservation(obs), [], `observation ${obs.id} should be well-formed`);
  }
});

test("no observation's own data (not the limitations disclaimer) claims an attractiveness/beauty verdict", () => {
  const result = buildMogaFaceAnalysis(buildFilledAssessment(), buildMultiPhotoAnalysisWithFront());
  // Scoped to the observations themselves, not `result.limitations` — that
  // array is expected to explicitly disclaim these words ("No
  // attractiveness... score exists"), which would otherwise false-positive.
  const serialized = JSON.stringify(result.observations).toLowerCase();
  for (const forbidden of ["attractive", "beautiful", "ugly", "ideal proportion", "masculine score", "feminine score"]) {
    assert.ok(!serialized.includes(forbidden), `an observation unexpectedly mentions "${forbidden}"`);
  }
});

test("domain completeness: an assessment with nothing answered and no photos still produces a valid, empty-but-well-formed analysis", () => {
  const empty = buildFilledAssessment();
  empty.hair = { length: null, texture: null, density: null, concerns: [], currentStyle: "", haircutFrequency: null };
  const result = buildMogaFaceAnalysis(empty, null);
  assert.deepEqual(result.hair.userReported, []);
  assert.deepEqual(result.facialStructure.measured, []);
  assert.equal(result.skin.status, "not_implemented");
});
