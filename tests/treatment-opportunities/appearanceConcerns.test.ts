import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateTreatmentOpportunities } from "../../lib/treatment-opportunities/evaluate.ts";
import { buildConcernSignals } from "../../lib/treatment-opportunities/evidence.ts";
import { createEmptyAppearanceConcerns, type AppearanceConcerns } from "../../lib/assessment/appearanceConcerns.ts";
import { buildFilledAssessment } from "../observation/fixtures.ts";
import { analysisWithFront, visualFeature } from "./fixtures.ts";
import type { Assessment } from "../../lib/assessment/types.ts";

function assessmentWith(partial: Partial<AppearanceConcerns>): Assessment {
  const a = buildFilledAssessment();
  a.goals = { areas: [], priorities: [] }; // isolate the new questionnaire section
  a.appearanceConcerns = { ...createEmptyAppearanceConcerns(), ...partial };
  return a;
}
const evaluate = (a: Assessment, analysis = analysisWithFront()) => evaluateTreatmentOpportunities({ assessment: a, analysis });
const kinds = (a: Assessment) => buildConcernSignals(a).map((s) => s.kind).sort();

test("engine receives normalized user evidence from appearanceConcerns", () => {
  const signals = buildConcernSignals(assessmentWith({ selected: ["FACIAL_LINES"], details: ["FOREHEAD_LINES"] }));
  assert.equal(signals.length, 1);
  assert.equal(signals[0].kind, "expression_lines");
  assert.equal(signals[0].strength, "explicit");
  assert.deepEqual(
    signals[0].evidence.map((e) => [e.kind, e.id, e.label]),
    [
      ["questionnaire", "appearanceConcerns.selected.FACIAL_LINES", "Concern: Lines that become more visible with facial expressions"],
      ["questionnaire", "appearanceConcerns.details.FOREHEAD_LINES", "Concern: Forehead lines"],
    ],
  );
});

test("each concern family maps to its engine signal kind", () => {
  const map = (id: AppearanceConcerns["selected"][number]) => kinds(assessmentWith({ selected: [id] }));
  assert.deepEqual(map("FACIAL_LINES"), ["expression_lines"]);
  assert.deepEqual(map("FACIAL_DEFINITION"), ["facial_definition"]);
  assert.deepEqual(map("FACIAL_VOLUME"), ["facial_volume"]);
  assert.deepEqual(map("FACIAL_LIFTING"), ["facial_lifting"]);
  assert.deepEqual(map("UNDER_EYE"), ["under_eye"]);
  for (const skin of ["SKIN_TEXTURE", "SKIN_TONE", "PIGMENTATION", "BLEMISHES"] as const) assert.deepEqual(map(skin), ["skin_concern"]);
});

test("contour details map to facial_contour and merge with the parent definition goal", () => {
  assert.deepEqual(kinds(assessmentWith({ selected: ["FACIAL_DEFINITION"], details: ["JAW_DEFINITION"] })), ["facial_contour", "facial_definition"]);
});

test("NOT_SURE, FACIAL_BALANCE, OVERALL_APPEARANCE and 'not sure which' details create no signal", () => {
  assert.deepEqual(kinds(assessmentWith({ selected: ["NOT_SURE"] })), []);
  assert.deepEqual(kinds(assessmentWith({ selected: ["FACIAL_BALANCE", "OVERALL_APPEARANCE"] })), []);
  assert.deepEqual(
    kinds(assessmentWith({ selected: ["FACIAL_LINES"], details: ["FACIAL_LINES_NOT_SURE"] })),
    ["expression_lines"],
  );
  assert.equal(buildConcernSignals(assessmentWith({ selected: ["FACIAL_LINES"], details: ["FACIAL_LINES_NOT_SURE"] }))[0].evidence.length, 1);
});

test("NOT_SURE alone triggers no opportunity of any status", () => {
  assert.deepEqual(evaluate(assessmentWith({ selected: ["NOT_SURE"] })), []);
});

test("FACIAL_LINES alone does NOT create a neuromodulator opportunity: recorded, insufficient evidence, no category", () => {
  const out = evaluate(assessmentWith({ selected: ["FACIAL_LINES"], details: ["FOREHEAD_LINES"] }));
  assert.equal(out.length, 1);
  assert.equal(out[0].status, "insufficient_evidence");
  assert.equal(out[0].category, null);
  assert.equal(out[0].confidence, null);
  assert.deepEqual(out[0].evidenceQuestionIds, [
    "appearanceConcerns.selected.FACIAL_LINES",
    "appearanceConcerns.details.FOREHEAD_LINES",
  ]);
  assert.deepEqual(out[0].evidenceObservationIds, []);
});

test("questionnaire alone does not fabricate visual evidence: the real analysis has none for lines, volume, lifting or skin", () => {
  const a = assessmentWith({ selected: ["FACIAL_LINES", "FACIAL_VOLUME", "FACIAL_LIFTING", "UNDER_EYE"] });
  const out = evaluate(a);
  assert.ok(out.every((o) => o.evidenceObservationIds.length === 0));
  assert.ok(out.every((o) => o.status !== "potential_opportunity"));
  const categories = out.map((o) => o.category);
  for (const c of ["NEUROMODULATOR", "DERMAL_FILLER", "FACIAL_LIFTING"]) assert.ok(!categories.includes(c as never));
});

test("volume and lifting goals need concern-specific visual evidence, not just any photo", () => {
  const volume = evaluate(assessmentWith({ selected: ["FACIAL_VOLUME"] }));
  const lifting = evaluate(assessmentWith({ selected: ["FACIAL_LIFTING"] }));
  assert.deepEqual(volume.map((o) => [o.concern, o.status]), [["facial_contour_volume", "insufficient_evidence"]]);
  assert.deepEqual(lifting.map((o) => [o.concern, o.status]), [["facial_lifting", "insufficient_evidence"]]);
});

test("UNDER_EYE is recorded but no rule consumes it, so it produces no opportunity", () => {
  assert.deepEqual(evaluate(assessmentWith({ selected: ["UNDER_EYE"], details: ["DARK_LOOKING_UNDER_EYES"] })), []);
});

test("user concern + a future visual observation is what creates the opportunity (lines → NEUROMODULATOR)", () => {
  const analysis = analysisWithFront();
  analysis.observations.push(visualFeature("expression.visibleForeheadLinePattern"));
  const [o] = evaluate(assessmentWith({ selected: ["FACIAL_LINES"], details: ["FOREHEAD_LINES"] }), analysis);
  assert.equal(o.category, "NEUROMODULATOR");
  assert.equal(o.confidence, "moderate");
  assert.equal(o.clinicianReviewRequired, true);
  assert.ok(o.evidenceQuestionIds.includes("appearanceConcerns.details.FOREHEAD_LINES"));
});

test("jaw-definition concern + real front measurements → FACIAL_CONTOURING at moderate", () => {
  const [o] = evaluate(assessmentWith({ selected: ["FACIAL_DEFINITION"], details: ["JAW_DEFINITION"] }));
  assert.equal(o.category, "FACIAL_CONTOURING");
  assert.equal(o.confidence, "moderate");
});

test("skin concerns yield a low-confidence SKIN_TREATMENT from self-report alone, with no diagnosis wording", () => {
  const out = evaluate(assessmentWith({ selected: ["SKIN_TONE", "BLEMISHES"], details: ["REDNESS", "ACTIVE_BLEMISHES"] }));
  assert.equal(out.length, 1);
  assert.equal(out[0].category, "SKIN_TREATMENT");
  assert.equal(out[0].confidence, "low");
  assert.deepEqual(out[0].evidenceObservationIds, []);
  assert.doesNotMatch(JSON.stringify(out), /acne|melasma|rosacea|dermatitis|scarring|diagnos(is|ed) of/i);
});

test("an older assessment shape (no appearanceConcerns) still evaluates; malformed concerns produce no signals", () => {
  const older = buildFilledAssessment() as unknown as Record<string, unknown>;
  delete older.appearanceConcerns;
  assert.doesNotThrow(() => buildConcernSignals(older as never));
  const malformed = assessmentWith({ selected: ["NOT_A_CONCERN" as never] });
  assert.deepEqual(kinds(malformed), []);
});

test("priorities never raise evidence strength: the same concerns give the same opportunities", () => {
  const base = evaluate(assessmentWith({ selected: ["FACIAL_DEFINITION", "SKIN_TONE"] }));
  const prioritised = evaluate(assessmentWith({ selected: ["FACIAL_DEFINITION", "SKIN_TONE"], priorities: ["SKIN_TONE"] }));
  assert.deepEqual(base.map((o) => [o.id, o.confidence]), prioritised.map((o) => [o.id, o.confidence]));
});
