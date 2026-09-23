import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeAssessment, validateAssessment } from "../../lib/assessment/schema.ts";
import { createEmptyAssessment } from "../../lib/assessment/defaults.ts";
import { ASSESSMENT_VERSION, PHOTO_SLOTS } from "../../lib/assessment/types.ts";

test("sanitizeAssessment accepts a freshly created empty assessment", () => {
  const empty = createEmptyAssessment();
  const sanitized = sanitizeAssessment(JSON.parse(JSON.stringify(empty)));
  assert.notEqual(sanitized, null);
  assert.equal(sanitized?.id, empty.id);
  assert.equal(sanitized?.assessmentVersion, ASSESSMENT_VERSION);
});

test("sanitizeAssessment rejects non-object input", () => {
  assert.equal(sanitizeAssessment(null), null);
  assert.equal(sanitizeAssessment("not an assessment"), null);
  assert.equal(sanitizeAssessment(42), null);
  assert.equal(sanitizeAssessment([]), null);
});

test("sanitizeAssessment rejects a mismatched assessmentVersion", () => {
  const empty = createEmptyAssessment();
  const wrongVersion: Record<string, unknown> = { ...empty, assessmentVersion: "9.9.9" };
  assert.equal(sanitizeAssessment(wrongVersion), null);
});

test("sanitizeAssessment rejects an invalid enum value instead of coercing it", () => {
  const empty = createEmptyAssessment();
  const bad: Record<string, unknown> = {
    ...empty,
    profile: { ...empty.profile, genderPresentation: "definitely-not-valid" },
  };
  assert.equal(sanitizeAssessment(bad), null);
});

test("sanitizeAssessment rejects a non-finite profile number", () => {
  const empty = createEmptyAssessment();
  const bad: Record<string, unknown> = { ...empty, profile: { ...empty.profile, ageYears: Number.NaN } };
  assert.equal(sanitizeAssessment(bad), null);
});

test("sanitizeAssessment caps priorities defensively even if stored data has more than 3", () => {
  const empty = createEmptyAssessment();
  const tooMany: Record<string, unknown> = {
    ...empty,
    goals: {
      areas: [],
      priorities: ["lookMoreDefined", "improveSkin", "improveHair", "improveGrooming"],
    },
  };
  const sanitized = sanitizeAssessment(tooMany);
  assert.notEqual(sanitized, null);
  assert.equal(sanitized?.goals.priorities.length, 3);
});

test("validateAssessment requires age, height, weight, at least one goal, and all 5 photos", () => {
  const empty = createEmptyAssessment();
  const result = validateAssessment(empty);
  assert.equal(result.isComplete, false);
  assert.ok(result.missing.includes("Age"));
  assert.ok(result.missing.includes("Height"));
  assert.ok(result.missing.includes("Weight"));
  assert.ok(result.missing.includes("At least one goal"));
  for (const { label } of PHOTO_SLOTS) {
    assert.ok(result.missing.includes(`${label} photo`));
  }
});

test("validateAssessment passes once every required field and photo is present", () => {
  const complete = createEmptyAssessment();
  complete.profile = { ageYears: 25, heightCm: 175, weightKg: 70, genderPresentation: null };
  complete.goals = { areas: ["face"], priorities: [] };
  complete.photos = PHOTO_SLOTS.map(({ slot }) => ({
    slot,
    fileName: `${slot}.jpg`,
    sizeBytes: 1024,
    uploadedAt: new Date().toISOString(),
  }));
  const result = validateAssessment(complete);
  assert.equal(result.isComplete, true);
  assert.deepEqual(result.missing, []);
});
