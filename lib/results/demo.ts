/**
 * DEVELOPMENT DEMO FIXTURE — NOT A REAL ASSESSMENT.
 *
 * Because the visual observation layer is uncalibrated, real assessments
 * currently yield very few consumer-ready opportunities (see
 * VISUAL_OBSERVATIONS_CALIBRATED). This fixture lets a developer see the
 * full consumer experience anyway: it hand-builds SYNTHETIC observations,
 * runs them through the real treatment-opportunity engine, and then marks the
 * resulting opportunities consumer-ready *for the demo only*. It fakes no
 * analysis of any real person: the "photos" are labelled SVG placeholders.
 *
 * Reachable only at /results?demo=1 and only outside production builds.
 * It exists to test UI and pipeline behavior. It says nothing about any real
 * face, treatment, or outcome.
 */

import { createEmptyAssessment } from "../assessment/defaults.ts";
import { evaluateTreatmentOpportunities } from "../treatment-opportunities/evaluate.ts";
import { buildMogaFaceAnalysis } from "../observation/build.ts";
import { measuredObservation } from "../observation/helpers.ts";
import type { AssessmentSnapshot } from "./types.ts";
import { SNAPSHOT_VERSION } from "./types.ts";

const svg = (body: string) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 750">${body}</svg>`)}`;

const HEAD = (tone: string) =>
  `<rect width="600" height="750" fill="#e9e6df"/><ellipse cx="300" cy="330" rx="150" ry="195" fill="${tone}"/>` +
  `<path d="M120 750 C130 590 210 540 300 540 C390 540 470 590 480 750Z" fill="#c9c5bb"/>` +
  `<path d="M150 300 C150 130 450 130 450 300 C420 230 180 230 150 300Z" fill="#4a4540"/>`;

/** A neutral placeholder — explicitly not a photo of anyone. */
export function demoBeforeImage(): string {
  return svg(`${HEAD("#d9cfc2")}<text x="300" y="705" text-anchor="middle" font-family="sans-serif" font-size="22" fill="#6b6d70">DEMO PLACEHOLDER — NOT A REAL PHOTO</text>`);
}

/** A visibly different placeholder, so a before/after layout can be checked. */
export function demoAfterImage(): string {
  return svg(`${HEAD("#dcd2c5")}<path d="M195 430 C240 520 360 520 405 430" stroke="#b9ab9a" stroke-width="4" fill="none"/>` +
    `<text x="300" y="705" text-anchor="middle" font-family="sans-serif" font-size="22" fill="#6b6d70">MOCK ILLUSTRATION — NOT A REAL RESULT</text>`);
}

export function buildDemoSnapshot(): AssessmentSnapshot {
  const assessment = createEmptyAssessment();
  assessment.appearanceConcerns = {
    ...assessment.appearanceConcerns,
    selected: ["FACIAL_DEFINITION", "FACIAL_LINES", "SKIN_TONE", "UNDER_EYE", "FACIAL_VOLUME", "FACIAL_LIFTING"],
    details: ["JAW_DEFINITION", "FOREHEAD_LINES"],
    priorities: ["FACIAL_DEFINITION", "FACIAL_LINES", "SKIN_TONE"],
  };

  const analysis = buildMogaFaceAnalysis(assessment, null);
  const obs = (id: string, domain: "facial-structure" | "eye-area" | "expression", label: string, value: number | boolean, source: string) =>
    measuredObservation({ id, domain, label, value, source });
  analysis.observations.push(
    obs("facialStructure.jawWidth", "facial-structure", "Jaw width", 0.41, "front"),
    obs("facialStructure.lowerFaceHeight", "facial-structure", "Lower face height", 0.29, "front"),
    obs("facialStructure.contour.jawContourAngle.front.left", "facial-structure", "Jaw contour angle, left side (front)", 124, "front"),
    obs("facialStructure.contour.jawContourAngle.leftFortyFive.left", "facial-structure", "Jaw contour angle, left side (left 45°)", 121, "leftFortyFive"),
    obs("expression.browRaise.foreheadRegionMovementPct", "expression", "Brow raise movement", 24, "video_frame_0+video_frame_1+video_frame_2+video_frame_5"),
    obs("expression.visibleForeheadLinePattern", "expression", "Visible forehead line pattern", true, "video_frame_0+video_frame_1+video_frame_2+video_frame_5"),
    obs("eyeArea.visibleUnderEyeDarkness", "eye-area", "Visible dark-looking under-eye appearance", true, "front"),
    obs("eyeArea.leftEyeWidth", "eye-area", "Left eye width", 0.11, "front"),
  );

  // Real engine, synthetic evidence. The demo alone overrides the calibration gate.
  const opportunities = evaluateTreatmentOpportunities({ assessment, analysis }).map((o) => ({ ...o, consumerReady: true }));

  return {
    version: SNAPSHOT_VERSION,
    createdAt: new Date().toISOString(),
    isDemo: true,
    assessment,
    analysis,
    opportunities,
    frontPhoto: { ref: demoBeforeImage(), qualityValid: true },
  };
}
