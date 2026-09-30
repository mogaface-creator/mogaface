/**
 * The goal-driven Prediction Engine (lib/visualization/predict.ts):
 * deterministic PredictionPlan construction from real questionnaire answers
 * and real (possibly uncalibrated) visual observations — independent of
 * CALIBRATION_STATE and of the treatment-opportunity pathway.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPredictionPlan, PROHIBITED_CHANGES, PREDICTION_CATEGORY_POLICY } from "../../lib/visualization/predict.ts";
import { PRESERVATION_RULES, VISUALIZATION_DISCLAIMER } from "../../lib/visualization/types.ts";
import { createEmptyAssessment } from "../../lib/assessment/defaults.ts";
import { buildMogaFaceAnalysis } from "../../lib/observation/build.ts";
import { measuredObservation } from "../../lib/observation/helpers.ts";
import type { Assessment } from "../../lib/assessment/types.ts";
import type { AppearanceConcernId, AppearanceConcernDetailId } from "../../lib/assessment/appearanceConcerns.ts";
import type { MogaFaceAnalysis } from "../../lib/observation/types.ts";

function baseAssessment(selected: AppearanceConcernId[], details: AppearanceConcernDetailId[] = []): Assessment {
  const a = createEmptyAssessment();
  a.appearanceConcerns = { ...a.appearanceConcerns, selected, details, priorities: selected.slice(0, 3) };
  return a;
}

function emptyAnalysis(assessment: Assessment): MogaFaceAnalysis {
  return buildMogaFaceAnalysis(assessment, null);
}

function withExpressionEvidence(analysis: MogaFaceAnalysis): MogaFaceAnalysis {
  analysis.observations.push(
    measuredObservation({ id: "expression.browRaise.foreheadRegionMovementPct", domain: "expression", label: "Brow raise movement", value: 24, source: "video_frame_0" }),
  );
  return analysis;
}

function withContourEvidence(analysis: MogaFaceAnalysis): MogaFaceAnalysis {
  analysis.observations.push(
    measuredObservation({ id: "facialStructure.contour.cheekContourAngle.front.left", domain: "facial-structure", label: "Cheek contour angle", value: 140, source: "front" }),
  );
  return analysis;
}

function withUnderEyeEvidence(analysis: MogaFaceAnalysis): MogaFaceAnalysis {
  analysis.observations.push(
    measuredObservation({ id: "eyeArea.visibleUnderEyeDarkness", domain: "eye-area", label: "Visible under-eye darkness", value: true, source: "front" }),
  );
  return analysis;
}

const QUALITY_VALID_FRONT = { ref: "test-front", qualityValid: true };

test("A. a real, self-reported goal + real (uncalibrated) video evidence + a valid front photo produces a planned prediction with one change", () => {
  const assessment = baseAssessment(["FACIAL_LINES"], ["FOREHEAD_LINES"]);
  const analysis = withExpressionEvidence(emptyAnalysis(assessment));
  const plan = buildPredictionPlan({ assessment, analysis, frontPhoto: QUALITY_VALID_FRONT });
  assert.equal(plan.status, "planned");
  assert.equal(plan.changes.length, 1);
  assert.equal(plan.changes[0].category, "expression_lines");
  assert.equal(plan.changes[0].consumerReady, true);
});

test("B. questionnaire mapping: FACIAL_DEFINITION -> facial_contour (with contour evidence), SKIN_TEXTURE -> skin_appearance (photo-grounded only), UNDER_EYE -> under_eye (with darkness observation)", () => {
  const contourAssessment = baseAssessment(["FACIAL_DEFINITION"]);
  const contourPlan = buildPredictionPlan({ assessment: contourAssessment, analysis: withContourEvidence(emptyAnalysis(contourAssessment)), frontPhoto: QUALITY_VALID_FRONT });
  assert.equal(contourPlan.status, "planned");
  assert.deepEqual(contourPlan.changes.map((c) => c.category), ["facial_contour"]);

  const skinAssessment = baseAssessment(["SKIN_TEXTURE"]);
  const skinPlan = buildPredictionPlan({ assessment: skinAssessment, analysis: emptyAnalysis(skinAssessment), frontPhoto: QUALITY_VALID_FRONT });
  assert.equal(skinPlan.status, "planned", "skin_appearance needs no CV observation — the front photo itself is the grounding");
  assert.deepEqual(skinPlan.changes.map((c) => c.category), ["skin_appearance"]);

  const underEyeAssessment = baseAssessment(["UNDER_EYE"], ["DARK_LOOKING_UNDER_EYES"]);
  const underEyePlan = buildPredictionPlan({ assessment: underEyeAssessment, analysis: withUnderEyeEvidence(emptyAnalysis(underEyeAssessment)), frontPhoto: QUALITY_VALID_FRONT });
  assert.equal(underEyePlan.status, "planned");
  assert.deepEqual(underEyePlan.changes.map((c) => c.category), ["under_eye"]);
});

test("C. multiple goals produce multiple independently evidenced changes in ONE plan", () => {
  const assessment = baseAssessment(["FACIAL_LINES", "FACIAL_DEFINITION", "SKIN_TEXTURE"]);
  let analysis = emptyAnalysis(assessment);
  analysis = withExpressionEvidence(analysis);
  analysis = withContourEvidence(analysis);
  const plan = buildPredictionPlan({ assessment, analysis, frontPhoto: QUALITY_VALID_FRONT });
  assert.equal(plan.status, "planned");
  const categories = plan.changes.map((c) => c.category).sort();
  assert.deepEqual(categories, ["expression_lines", "facial_contour", "skin_appearance"]);
});

test("D. unsupported goals never produce a change: FACIAL_VOLUME, FACIAL_LIFTING, OVERALL_APPEARANCE and NOT_SURE map to no visualization category", () => {
  for (const concern of ["FACIAL_VOLUME", "FACIAL_LIFTING", "OVERALL_APPEARANCE"] as AppearanceConcernId[]) {
    const assessment = baseAssessment([concern]);
    const plan = buildPredictionPlan({ assessment, analysis: emptyAnalysis(assessment), frontPhoto: QUALITY_VALID_FRONT });
    assert.equal(plan.status, "not_eligible", concern);
    assert.equal(plan.changes.length, 0, concern);
  }
  const notSure = baseAssessment(["NOT_SURE"]);
  const notSurePlan = buildPredictionPlan({ assessment: notSure, analysis: emptyAnalysis(notSure), frontPhoto: QUALITY_VALID_FRONT });
  assert.equal(notSurePlan.status, "not_eligible");
});

test("D2. jawline_definition is never produced by any goal, even facial-definition detail selections", () => {
  const assessment = baseAssessment(["FACIAL_DEFINITION"], ["JAW_DEFINITION"]);
  const plan = buildPredictionPlan({ assessment, analysis: withContourEvidence(emptyAnalysis(assessment)), frontPhoto: QUALITY_VALID_FRONT });
  assert.ok(!plan.changes.some((c) => c.category === "jawline_definition"));
  assert.equal(PREDICTION_CATEGORY_POLICY.jawline_definition, false);
});

test("E. every produced change stays at the safety ceiling: intensity is always 'subtle', never anything stronger", () => {
  const assessment = baseAssessment(["FACIAL_LINES", "FACIAL_DEFINITION"]);
  let analysis = emptyAnalysis(assessment);
  analysis = withExpressionEvidence(analysis);
  analysis = withContourEvidence(analysis);
  const plan = buildPredictionPlan({ assessment, analysis, frontPhoto: QUALITY_VALID_FRONT });
  assert.ok(plan.changes.length > 0);
  for (const c of plan.changes) {
    assert.equal(c.intensity, "subtle");
    assert.equal(c.intensityLimit, "subtle");
  }
});

test("F. preservation rules are the exact, unmodified, fixed PRESERVATION_RULES list", () => {
  const assessment = baseAssessment(["FACIAL_LINES"]);
  const plan = buildPredictionPlan({ assessment, analysis: withExpressionEvidence(emptyAnalysis(assessment)), frontPhoto: QUALITY_VALID_FRONT });
  assert.equal(plan.preserve, PRESERVATION_RULES);
  assert.deepEqual(plan.disclaimer, VISUALIZATION_DISCLAIMER);
});

test("G. prohibited changes are present, fixed, and cover the required categories (ethnicity, age, unrelated features, beautification, dramatic transformation)", () => {
  const assessment = baseAssessment(["FACIAL_LINES"]);
  const plan = buildPredictionPlan({ assessment, analysis: withExpressionEvidence(emptyAnalysis(assessment)), frontPhoto: QUALITY_VALID_FRONT });
  assert.equal(plan.prohibited, PROHIBITED_CHANGES);
  const joined = PROHIBITED_CHANGES.join(" | ").toLowerCase();
  for (const must of ["ethnicity", "apparent age", "beautification", "eye shape", "nose shape", "lip shape", "background", "camera angle", "different person"]) {
    assert.ok(joined.includes(must), must);
  }
});

test("H/M. buildPredictionPlan is a pure, deterministic function of its input — same input twice produces an equal plan", () => {
  const assessment = baseAssessment(["FACIAL_LINES", "SKIN_TEXTURE"]);
  const analysis = withExpressionEvidence(emptyAnalysis(assessment));
  const planA = buildPredictionPlan({ assessment, analysis, frontPhoto: QUALITY_VALID_FRONT });
  const planB = buildPredictionPlan({ assessment, analysis, frontPhoto: QUALITY_VALID_FRONT });
  assert.deepEqual(planA, planB);
});

test("J. missing visual context: an assessment with goals but an analysis with zero observations excludes every observation-requiring category", () => {
  const assessment = baseAssessment(["FACIAL_LINES", "FACIAL_DEFINITION", "UNDER_EYE"], ["DARK_LOOKING_UNDER_EYES"]);
  const plan = buildPredictionPlan({ assessment, analysis: emptyAnalysis(assessment), frontPhoto: QUALITY_VALID_FRONT });
  assert.equal(plan.status, "not_eligible");
  assert.equal(plan.changes.length, 0);
  assert.ok(plan.excludedChanges.some((e) => e.category === "expression_lines"));
  assert.ok(plan.excludedChanges.some((e) => e.category === "facial_contour"));
  assert.ok(plan.excludedChanges.some((e) => e.category === "under_eye"));
});

test("K. optional video: no video evidence excludes expression_lines specifically, while a goal with real (non-video) evidence still succeeds", () => {
  const assessment = baseAssessment(["FACIAL_LINES", "FACIAL_DEFINITION"]);
  const plan = buildPredictionPlan({ assessment, analysis: withContourEvidence(emptyAnalysis(assessment)), frontPhoto: QUALITY_VALID_FRONT });
  assert.equal(plan.status, "planned");
  assert.deepEqual(plan.changes.map((c) => c.category), ["facial_contour"]);
  assert.ok(plan.excludedChanges.some((e) => e.category === "expression_lines"));
});

test("L. invalid/empty goals: no selected concerns at all produces a not_eligible plan with empty goals", () => {
  const assessment = baseAssessment([]);
  const plan = buildPredictionPlan({ assessment, analysis: emptyAnalysis(assessment), frontPhoto: QUALITY_VALID_FRONT });
  assert.equal(plan.status, "not_eligible");
  assert.equal(plan.ineligibleReason, "no_supported_change");
  assert.deepEqual(plan.goals, []);
});

test("no front photo, and a front photo that failed quality, are both not_eligible regardless of goals/evidence", () => {
  const assessment = baseAssessment(["FACIAL_LINES"]);
  const analysis = withExpressionEvidence(emptyAnalysis(assessment));
  const noPhoto = buildPredictionPlan({ assessment, analysis, frontPhoto: null });
  assert.equal(noPhoto.status, "not_eligible");
  assert.equal(noPhoto.ineligibleReason, "no_front_photo");
  const badQuality = buildPredictionPlan({ assessment, analysis, frontPhoto: { ref: "x", qualityValid: false } });
  assert.equal(badQuality.status, "not_eligible");
  assert.equal(badQuality.ineligibleReason, "front_photo_quality");
});

test("goals lists every selected concern, whether or not it ended up illustrated", () => {
  const assessment = baseAssessment(["FACIAL_LINES", "FACIAL_LIFTING"]); // lifting has no visualization category at all
  const plan = buildPredictionPlan({ assessment, analysis: withExpressionEvidence(emptyAnalysis(assessment)), frontPhoto: QUALITY_VALID_FRONT });
  assert.deepEqual(plan.goals, ["FACIAL_LINES", "FACIAL_LIFTING"]);
  assert.deepEqual(plan.changes.map((c) => c.category), ["expression_lines"]);
});

// ===========================================================================
// Hair/scalp appearance — additive category, reusing existing hair questionnaire fields
// ===========================================================================

test("N. hair.concerns (hairline/thinning/scalp) grounds a hair_appearance change from the real photo alone — no CV observation required, same as skin_appearance", () => {
  const assessment = createEmptyAssessment();
  assessment.hair = { ...assessment.hair, concerns: ["hairline"] };
  const plan = buildPredictionPlan({ assessment, analysis: emptyAnalysis(assessment), frontPhoto: QUALITY_VALID_FRONT });
  assert.equal(plan.status, "planned");
  assert.deepEqual(plan.changes.map((c) => c.category), ["hair_appearance"]);
  assert.equal(plan.changes[0].intensity, "subtle");
});

test("N2. hair.concerns unrelated to appearance (dryness, frizz, styling, haircut, none, other) ground nothing", () => {
  for (const concern of ["dryness", "frizz", "styling", "haircut", "none", "other"] as const) {
    const assessment = createEmptyAssessment();
    assessment.hair = { ...assessment.hair, concerns: [concern] };
    const plan = buildPredictionPlan({ assessment, analysis: emptyAnalysis(assessment), frontPhoto: QUALITY_VALID_FRONT });
    assert.equal(plan.status, "not_eligible", concern);
  }
});

test("N3. the old broad goals fields (goals.areas 'hair', goals.priorities 'improveHair') also ground hair_appearance — every existing real hair-related field is used, nothing new invented", () => {
  const assessment = createEmptyAssessment();
  assessment.goals = { areas: ["hair"], priorities: ["improveHair"] };
  const plan = buildPredictionPlan({ assessment, analysis: emptyAnalysis(assessment), frontPhoto: QUALITY_VALID_FRONT });
  assert.equal(plan.status, "planned");
  assert.deepEqual(plan.changes.map((c) => c.category), ["hair_appearance"]);
});

test("N4. the hair_appearance instruction never diagnoses, never claims regrowth/suitability, never creates extreme density, and preserves hair texture/style/color", () => {
  const assessment = createEmptyAssessment();
  assessment.hair = { ...assessment.hair, concerns: ["thinning", "scalp"] };
  const plan = buildPredictionPlan({ assessment, analysis: emptyAnalysis(assessment), frontPhoto: QUALITY_VALID_FRONT });
  const change = plan.changes.find((c) => c.category === "hair_appearance")!;
  assert.ok(change);
  for (const bad of [/hair loss/i, /balding/i, /regrowth/i, /suitab/i, /candidate/i, /guarantee/i, /extreme/i, /transplant/i, /minoxidil/i, /finasteride/i]) {
    assert.doesNotMatch(change.visualInstruction, bad);
    assert.doesNotMatch(change.description, bad);
  }
  assert.match(change.visualInstruction, /texture, color and general style unchanged/i);
});
