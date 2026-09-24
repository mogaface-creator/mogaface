import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildConcernSignals,
  deriveConfidence,
  explainOpportunity,
  findStructureEvidence,
  findVisualFeatureEvidence,
  findVideoEvidence,
  FACIAL_STRUCTURE_OBSERVATION_IDS,
  SKIN_VISUAL_OBSERVATION_IDS,
  EXPRESSION_LINE_OBSERVATION_IDS,
} from "../../lib/treatment-opportunities/evidence.ts";
import { evaluateTreatmentOpportunities } from "../../lib/treatment-opportunities/evaluate.ts";
import { measuredObservation, userReportedObservation } from "../../lib/observation/helpers.ts";
import { createEmptyAssessment } from "../../lib/assessment/defaults.ts";
import { analysisWithFront, assessmentWithGoals, signal, visualFeature } from "./fixtures.ts";

test("questionnaire mapping: existing goals become normalized signals", () => {
  const signals = buildConcernSignals(assessmentWithGoals(["lookMoreDefined", "improveSkin"], ["jawDefinition"]));
  const byKind = Object.fromEntries(signals.map((s) => [s.kind, s]));
  assert.equal(byKind.facial_definition.strength, "general");
  assert.equal(byKind.skin_concern.strength, "explicit");
  assert.equal(byKind.facial_contour.strength, "explicit");
  assert.deepEqual(byKind.facial_definition.evidence.map((e) => e.id), ["goals.priorities.lookMoreDefined"]);
});

test("questionnaire mapping: same signal from two answers merges and keeps the stronger strength", () => {
  const signals = buildConcernSignals(assessmentWithGoals(["improveSkin"], ["skin"]));
  assert.equal(signals.length, 1);
  assert.equal(signals[0].strength, "explicit");
  assert.equal(signals[0].evidence.length, 2);
});

test("questionnaire mapping: unrelated answers produce no signals, and none is invented", () => {
  assert.deepEqual(buildConcernSignals(assessmentWithGoals(["improveHair", "improveGrooming"], ["hair", "face"])), []);
  assert.deepEqual(buildConcernSignals(createEmptyAssessment()), []);
  // Without appearanceConcerns answers (empty here), these kinds are unreachable from an Assessment.
  const kinds: string[] = buildConcernSignals(
    assessmentWithGoals(["lookMoreDefined", "improveSkin"], ["skin", "jawDefinition", "face"]),
  ).map((s) => s.kind);
  for (const k of ["expression_lines", "facial_lifting", "facial_volume", "under_eye"]) assert.ok(!kinds.includes(k));
});

test("questionnaire mapping: malformed assessment does not throw", () => {
  assert.deepEqual(buildConcernSignals(null), []);
  assert.deepEqual(buildConcernSignals({ goals: { areas: "x", priorities: 3 } } as never), []);
});

test("no fabricated evidence: the real observation layer yields no skin or expression-line evidence", () => {
  const { observations } = analysisWithFront();
  assert.deepEqual(findVisualFeatureEvidence(observations, SKIN_VISUAL_OBSERVATION_IDS), []);
  assert.deepEqual(findVisualFeatureEvidence(observations, EXPRESSION_LINE_OBSERVATION_IDS), []);
  assert.ok(findStructureEvidence(observations, FACIAL_STRUCTURE_OBSERVATION_IDS).length > 0);
});

test("visual-feature lookup rejects user-reported, unlisted-id and non-true observations", () => {
  const id = SKIN_VISUAL_OBSERVATION_IDS[0];
  const userSaid = userReportedObservation({ id, domain: "skin", label: "x", value: true });
  const unlisted = measuredObservation({ id: "skin.visual.somethingElse", domain: "skin", label: "x", value: true, source: "front" });
  const notTrue = measuredObservation({ id, domain: "skin", label: "x", value: false, source: "front" });
  assert.deepEqual(findVisualFeatureEvidence([userSaid, unlisted, notTrue], SKIN_VISUAL_OBSERVATION_IDS), []);
  assert.equal(findVisualFeatureEvidence([visualFeature(id)], SKIN_VISUAL_OBSERVATION_IDS).length, 1);
});

test("structure lookup rejects non-finite measured values", () => {
  const bad = measuredObservation({
    id: "facialStructure.jawWidth",
    domain: "facial-structure",
    label: "Jaw",
    value: Number.NaN,
    source: "front",
  });
  assert.deepEqual(findStructureEvidence([bad], FACIAL_STRUCTURE_OBSERVATION_IDS), []);
});

test("video evidence maps only observations supporting the requested signal", () => {
  const videos = [
    { id: "v1", label: "Lines more apparent on brow raise", supports: "expression_lines" as const },
    { id: "v2", label: "other", supports: "skin_concern" as const },
  ];
  const found = findVideoEvidence(videos, "expression_lines");
  assert.deepEqual(found.map((e) => e.id), ["v1"]);
  assert.equal(found[0].kind, "video");
});

test("confidence semantics: high / moderate / low", () => {
  const q = { kind: "questionnaire" as const, id: "q", label: "q", source: "user" };
  const front = { kind: "observation" as const, id: "a", label: "a", source: "front" };
  const front2 = { kind: "observation" as const, id: "b", label: "b", source: "front" };
  const left = { kind: "observation" as const, id: "c", label: "c", source: "leftFortyFive" };
  const video = { kind: "video" as const, id: "v", label: "v", source: "video" };
  const explicit = [signal("skin_concern", "explicit")];
  const general = [signal("skin_concern", "general")];

  assert.equal(deriveConfidence(explicit, [q, front, video]), "high");
  assert.equal(deriveConfidence(explicit, [q, front, left]), "high");
  assert.equal(deriveConfidence(explicit, [q, front, front2]), "moderate"); // one source only
  assert.equal(deriveConfidence(explicit, [q, front]), "moderate");
  assert.equal(deriveConfidence(explicit, [q]), "low"); // self-report only
  assert.equal(deriveConfidence(general, [q, front, video]), "low"); // indirect goal
});

test("evidence traceability: explainOpportunity says why an opportunity exists", () => {
  const [opp] = evaluateTreatmentOpportunities({
    assessment: assessmentWithGoals([], ["jawDefinition"]),
    analysis: analysisWithFront(),
  });
  const why = explainOpportunity(opp);
  assert.equal(why.opportunity, "FACIAL_CONTOURING");
  assert.ok(why.reasons.some((r) => r.startsWith("Reported by user: Area of interest: jaw definition")));
  assert.ok(why.reasons.some((r) => r.startsWith("Relevant facial observation:")));
  assert.ok(why.reasons.some((r) => r.startsWith("Evidence strength moderate")));
});

test("evidence traceability: non-potential opportunities explain the missing evidence", () => {
  const [opp] = evaluateTreatmentOpportunities({ assessment: assessmentWithGoals([], ["jawDefinition"]), analysis: null });
  const why = explainOpportunity(opp);
  assert.equal(why.opportunity, null);
  assert.ok(why.reasons[0].includes("no photo analysis"));
});
