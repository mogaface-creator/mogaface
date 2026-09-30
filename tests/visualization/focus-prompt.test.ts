/**
 * The image prompt for a prediction plan names the place this person selected.
 * The approved category instruction stays in the prompt. Wording still has to
 * pass the image-prompt safety check, or generation refuses to run.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createEmptyAssessment } from "../../lib/assessment/defaults.ts";
import type { AppearanceConcernDetailId, AppearanceConcernId } from "../../lib/assessment/appearanceConcerns.ts";
import { buildMogaFaceAnalysis } from "../../lib/observation/build.ts";
import { measuredObservation } from "../../lib/observation/helpers.ts";
import { illustrationPromptFor } from "../../lib/image-generation/provider.ts";
import { buildPredictionPlan } from "../../lib/visualization/predict.ts";
import { CATEGORY_FOCUS } from "../../lib/visualization/focus.ts";
import { validateIllustrationPrompt } from "../../lib/visualization/safety.ts";
import type { Assessment } from "../../lib/assessment/types.ts";

const FRONT = { ref: "test-front", qualityValid: true };

function assessment(selected: AppearanceConcernId[], details: AppearanceConcernDetailId[] = []): Assessment {
  const a = createEmptyAssessment();
  a.appearanceConcerns = { ...a.appearanceConcerns, selected, details, priorities: selected.slice(0, 3) };
  return a;
}

test("a selected place is named in the prompt, and a different place in that area is not", () => {
  const a = assessment(["FACIAL_LINES"], ["FOREHEAD_LINES"]);
  const analysis = buildMogaFaceAnalysis(a, null);
  analysis.observations.push(measuredObservation({ id: "expression.browRaise.foreheadRegionMovementPct", domain: "expression", label: "Brow raise movement", value: 24, source: "video_frame_0" }));
  const plan = buildPredictionPlan({ assessment: a, analysis, frontPhoto: FRONT });
  assert.equal(plan.status, "planned");
  assert.match(plan.focus.map((focus) => focus.text).join(" "), /horizontal lines across the forehead/);
  const prompt = illustrationPromptFor(plan);
  assert.match(prompt, /horizontal lines across the forehead/);
  assert.doesNotMatch(prompt, /lines around the mouth/);
  assert.match(prompt, /expression lines in the forehead region only/);
  assert.deepEqual(validateIllustrationPrompt(prompt), []);
});

test("skin with no chosen place uses the category default, not another person's detail", () => {
  const a = assessment(["SKIN_TONE"]);
  const plan = buildPredictionPlan({ assessment: a, analysis: buildMogaFaceAnalysis(a, null), frontPhoto: FRONT });
  assert.equal(plan.status, "planned");
  assert.deepEqual(plan.focus, []);
  const prompt = illustrationPromptFor(plan);
  assert.match(prompt, new RegExp(CATEGORY_FOCUS.skin_appearance.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(prompt, /dull/);
  assert.deepEqual(validateIllustrationPrompt(prompt), []);
});

test("dull-looking skin is the focus when that is what the person selected", () => {
  const a = assessment(["SKIN_TONE"], ["DULL_LOOKING_SKIN"]);
  const plan = buildPredictionPlan({ assessment: a, analysis: buildMogaFaceAnalysis(a, null), frontPhoto: FRONT });
  const prompt = illustrationPromptFor(plan);
  assert.match(prompt, /skin that looks dull/);
  assert.doesNotMatch(prompt, /dark spots/);
  assert.deepEqual(validateIllustrationPrompt(prompt), []);
});

test("hair thinning names coverage on this photo and does not diagnose hair loss", () => {
  const a = createEmptyAssessment();
  a.hair = { ...a.hair, concerns: ["thinning"] };
  const plan = buildPredictionPlan({ assessment: a, analysis: buildMogaFaceAnalysis(a, null), frontPhoto: FRONT });
  assert.equal(plan.status, "planned");
  const prompt = illustrationPromptFor(plan);
  assert.match(prompt, /where the scalp shows through the hair/);
  assert.doesNotMatch(prompt, /hair loss|balding|regrowth|transplant/i);
  assert.deepEqual(validateIllustrationPrompt(prompt), []);
});

test("every category default passes the image-prompt safety check", () => {
  for (const text of Object.values(CATEGORY_FOCUS)) assert.deepEqual(validateIllustrationPrompt(text), [], text);
});
