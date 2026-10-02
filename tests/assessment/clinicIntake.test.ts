import { test } from "node:test";
import assert from "node:assert/strict";
import { createEmptyAssessment } from "../../lib/assessment/defaults.ts";
import { projectBody, projectPlaces, sanitizeClinicIntake, setAnswer, withIntake } from "../../lib/assessment/clinicIntake.ts";
import { allAsks, IMAGE_PLACE_OPTIONS } from "../../lib/assessment/intakeQuestions.ts";
import { PREVIEW_SCREENS, visibleScreens } from "../../lib/assessment/intakeFlow.ts";
import { sanitizeAssessment } from "../../lib/assessment/schema.ts";
import { buildPredictionPlan } from "../../lib/visualization/predict.ts";
import { buildPredictionIllustrationPrompt } from "../../lib/image-generation/predictionPrompt.ts";
import { validateIllustrationPrompt } from "../../lib/visualization/safety.ts";
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

test("the intake is 15 to 20 questions, and each one can be answered in a tap or one line", () => {
  const asks = allAsks();
  assert.equal(PREVIEW_SCREENS.length >= 15 && PREVIEW_SCREENS.length <= 20, true);
  const asked = new Set(PREVIEW_SCREENS.flatMap((screen) => screen.askIds));
  assert.deepEqual(asks.map((ask) => ask.id).filter((id) => !asked.has(id)), []);
  const prompts = asks.flatMap((ask) => [ask.prompt, ask.hint ?? "", ask.placeholder ?? "", ...(ask.options ?? []).map((option) => option.label)]).join("\n");
  for (const phrase of [
    "based on measurements",
    "Get a step-by-step plan",
    "Injections like Botox, fillers, skin boosters",
    "isotretinoin (acne tablets)",
    "not a promise of the result",
  ]) {
    assert.equal(prompts.includes(phrase), true, phrase);
  }
  assert.equal(asks.some((ask) => ask.kind === "text" && ask.input === "area"), false);
  const look = asks.find((ask) => ask.id === "lookDirections");
  assert.equal(look?.options?.some((option) => option.value === "younger"), false);
  const blocked = ["FACIAL_VOLUME", "FACIAL_LIFTING", "FACIAL_BALANCE", "OVERALL_APPEARANCE", "NOT_SURE"];
  assert.equal(blocked.some((id) => IMAGE_PLACE_OPTIONS.some((option) => option.value === id)), false);
});

test("follow-up screens appear only after the answer that needs them", () => {
  const empty = createEmptyAssessment().clinicIntake;
  const hidden = visibleScreens(empty).map((screen) => screen.id);
  assert.equal(hidden.includes("howLong"), false);
  assert.equal(hidden.includes("where"), false);
  assert.equal(hidden.includes("priorWhat"), false);
  assert.equal(hidden.includes("eventWhat"), false);

  const bothered = withIntake(createEmptyAssessment(), {
    dislikes: [
      { words: "Forehead lines", duration: "" },
      { words: "", duration: "" },
      { words: "", duration: "" },
    ],
  }).clinicIntake;
  assert.equal(visibleScreens(bothered).some((screen) => screen.id === "howLong"), true);

  const hairOnly = projectPlaces(createEmptyAssessment(), ["HAIR"]).clinicIntake;
  assert.equal(visibleScreens(hairOnly).some((screen) => screen.id === "where"), false);
  const lines = projectPlaces(createEmptyAssessment(), ["FACIAL_LINES"]).clinicIntake;
  assert.equal(visibleScreens(lines).some((screen) => screen.id === "where"), true);

  const prior = setAnswer(createEmptyAssessment(), "hadPriorWork", "yes").clinicIntake;
  assert.equal(visibleScreens(prior).some((screen) => screen.id === "priorWhat"), true);
  const event = setAnswer(createEmptyAssessment(), "hasEvent", "yes").clinicIntake;
  assert.equal(visibleScreens(event).some((screen) => screen.id === "eventWhat"), true);
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
  assert.equal(prompt.includes("Copy the hair exactly."), true);
  assert.deepEqual(validateIllustrationPrompt(prompt), []);

  const withHair = projectPlaces(createEmptyAssessment(), ["HAIR"]);
  const hairPlan = buildPredictionPlan({
    assessment: withHair,
    analysis: buildMogaFaceAnalysis(withHair, null),
    frontPhoto: { ref: "front", qualityValid: true },
  });
  assert.equal(hairPlan.status, "planned");
  const hairPrompt = buildPredictionIllustrationPrompt(hairPlan);
  assert.equal(hairPrompt.includes("Copy the hair exactly."), false);
  assert.equal(hairPrompt.includes("Copy the beard, moustache, and any facial hair exactly."), true);
  assert.deepEqual(validateIllustrationPrompt(hairPrompt), []);
});
