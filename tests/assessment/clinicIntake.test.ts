import { test } from "node:test";
import assert from "node:assert/strict";
import { createEmptyAssessment } from "../../lib/assessment/defaults.ts";
import { projectBody, projectPlaces, sanitizeClinicIntake } from "../../lib/assessment/clinicIntake.ts";
import { allAsks } from "../../lib/assessment/intakeQuestions.ts";
import { sanitizeAssessment } from "../../lib/assessment/schema.ts";
import { buildPredictionPlan } from "../../lib/visualization/predict.ts";
import { buildPredictionIllustrationPrompt } from "../../lib/image-generation/predictionPrompt.ts";
import { buildMogaFaceAnalysis } from "../../lib/observation/build.ts";

test("an older assessment without clinicIntake still loads, with an empty intake", () => {
  const older: Record<string, unknown> = JSON.parse(JSON.stringify(createEmptyAssessment()));
  delete older.clinicIntake;
  const loaded = sanitizeAssessment(older);
  assert.notEqual(loaded, null);
  assert.equal(loaded?.clinicIntake.ageConfirmed, null);
  assert.equal(loaded?.clinicIntake.places.length, 0);
});

test("picked places become the illustration fields, and free text does not", () => {
  const next = projectPlaces(createEmptyAssessment(), ["FACIAL_LINES", "HAIR", "SKIN_TONE", "UNDER_EYE"]);
  assert.deepEqual(next.clinicIntake.places, ["FACIAL_LINES", "HAIR", "SKIN_TONE"]);
  assert.deepEqual(next.appearanceConcerns.selected, ["FACIAL_LINES", "SKIN_TONE"]);
  assert.ok(next.hair.concerns.includes("thinning"));
  assert.deepEqual(next.goals.areas, ["face"]);
});

test("height and weight copy onto the profile only inside a usable range", () => {
  const next = projectBody(createEmptyAssessment(), 175, 70);
  assert.equal(next.profile.heightCm, 175);
  assert.equal(next.profile.weightKg, 70);
  const rejected = projectBody(next, 20, 70);
  assert.equal(rejected.profile.heightCm, null);
});

test("each original question is asked in its own words, including the parts that were previously merged", () => {
  const prompts = allAsks().flatMap((ask) => [ask.prompt, ...(ask.options ?? []).map((option) => option.label)]).join("\n");
  for (const phrase of [
    "based on measurements",
    "Get a step-by-step plan",
    "Injections like Botox, fillers, skin boosters",
    "Do you breathe through your mouth while sleeping?",
    "rice, dal, bread",
    "HYROX",
    "isotretinoin (acne tablets)",
    "low haemoglobin",
    "heavy-legged",
    "not a promise of the result",
  ]) {
    assert.equal(prompts.includes(phrase), true, phrase);
  }
});

test("treatment words and look directions stay out of the image prompt", () => {
  let assessment = projectPlaces(createEmptyAssessment(), ["SKIN_TONE"]);
  assessment = {
    ...assessment,
    clinicIntake: sanitizeClinicIntake({
      ...assessment.clinicIntake,
      priorTreatments: "Botox in March",
      lookDirections: ["younger", "sharp"],
      dislikes: [{ words: "fillers in the cheeks", duration: "2 years" }, { words: "", duration: "" }, { words: "", duration: "" }],
    }),
  };
  const plan = buildPredictionPlan({
    assessment,
    analysis: buildMogaFaceAnalysis(assessment, null),
    frontPhoto: { ref: "front", qualityValid: true },
  });
  assert.equal(plan.status, "planned");
  const prompt = buildPredictionIllustrationPrompt(plan);
  assert.equal(prompt.toLowerCase().includes("botox"), false);
  assert.equal(prompt.toLowerCase().includes("younger"), false);
  assert.equal(prompt.toLowerCase().includes("filler"), false);
});
