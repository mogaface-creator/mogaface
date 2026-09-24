import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateTreatmentOpportunities, buildEvaluationContext } from "../../lib/treatment-opportunities/evaluate.ts";
import { TREATMENT_OPPORTUNITY_ENGINE_VERSION } from "../../lib/treatment-opportunities/versions.ts";
import { validateOpportunity } from "../../lib/treatment-opportunities/validate.ts";
import { buildMogaFaceAnalysis } from "../../lib/observation/build.ts";
import { createEmptyAssessment } from "../../lib/assessment/defaults.ts";
import { analysisWithFront, assessmentWithGoals, visualFeature } from "./fixtures.ts";

test("conservative default: an empty assessment yields no opportunities", () => {
  assert.deepEqual(evaluateTreatmentOpportunities({ assessment: createEmptyAssessment(), analysis: analysisWithFront() }), []);
});

test("conservative: photos alone (no user goal) yield no opportunities", () => {
  const assessment = assessmentWithGoals([], ["face", "hair"]);
  assert.deepEqual(evaluateTreatmentOpportunities({ assessment, analysis: analysisWithFront() }), []);
});

test("user goal + observation combination: 'look more defined' + front measurements → low FACIAL_CONTOURING", () => {
  const out = evaluateTreatmentOpportunities({ assessment: assessmentWithGoals(["lookMoreDefined"]), analysis: analysisWithFront() });
  assert.equal(out.length, 1);
  assert.equal(out[0].category, "FACIAL_CONTOURING");
  assert.equal(out[0].confidence, "low");
  assert.deepEqual(out[0].evidenceQuestionIds, ["goals.priorities.lookMoreDefined"]);
  assert.ok(out[0].evidenceObservationIds.includes("facialStructure.jawWidth"));
});

test("multiple opportunities from one assessment: contour + skin", () => {
  const out = evaluateTreatmentOpportunities({
    assessment: assessmentWithGoals(["lookMoreDefined", "improveSkin"], ["jawDefinition"]),
    analysis: analysisWithFront(),
  });
  assert.deepEqual(out.map((o) => o.category), ["FACIAL_CONTOURING", "SKIN_TREATMENT"]);
  // definition (general) + jaw definition (explicit) merge into ONE contouring opportunity, at moderate.
  assert.equal(out[0].confidence, "moderate");
  assert.equal(out[0].evidenceQuestionIds.length, 2);
});

test("no duplicate opportunities: ids are unique and repeated goals don't repeat opportunities", () => {
  const assessment = assessmentWithGoals(["lookMoreDefined", "lookMoreDefined", "improveSkin"], ["skin", "skin", "jawDefinition"]);
  const out = evaluateTreatmentOpportunities({ assessment, analysis: analysisWithFront() });
  const ids = out.map((o) => o.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(out.filter((o) => o.category === "SKIN_TREATMENT").length, 1);
});

test("real app data cannot produce lines/lifting opportunities: those rules need evidence no layer emits yet", () => {
  const out = evaluateTreatmentOpportunities({
    assessment: assessmentWithGoals(["lookMoreDefined", "improveSkin", "improveHair", "overallGlowUp"], ["face", "skin", "jawDefinition"]),
    analysis: analysisWithFront(),
  });
  assert.ok(out.every((o) => o.category !== "NEUROMODULATOR" && o.category !== "FACIAL_LIFTING" && o.category !== "DERMAL_FILLER"));
});

test("insufficient evidence: goal but no photo analysis → not_available, no category, no confidence", () => {
  const out = evaluateTreatmentOpportunities({ assessment: assessmentWithGoals([], ["jawDefinition"]), analysis: null });
  assert.equal(out.length, 1);
  assert.equal(out[0].status, "not_available");
  assert.equal(out[0].category, null);
  assert.equal(out[0].confidence, null);
  assert.deepEqual(validateOpportunity(out[0]), []);
});

test("insufficient evidence: analysis with no measured observations is treated as no analysis", () => {
  const empty = buildMogaFaceAnalysis(assessmentWithGoals([], ["jawDefinition"]), null);
  const out = evaluateTreatmentOpportunities({ assessment: assessmentWithGoals([], ["jawDefinition"]), analysis: empty });
  assert.equal(out[0].status, "not_available");
});

test("conservative behavior with incomplete data: user-reported skin concern is low; nothing is upgraded without observations", () => {
  const out = evaluateTreatmentOpportunities({ assessment: assessmentWithGoals(["improveSkin"]), analysis: null });
  assert.equal(out.length, 1);
  assert.equal(out[0].category, "SKIN_TREATMENT");
  assert.equal(out[0].confidence, "low");
});

test("a future visual skin observation raises confidence but the engine never creates one itself", () => {
  const analysis = analysisWithFront();
  const before = evaluateTreatmentOpportunities({ assessment: assessmentWithGoals(["improveSkin"]), analysis });
  assert.equal(before[0].confidence, "low");
  analysis.observations.push(visualFeature("skin.visual.unevenTone"));
  const after = evaluateTreatmentOpportunities({ assessment: assessmentWithGoals(["improveSkin"]), analysis });
  assert.equal(after[0].confidence, "moderate");
  assert.ok(after[0].evidenceObservationIds.includes("skin.visual.unevenTone"));
});

test("clinician review is always required and the engine version is stamped on every opportunity", () => {
  const out = evaluateTreatmentOpportunities({
    assessment: assessmentWithGoals(["lookMoreDefined", "improveSkin"], ["jawDefinition"]),
    analysis: analysisWithFront(),
  });
  const withoutAnalysis = evaluateTreatmentOpportunities({ assessment: assessmentWithGoals(["improveSkin"], ["jawDefinition"]), analysis: null });
  for (const o of [...out, ...withoutAnalysis]) {
    assert.equal(o.clinicianReviewRequired, true);
    assert.equal(o.methodologyVersion, TREATMENT_OPPORTUNITY_ENGINE_VERSION);
    assert.ok(o.limitations.length > 0);
    assert.deepEqual(validateOpportunity(o), []);
  }
});

test("no age- or gender-based treatment assumptions: profile does not change the output", () => {
  const base = assessmentWithGoals(["lookMoreDefined", "improveSkin"], ["jawDefinition"]);
  const shape = (a: typeof base) =>
    evaluateTreatmentOpportunities({ assessment: a, analysis: analysisWithFront() }).map((o) => [o.id, o.confidence, o.evidenceQuestionIds]);
  const old = structuredClone(base);
  old.profile = { ageYears: 71, genderPresentation: "female", heightCm: 160, weightKg: 55 };
  assert.deepEqual(shape(old), shape(base));
});

test("no attractiveness/beauty scoring: no output field is a score, and no text makes such a claim", () => {
  const out = evaluateTreatmentOpportunities({ assessment: assessmentWithGoals(["lookMoreDefined", "improveSkin"], ["jawDefinition"]), analysis: analysisWithFront() });
  const text = JSON.stringify(out);
  assert.doesNotMatch(text, /attractiv|beaut|ugly|\bideal\b|\d\s?%/i);
  assert.ok(out.every((o) => !("score" in o)));
});

test("malformed input: null/garbage assessment, analysis and video input fail safe", () => {
  assert.deepEqual(evaluateTreatmentOpportunities({ assessment: null as never, analysis: null }), []);
  assert.deepEqual(evaluateTreatmentOpportunities({ assessment: {} as never, analysis: { observations: "x" } as never }), []);
  const ctx = buildEvaluationContext({
    assessment: createEmptyAssessment(),
    analysis: null,
    videoObservations: [null, { id: "", label: "x", supports: "expression_lines" }, { id: "ok", label: "x", supports: "nonsense" }, { id: "good", label: "g", supports: "expression_lines" }] as never,
  });
  assert.deepEqual(ctx.videoObservations.map((v) => v.id), ["good"]);
});
