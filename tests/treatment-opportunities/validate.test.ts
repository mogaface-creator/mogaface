import { test } from "node:test";
import assert from "node:assert/strict";
import { validateOpportunity, isValidOpportunity } from "../../lib/treatment-opportunities/validate.ts";
import { createOpportunity } from "../../lib/treatment-opportunities/types.ts";

function good() {
  return createOpportunity({
    concern: "facial_contour_volume",
    category: "FACIAL_CONTOURING",
    title: "Facial contour assessment",
    rationale: "Your goals and facial-structure observations suggest that a facial contour/volume assessment may be worth discussing with your clinician.",
    evidence: [
      { kind: "questionnaire", id: "goals.areas.jawDefinition", label: "Area of interest: jaw definition", source: "user" },
      { kind: "observation", id: "facialStructure.jawWidth", label: "Jaw width", source: "front" },
    ],
    status: "potential_opportunity",
    confidence: "moderate",
    limitations: ["Suitability cannot be determined from photographs alone."],
  });
}

const mutate = (patch: Record<string, unknown>) => ({ ...good(), ...patch });
const problemsOf = (v: unknown) => validateOpportunity(v).join(" | ");

test("a well-formed opportunity has no problems", () => {
  assert.deepEqual(validateOpportunity(good()), []);
  assert.ok(isValidOpportunity(good()));
});

test("missing evidence: potential opportunities need a non-empty evidence array", () => {
  assert.match(problemsOf(mutate({ evidence: [], evidenceObservationIds: [], evidenceQuestionIds: [] })), /evidence must be a non-empty array/);
  assert.match(problemsOf(mutate({ evidence: undefined })), /evidence must be a non-empty array/);
});

test("a potential opportunity must be grounded in a user-reported goal", () => {
  const obsOnly = [{ kind: "observation", id: "facialStructure.jawWidth", label: "Jaw width", source: "front" }];
  assert.match(
    problemsOf(mutate({ evidence: obsOnly, evidenceObservationIds: ["facialStructure.jawWidth"], evidenceQuestionIds: [] })),
    /user-reported goal/,
  );
});

test("invalid category and status are rejected", () => {
  assert.match(problemsOf(mutate({ category: "BOTOX" })), /not a valid treatment category/);
  assert.match(problemsOf(mutate({ category: null })), /not a valid treatment category/);
  assert.match(problemsOf(mutate({ status: "recommended" })), /not a valid status/);
});

test("insufficient/not_available opportunities must carry no category and no confidence", () => {
  assert.match(problemsOf(mutate({ status: "insufficient_evidence" })), /category must be null/);
  assert.match(problemsOf(mutate({ status: "not_available", category: null })), /confidence must be null/);
  assert.deepEqual(validateOpportunity(mutate({ status: "insufficient_evidence", category: null, confidence: null })), []);
});

test("invalid confidence is rejected (no numeric/percentage confidence)", () => {
  assert.match(problemsOf(mutate({ confidence: 0.87 })), /confidence/);
  assert.match(problemsOf(mutate({ confidence: "certain" })), /confidence/);
});

test("clinicianReviewRequired must be exactly true", () => {
  for (const v of [false, "true", undefined, 1]) assert.match(problemsOf(mutate({ clinicianReviewRequired: v })), /clinicianReviewRequired must be true/);
});

test("methodologyVersion and createdAt are required", () => {
  assert.match(problemsOf(mutate({ methodologyVersion: "" })), /methodologyVersion/);
  assert.match(problemsOf(mutate({ createdAt: "not-a-date" })), /createdAt/);
});

test("declared id lists must match the evidence", () => {
  assert.match(problemsOf(mutate({ evidenceObservationIds: ["something-else"] })), /evidenceObservationIds/);
  assert.match(problemsOf(mutate({ evidenceQuestionIds: [] })), /evidenceQuestionIds/);
});

test("malformed evidence items are reported", () => {
  const bad = [{ kind: "guess", id: "", label: 3, source: null }, null];
  const p = problemsOf(mutate({ evidence: bad }));
  assert.match(p, /evidence\[0\]\.kind/);
  assert.match(p, /evidence\[1\]\.id/);
});

test("a potential opportunity must carry at least one limitation", () => {
  assert.match(problemsOf(mutate({ limitations: [] })), /at least one limitation/);
  assert.match(problemsOf(mutate({ limitations: "none" })), /limitations must be an array/);
});

test("forbidden language in title/rationale is rejected", () => {
  for (const rationale of [
    "You need Botox for this.",
    "You are 87% suitable for fillers.",
    "This shows a diagnosis of acne.",
    "A more attractive jawline.",
  ]) {
    assert.match(problemsOf(mutate({ rationale })), /must not use/);
  }
  assert.match(problemsOf(mutate({ title: "Ideal face match" })), /must not use/);
});

test("malformed input fails safely without throwing", () => {
  for (const v of [null, undefined, 42, "x", [], {}]) {
    assert.doesNotThrow(() => validateOpportunity(v));
    assert.ok(validateOpportunity(v).length > 0);
    assert.equal(isValidOpportunity(v), false);
  }
});
