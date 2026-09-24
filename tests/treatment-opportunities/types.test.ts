import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TREATMENT_CATEGORIES,
  OPPORTUNITY_STATUSES,
  OPPORTUNITY_CONFIDENCES,
  createOpportunity,
  isTreatmentCategory,
  isOpportunityStatus,
} from "../../lib/treatment-opportunities/types.ts";
import { TREATMENT_CATEGORY_DEFINITIONS } from "../../lib/treatment-opportunities/categories.ts";
import { validateOpportunity } from "../../lib/treatment-opportunities/validate.ts";
import { TREATMENT_OPPORTUNITY_ENGINE_VERSION } from "../../lib/treatment-opportunities/versions.ts";

const evidence = [
  { kind: "questionnaire" as const, id: "goals.priorities.improveSkin", label: "Goal: improve skin", source: "user" },
  { kind: "observation" as const, id: "skin.visual.unevenTone", label: "Uneven tone", source: "front" },
];

function valid() {
  return createOpportunity({
    concern: "skin_appearance",
    category: "SKIN_TREATMENT",
    title: "Skin assessment",
    rationale: "Your submitted images and responses indicate skin-related concerns that may be worth assessing with your clinician.",
    evidence,
    status: "potential_opportunity",
    confidence: "moderate",
    limitations: ["Suitability cannot be determined from photographs alone."],
  });
}

test("valid opportunity creation: fixed fields and derived ids", () => {
  const o = valid();
  assert.deepEqual(validateOpportunity(o), []);
  assert.equal(o.id, "skin_appearance:SKIN_TREATMENT");
  assert.equal(o.clinicianReviewRequired, true);
  assert.equal(o.methodologyVersion, TREATMENT_OPPORTUNITY_ENGINE_VERSION);
  assert.deepEqual(o.evidenceQuestionIds, ["goals.priorities.improveSkin"]);
  assert.deepEqual(o.evidenceObservationIds, ["skin.visual.unevenTone"]);
  assert.ok(!Number.isNaN(Date.parse(o.createdAt)));
});

test("all seven categories exist as configurable definitions, separate from clinic services", () => {
  assert.deepEqual(
    [...TREATMENT_CATEGORIES],
    [
      "NEUROMODULATOR",
      "DERMAL_FILLER",
      "FACIAL_CONTOURING",
      "FACIAL_LIFTING",
      "SKIN_TREATMENT",
      "HAIR_SCALP_ASSESSMENT",
      "CLINIC_CONSULTATION",
    ],
  );
  for (const c of TREATMENT_CATEGORIES) assert.equal(TREATMENT_CATEGORY_DEFINITIONS[c].category, c);
});

test("type guards accept only declared unions", () => {
  assert.ok(isTreatmentCategory("NEUROMODULATOR"));
  assert.ok(!isTreatmentCategory("BOTOX"));
  assert.ok(isOpportunityStatus("insufficient_evidence"));
  assert.ok(!isOpportunityStatus("recommended"));
  assert.deepEqual([...OPPORTUNITY_STATUSES], ["potential_opportunity", "insufficient_evidence", "not_available"]);
  assert.deepEqual([...OPPORTUNITY_CONFIDENCES], ["low", "moderate", "high"]);
});

test("versioning: engine version is 0.1.0 and stamped on every opportunity", () => {
  assert.equal(TREATMENT_OPPORTUNITY_ENGINE_VERSION, "0.1.0");
  assert.equal(valid().methodologyVersion, "0.1.0");
});

test("clinician review is always true from the constructor, even for non-potential statuses", () => {
  const o = createOpportunity({
    concern: "facial_lifting",
    category: null,
    title: "t",
    rationale: "r",
    evidence: [evidence[0]],
    status: "insufficient_evidence",
    confidence: null,
    limitations: [],
  });
  assert.equal(o.clinicianReviewRequired, true);
  assert.equal(o.id, "facial_lifting:insufficient_evidence");
});
