/**
 * Regression coverage for the developer-only "Expression Calibration"
 * workflow: the infrastructure to LATER collect and evaluate ≥ 30 real,
 * consenting people for the `expression` category only (movement + line-
 * pattern observations). Nothing here collects or invents real data, and
 * nothing here sets any calibration flag to true — every test in this file
 * runs against zero or synthetic fixture sessions, and asserts that the
 * readiness evaluator is honest about that.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createSession,
  withCalibrationCategory,
  withDatasetSplit,
  withReviewerStatus,
  canTransitionReviewerStatus,
  withExpectations,
  withNotes,
  withPhotoSample,
  validateSession,
  DATASET_SPLITS,
  REVIEWER_STATUSES,
  type CalibrationSession,
} from "../../lib/facial-analysis/calibration/session.ts";
import { emptyExpectations } from "../../lib/facial-analysis/calibration/expectations.ts";
import { compareSession } from "../../lib/facial-analysis/calibration/comparison.ts";
import { CALIBRATION_STATE, VISUAL_OBSERVATIONS_CALIBRATED, isCategoryCalibrated } from "../../lib/facial-analysis/calibration/status.ts";
import { confusionCountsByDomain, confusionCountsForDomain, EXPRESSION_DOMAINS } from "../../lib/facial-analysis/calibration/expressionValidation.ts";
import { evaluateExpressionReadiness, MIN_REAL_PEOPLE } from "../../lib/facial-analysis/calibration/expressionReadiness.ts";
import { createProposal } from "../../lib/facial-analysis/calibration/proposals.ts";
import { VISUAL_THRESHOLDS } from "../../lib/facial-analysis/calibration/thresholds.ts";
import { buildVisualizationPlan } from "../../lib/visualization/build.ts";
import { decideIllustrationEligibility } from "../../lib/visualization/eligibility.ts";
import { evaluateTreatmentOpportunities } from "../../lib/treatment-opportunities/evaluate.ts";
import { buildMogaFaceAnalysis } from "../../lib/observation/build.ts";
import { createEmptyAppearanceConcerns } from "../../lib/assessment/appearanceConcerns.ts";
import { buildFilledAssessment, buildMultiPhotoAnalysisWithFront } from "../observation/fixtures.ts";
import { realSession, slotSample } from "./sessionFixtures.ts";

const ROOT = new URL("../../", import.meta.url).pathname;
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

/** Assigns the expression category and a split to a fixture session, in one place. */
const expr = (s: CalibrationSession, split: "tuning" | "held_out") => withDatasetSplit(withCalibrationCategory(s, "expression"), split);

// ===========================================================================
// A. Empty dataset is not calibrated
// ===========================================================================

test("A. an empty dataset is not calibrated / not ready", () => {
  const r = evaluateExpressionReadiness([]);
  assert.equal(r.ready, false);
  assert.equal(r.sampleCounts.total, 0);
  assert.equal(r.requirements.find((x) => x.id === "sample_count")!.met, false);
  assert.equal(r.requirements.find((x) => x.id === "split_assigned")!.met, false);
  assert.equal(r.requirements.find((x) => x.id === "independent_review")!.met, false);
});

// ===========================================================================
// B. A sample without human expectation cannot count toward validation
// ===========================================================================

test("B. a sample without a human expectation is NOT_RECORDED and contributes nothing to the confusion matrix", () => {
  const s = expr(realSession("REAL-B1", { expectations: {} }), "held_out");
  const row = compareSession(s).find((r) => r.domain === "expression.BROW_RAISE")!;
  assert.equal(row.result, "NOT_RECORDED");
  assert.deepEqual(confusionCountsForDomain([s], "expression.BROW_RAISE"), { truePositives: 0, falsePositives: 0, trueNegatives: 0, falseNegatives: 0, agreementRate: null });
});

test("B. a sample WITH a human expectation is not NOT_RECORDED — the presence of the expectation is what changes", () => {
  const s = expr(realSession("REAL-B2", { expectations: { expression: { BROW_RAISE: "clearly", FROWN: null, SMILE: null, SQUINT: null } } }), "held_out");
  const row = compareSession(s).find((r) => r.domain === "expression.BROW_RAISE")!;
  assert.notEqual(row.result, "NOT_RECORDED");
});

// ===========================================================================
// C. A sample without independent review cannot count toward final sign-off
// ===========================================================================

test("C. a sample without independent review does not count toward sign-off, even with full data", () => {
  const s = expr(realSession("REAL-C1", { expectations: { expression: { BROW_RAISE: "clearly", FROWN: null, SMILE: null, SQUINT: null } } }), "held_out");
  assert.equal(s.reviewerStatus, "not_reviewed");
  const r = evaluateExpressionReadiness([s]);
  assert.equal(r.sampleCounts.independentlyApproved, 0);
  assert.equal(r.requirements.find((x) => x.id === "independent_review")!.met, false);
});

test("C. reviewer status cannot jump straight from not_reviewed to approved — a genuine second look is required", () => {
  assert.equal(canTransitionReviewerStatus("not_reviewed", "approved"), false);
  assert.equal(canTransitionReviewerStatus("not_reviewed", "reviewed"), true);
  assert.equal(canTransitionReviewerStatus("reviewed", "approved"), true);
  const s = realSession("REAL-C2");
  assert.throws(() => withReviewerStatus(s, "approved"));
  const reviewed = withReviewerStatus(s, "reviewed", "looked reasonable");
  const approved = withReviewerStatus(reviewed, "approved", "confirmed independently");
  assert.equal(approved.reviewerStatus, "approved");
  assert.throws(() => withReviewerStatus(approved, "reviewed")); // terminal
});

// ===========================================================================
// D. Held-out samples cannot become tuning samples
// ===========================================================================

test("D. a held-out sample's split is never silently changed by any other session operation", () => {
  let s = withDatasetSplit(createSession("REAL-D1"), "held_out");
  s = withNotes(s, "note");
  s = withExpectations(s, emptyExpectations());
  s = withCalibrationCategory(s, "expression");
  s = withPhotoSample(s, "front", slotSample("front"));
  assert.equal(s.datasetSplit, "held_out");
});

test("D. held-out evidence is rejected outright when proposing a threshold change", () => {
  const r = createProposal(
    { thresholdId: "lineContrast.ratio", proposedValue: 1.38, reason: "Pattern noticed while reviewing held-out samples.", evidenceSampleIds: ["REAL-D2"] },
    { heldOutSessionIds: ["REAL-D2"] },
  );
  assert.equal(r.ok, false);
  assert.match(!r.ok ? r.problems.join() : "", /held-out sample.*cannot be used to propose/);
});

// ===========================================================================
// E. Tuning samples cannot accidentally become held-out samples
// ===========================================================================

test("E. a tuning sample's split is never silently changed by any other session operation", () => {
  let s = withDatasetSplit(createSession("REAL-E1"), "tuning");
  s = withNotes(s, "note");
  s = withExpectations(s, emptyExpectations());
  s = withCalibrationCategory(s, "expression");
  s = withPhotoSample(s, "front", slotSample("front"));
  assert.equal(s.datasetSplit, "tuning");
});

test("E. a session is never both tuning and held-out at once — the type makes the invalid state unrepresentable", () => {
  assert.deepEqual([...DATASET_SPLITS], ["tuning", "held_out"]);
  const s = createSession("REAL-E2");
  assert.equal(s.datasetSplit, null); // not defaulted to either side
});

// ===========================================================================
// F. MogaFace results and human expectations are stored separately
// ===========================================================================

test("F. MogaFace's result and the human expectation live in separate places, and comparison is a distinct third thing", () => {
  const s = realSession("REAL-F1");
  assert.ok(s.videoSample && !("expectations" in s.videoSample));
  assert.ok(!("thresholdDecisions" in s.expectations) && !("generatedObservations" in s.expectations));
  const row = compareSession(s).find((r) => r.domain === "expression.BROW_RAISE")!;
  assert.ok("expected" in row && "actual" in row && "result" in row);
  // the row is neither the raw expectation nor the raw actual — it is derived from both
  assert.notDeepEqual(row.actual, row.expected);
});

// ===========================================================================
// G. False-positive/validation calculations handle empty datasets safely
// ===========================================================================

test("G. confusion counts on an empty dataset are all-zero with a null agreement rate, never a misleading 0% or 100%", () => {
  const counts = confusionCountsByDomain([]);
  for (const domain of EXPRESSION_DOMAINS) {
    assert.deepEqual(counts[domain], { truePositives: 0, falsePositives: 0, trueNegatives: 0, falseNegatives: 0, agreementRate: null }, domain);
  }
});

// ===========================================================================
// H. Threshold changes are not applied automatically
// ===========================================================================

test("H. creating a threshold proposal never applies it — the registry and calibration state are untouched", () => {
  const before = JSON.stringify(VISUAL_THRESHOLDS);
  const r = createProposal({ thresholdId: "lineContrast.ratio", proposedValue: 1.38, reason: "Repeated pattern across tuning samples reviewed.", evidenceSampleIds: ["REAL-H1", "REAL-H2", "REAL-H3"], author: "eng-reviewer-1" });
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.proposal.author, "eng-reviewer-1");
  assert.equal(JSON.stringify(VISUAL_THRESHOLDS), before, "the registry is untouched");
  assert.equal(CALIBRATION_STATE.expression, false, "the calibration flag is untouched");
});

// ===========================================================================
// I. Calibration state remains false for every category
// ===========================================================================

test("I. calibration state remains false for every category after this work", () => {
  assert.deepEqual(CALIBRATION_STATE, { expression: false, "facialStructure.contour": false, "eyeArea.underEye": false });
  assert.equal(VISUAL_OBSERVATIONS_CALIBRATED, false);
});

// ===========================================================================
// J. Existing production visualization eligibility remains false
// ===========================================================================

test("J. production visualization eligibility remains false for expression_lines", () => {
  const assessment = buildFilledAssessment();
  assessment.goals = { areas: [], priorities: [] };
  assessment.appearanceConcerns = { ...createEmptyAppearanceConcerns(), selected: ["FACIAL_LINES"] };
  const analysis = buildMogaFaceAnalysis(assessment, buildMultiPhotoAnalysisWithFront());
  const opportunities = evaluateTreatmentOpportunities({ assessment, analysis });
  const plan = buildVisualizationPlan({ frontPhoto: { ref: "blob:x", qualityValid: true }, opportunities });
  const decision = decideIllustrationEligibility(plan, opportunities); // no calibrated override — the real production call shape
  assert.equal(decision.eligible, false);
});

// ===========================================================================
// K. Contour and under-eye are completely unaffected
// ===========================================================================

test("K. contour and under-eye remain gated, even hypothetically alongside an expression=true", () => {
  assert.equal(isCategoryCalibrated("facialStructure.contour"), false);
  assert.equal(isCategoryCalibrated("eyeArea.underEye"), false);
  const before = CALIBRATION_STATE.expression;
  CALIBRATION_STATE.expression = true;
  try {
    assert.equal(isCategoryCalibrated("facialStructure.contour"), false);
    assert.equal(isCategoryCalibrated("eyeArea.underEye"), false);
  } finally {
    CALIBRATION_STATE.expression = before;
  }
  assert.equal(CALIBRATION_STATE.expression, false, "state restored — this test simulates a hypothetical, it decides nothing");
});

test("K. the expression-only readiness evaluator never reports contour/under-eye data", () => {
  const r = evaluateExpressionReadiness([expr(realSession("REAL-K1"), "held_out")]);
  for (const d of r.tuningAggregate.domains) assert.doesNotMatch(d.domain, /contour|underEye/);
  for (const d of r.heldOutAggregate.domains) assert.doesNotMatch(d.domain, /contour|underEye/);
});

// ===========================================================================
// L. No API key or image/video bytes are written into logs
// ===========================================================================

test("L. the new expression-calibration modules never log, and carry no API key or media reference", () => {
  for (const path of [
    "lib/facial-analysis/calibration/expressionValidation.ts",
    "lib/facial-analysis/calibration/expressionReadiness.ts",
    "lib/facial-analysis/calibration/session.ts",
  ]) {
    const src = read(path);
    assert.doesNotMatch(src, /console\.(log|info|warn|error|debug)/, path);
    assert.doesNotMatch(src, /OPENAI_API_KEY|process\.env/, path);
    assert.doesNotMatch(src, /base64|dataURL|data:image|blob:/i, path);
  }
});

// ===========================================================================
// M. No OpenAI request is made by the calibration workflow
// ===========================================================================

test("M. no OpenAI/network request exists anywhere in the new expression-calibration modules", () => {
  for (const path of [
    "lib/facial-analysis/calibration/expressionValidation.ts",
    "lib/facial-analysis/calibration/expressionReadiness.ts",
    "lib/facial-analysis/calibration/session.ts",
    "lib/facial-analysis/calibration/proposals.ts",
  ]) {
    const src = read(path);
    assert.doesNotMatch(src, /fetch\(|XMLHttpRequest|openai/i, path);
  }
});

// ===========================================================================
// Supplementary coverage
// ===========================================================================

test("session validation accepts the new fields with their default values, and rejects invalid ones", () => {
  const s = createSession("REAL-S1");
  assert.deepEqual(validateSession(s), []);
  assert.deepEqual([...REVIEWER_STATUSES], ["not_reviewed", "reviewed", "approved", "rejected"]);
  assert.match(validateSession({ ...s, datasetSplit: "both" }).join(), /datasetSplit/);
  assert.match(validateSession({ ...s, reviewerStatus: "definitely_reviewed" }).join(), /reviewerStatus/);
  assert.match(validateSession({ ...s, calibrationCategory: "skin" }).join(), /calibrationCategory/);
  assert.deepEqual(validateSession(withDatasetSplit(withCalibrationCategory(s, "expression"), "tuning")), []);
});

test("readiness stays false while a threshold proposal is still PROPOSED, and true only requires every listed requirement (composition, not a shortcut)", () => {
  const proposed = createProposal({ thresholdId: "lineContrast.ratio", proposedValue: 1.38, reason: "Placeholder reason text.", evidenceSampleIds: ["REAL-T1"] });
  assert.ok(proposed.ok);
  const r = evaluateExpressionReadiness([], { thresholdProposals: proposed.ok ? [proposed.proposal] : [] });
  assert.equal(r.requirements.find((x) => x.id === "threshold_changes_reviewed")!.met, false);
  assert.equal(r.ready, false);
});

test("MIN_REAL_PEOPLE matches the documented minimum (≥ 30) — not a weaker, invented standard", () => {
  assert.equal(MIN_REAL_PEOPLE, 30);
  const doc = read("docs/VISUAL_CALIBRATION.md");
  assert.match(doc, /≥ 30 distinct consenting people/);
});
