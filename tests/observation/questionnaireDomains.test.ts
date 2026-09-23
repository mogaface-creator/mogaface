import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildHairAnalysis,
  buildFacialHairAnalysis,
  buildSkinAnalysis,
  buildLifestyleAnalysis,
  buildStyleAnalysis,
} from "../../lib/observation/questionnaireDomains.ts";
import { createEmptyAssessment } from "../../lib/assessment/defaults.ts";
import { buildFilledAssessment } from "./fixtures.ts";

test("an unanswered questionnaire produces zero user-reported observations per domain (domain completeness: honest empty state)", () => {
  const empty = createEmptyAssessment();
  assert.deepEqual(buildHairAnalysis(empty).userReported, []);
  assert.deepEqual(buildFacialHairAnalysis(empty).userReported, []);
  assert.deepEqual(buildLifestyleAnalysis(empty).userReported, []);
  assert.deepEqual(buildStyleAnalysis(empty).userReported, []);
});

test("hair analysis maps answered fields to user_reported observations, source=user", () => {
  const hair = buildHairAnalysis(buildFilledAssessment());
  assert.ok(hair.userReported.length > 0);
  for (const obs of hair.userReported) {
    assert.equal(obs.type, "user_reported");
    assert.equal(obs.confidence, "self_reported");
    assert.equal(obs.source, "user");
    assert.equal(obs.domain, "hair");
  }
  const concerns = hair.userReported.find((o) => o.id === "hair.concerns");
  assert.deepEqual(concerns?.value, ["hairline", "styling"]);
});

test("hair analysis has no computer-vision inferences (Step 3A: not claimed to exist)", () => {
  assert.deepEqual(buildHairAnalysis(buildFilledAssessment()).inferences, []);
});

test("facial hair analysis maps current style and improvements", () => {
  const facialHair = buildFacialHairAnalysis(buildFilledAssessment());
  assert.ok(facialHair.userReported.some((o) => o.id === "facialHair.currentStyle" && o.value === "stubble"));
  assert.ok(facialHair.userReported.some((o) => o.id === "facialHair.improvements"));
});

test("skin analysis is explicitly not_implemented with no fabricated data", () => {
  const skin = buildSkinAnalysis();
  assert.equal(skin.status, "not_implemented");
  assert.deepEqual(skin.userReported, []);
  assert.equal(skin.visualObservations, null);
  assert.equal(skin.imageAnalysisResults, null);
  assert.deepEqual(skin.inferences, []);
});

test("lifestyle analysis maps all five answered fields", () => {
  const lifestyle = buildLifestyleAnalysis(buildFilledAssessment());
  assert.equal(lifestyle.userReported.length, 5);
});

test("style analysis maps current style, style goals, and monthly spend", () => {
  const style = buildStyleAnalysis(buildFilledAssessment());
  assert.equal(style.userReported.length, 3);
  assert.ok(style.userReported.every((o) => o.type === "user_reported"));
});
