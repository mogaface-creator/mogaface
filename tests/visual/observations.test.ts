import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMogaFaceAnalysis } from "../../lib/observation/build.ts";
import { buildEyeAreaAnalysis, buildFacialStructureAnalysis, UNDER_EYE_NOT_MEASURED } from "../../lib/observation/photoDomains.ts";
import { buildExpressionAnalysis } from "../../lib/observation/videoDomains.ts";
import { validateObservation } from "../../lib/observation/validate.ts";
import { measuredObservation } from "../../lib/observation/helpers.ts";
import { ANALYSIS_LIMITATIONS } from "../../lib/observation/limitations.ts";
import { calculateContourGeometry } from "../../lib/facial-analysis/contour.ts";
import { LANDMARK } from "../../lib/facial-analysis/landmarkMapping.ts";
import { analyzeVideoFrames } from "../../lib/facial-analysis/video/observe.ts";
import { buildCompleteFrontRecord, buildFilledAssessment, buildMultiPhotoAnalysisWithFront } from "../observation/fixtures.ts";
import type { MultiPhotoFacialAnalysis } from "../../lib/facial-analysis/multiPhoto/types.ts";
import {
  BROW_RAISED,
  META,
  contourFace,
  expressionFace,
  flatGray,
  stripeRows,
  withNeutralOpening,
} from "./fixtures.ts";

function multiPhoto(opts: { leftContour?: boolean; underEye?: { right: number; left: number } | null } = {}): MultiPhotoFacialAnalysis {
  const front = buildCompleteFrontRecord();
  front.contour = calculateContourGeometry(contourFace(), 1200, 1600, "front");
  if (opts.underEye) {
    const side = (ratio: number) => ({ underEyeLuminance: ratio * 100, cheekLuminance: 100, luminanceRatio: ratio });
    front.underEye = { right: side(opts.underEye.right), left: side(opts.underEye.left) };
  }
  const photos = [front];
  if (opts.leftContour) {
    const turned = contourFace();
    turned[LANDMARK.noseTip] = { x: 0.35, y: 0.55, z: 0 };
    photos.push({ ...buildCompleteFrontRecord(), slot: "leftFortyFive", contour: calculateContourGeometry(turned, 1200, 1600, "threeQuarter") });
  }
  return { ...buildMultiPhotoAnalysisWithFront(), photos };
}

function videoWithForeheadLines() {
  const frames = withNeutralOpening(BROW_RAISED(), expressionFace({ browRaise: 0.016 })).map((f) => ({
    ...f,
    gray: f.index >= 3 ? stripeRows(flatGray(), 300, 700, 150, 330) : flatGray(),
  }));
  return analyzeVideoFrames(META, frames);
}

// ---- contour (multi-photo) ----

test("multi-photo contour: front and a 45° view both contribute, each traced to its own photo slot", () => {
  const { measured } = buildFacialStructureAnalysis(multiPhoto({ leftContour: true }));
  const contour = measured.filter((o) => o.id.startsWith("facialStructure.contour."));
  const sources = new Set(contour.map((o) => o.source));
  assert.deepEqual([...sources].sort(), ["front", "leftFortyFive"]);
  assert.ok(contour.some((o) => o.id === "facialStructure.contour.cheekContourAngle.front.left"));
  assert.ok(contour.some((o) => o.id === "facialStructure.contour.jawContourAngle.leftFortyFive.left"));
  assert.ok(contour.some((o) => o.id === "facialStructure.contour.jawToFaceWidthRatio" && o.source === "front"));
  for (const o of contour) {
    assert.equal(o.domain, "facial-structure");
    assert.equal(o.type, "measured");
    assert.deepEqual(validateObservation(o), []);
  }
});

test("multi-photo contour: a 45° view contributes only its near side and no front-only ratios", () => {
  const { measured } = buildFacialStructureAnalysis(multiPhoto({ leftContour: true }));
  const left45 = measured.filter((o) => o.source === "leftFortyFive" && o.id.startsWith("facialStructure.contour."));
  assert.equal(left45.length, 2); // cheek + jaw angle, near side only
  assert.ok(left45.every((o) => !o.id.includes("Ratio")));
});

test("missing angle: with no 45° photo only front contour exists — nothing is borrowed or fabricated", () => {
  const { measured } = buildFacialStructureAnalysis(multiPhoto());
  const contour = measured.filter((o) => o.id.startsWith("facialStructure.contour."));
  assert.ok(contour.length > 0);
  assert.ok(contour.every((o) => o.source === "front"));
});

test("no complete photo → no contour observations; an incomplete record is ignored", () => {
  assert.deepEqual(buildFacialStructureAnalysis(null).measured, []);
  const mp = multiPhoto({ leftContour: true });
  mp.photos[1].status = "blocked";
  const sources = buildFacialStructureAnalysis(mp).measured.map((o) => o.source);
  assert.ok(!sources.includes("leftFortyFive"));
});

test("chin projection is not fabricated: profile geometry stays unimplemented", () => {
  const mp = multiPhoto({ leftContour: true });
  const ids = buildFacialStructureAnalysis(mp).measured.map((o) => o.id.toLowerCase());
  assert.ok(!ids.some((id) => id.includes("chin") && id.includes("projection")));
  assert.ok(ANALYSIS_LIMITATIONS.some((l) => l.includes("chin projection")));
});

// ---- under-eye ----

test("under-eye: both eyes darker than the adjacent cheek → 'visible dark-looking' observation with numeric support", () => {
  const eye = buildEyeAreaAnalysis(multiPhoto({ underEye: { right: 0.7, left: 0.75 } }));
  assert.equal(eye.visual.length, 1);
  assert.equal(eye.visual[0].id, "eyeArea.visibleUnderEyeDarkness");
  assert.equal(eye.visual[0].value, true);
  assert.equal(eye.visual[0].source, "front");
  assert.match(eye.visual[0].label, /dark-looking under-eye appearance/);
  assert.deepEqual(eye.measured.filter((o) => o.id.startsWith("eyeArea.underEyeBrightnessRatio")).map((o) => o.value), [0.7, 0.75]);
  for (const o of [...eye.visual, ...eye.measured]) assert.deepEqual(validateObservation(o), []);
});

test("under-eye: only one dark side, or no darkness, produces no darkness observation", () => {
  assert.deepEqual(buildEyeAreaAnalysis(multiPhoto({ underEye: { right: 0.7, left: 1 } })).visual, []);
  assert.deepEqual(buildEyeAreaAnalysis(multiPhoto({ underEye: { right: 1, left: 0.95 } })).visual, []);
});

test("under-eye: without a measurement there is nothing to observe (existing eye-area behaviour is unchanged)", () => {
  const eye = buildEyeAreaAnalysis(multiPhoto());
  assert.deepEqual(eye.visual, []);
  assert.ok(!eye.measured.some((o) => o.id.startsWith("eyeArea.underEye")));
  assert.deepEqual(eye.inferences, []);
});

test("apparent hollowing / puffiness / fine lines are explicitly NOT measured, with reasons — and worded as appearance", () => {
  const eye = buildEyeAreaAnalysis(multiPhoto());
  assert.equal(eye.notMeasured.length, 3);
  const labels = eye.notMeasured.map((n) => n.label);
  assert.ok(labels.includes("Apparent under-eye hollowing"));
  assert.ok(labels.includes("Visible under-eye puffiness"));
  assert.ok(eye.notMeasured.every((n) => n.reason.length > 20));
  assert.equal(UNDER_EYE_NOT_MEASURED, eye.notMeasured);
});

// ---- video / expression domain ----

test("no video → expression domain is 'not_provided' and empty", () => {
  assert.deepEqual(buildExpressionAnalysis(null), { status: "not_provided", measured: [], expressions: [], linePatterns: [], notes: [] });
});

test("expression observations are measured, well-formed, and traceable to video frames", () => {
  const expr = buildExpressionAnalysis(videoWithForeheadLines());
  assert.equal(expr.status, "analyzed");
  const ids = expr.measured.map((o) => o.id);
  assert.ok(ids.includes("expression.browRaise.foreheadRegionMovementPct"));
  assert.ok(ids.includes("expression.visibleForeheadLinePattern"));
  for (const o of expr.measured) {
    assert.equal(o.domain, "expression");
    assert.equal(o.type, "measured");
    assert.match(o.source, /^video_frame_\d+(\+video_frame_\d+)*$/);
    assert.deepEqual(validateObservation(o), []);
  }
  const pattern = expr.measured.find((o) => o.id === "expression.visibleForeheadLinePattern")!;
  assert.equal(pattern.value, true);
  assert.equal(pattern.source, "video_frame_0+video_frame_1+video_frame_2+video_frame_3+video_frame_4");
});

test("provenance: an expression observation whose source is not a video frame is flagged", () => {
  const bad = measuredObservation({ id: "expression.x", domain: "expression", label: "x", value: 1, source: "front" });
  assert.match(validateObservation(bad).join(), /does not trace to video frames/);
  const noSource = measuredObservation({ id: "expression.x", domain: "expression", label: "x", value: 1, source: "" });
  assert.ok(validateObservation(noSource).length > 0);
});

test("a video that yields no baseline produces no observations but keeps its reasons", () => {
  const expr = buildExpressionAnalysis(analyzeVideoFrames(META, []));
  assert.equal(expr.status, "insufficient_evidence");
  assert.deepEqual(expr.measured, []);
  assert.ok(expr.notes.length > 0);
});

// ---- whole analysis ----

test("buildMogaFaceAnalysis: video observations join the flat list; versions record the video analysis", () => {
  const video = videoWithForeheadLines();
  const a = buildMogaFaceAnalysis(buildFilledAssessment(), multiPhoto({ leftContour: true, underEye: { right: 0.7, left: 0.7 } }), video);
  assert.equal(a.versions.videoAnalysisVersion, video.videoAnalysisVersion);
  for (const id of ["expression.visibleForeheadLinePattern", "eyeArea.visibleUnderEyeDarkness", "facialStructure.contour.jawContourAngle.front.left"]) {
    assert.ok(a.observations.some((o) => o.id === id), id);
  }
  for (const o of a.observations) assert.deepEqual(validateObservation(o), [], o.id);
  const ids = a.observations.map((o) => o.id);
  assert.equal(new Set(ids).size, ids.length, "observation ids are unique");
});

test("buildMogaFaceAnalysis without a video: videoAnalysisVersion is null and no expression observations exist", () => {
  const a = buildMogaFaceAnalysis(buildFilledAssessment(), multiPhoto());
  assert.equal(a.versions.videoAnalysisVersion, null);
  assert.equal(a.expression.status, "not_provided");
  assert.ok(!a.observations.some((o) => o.domain === "expression"));
});

// ---- terminology ----

test("no diagnosis, aging, or treatment terminology anywhere in the visual observations", () => {
  const a = buildMogaFaceAnalysis(buildFilledAssessment(), multiPhoto({ leftContour: true, underEye: { right: 0.7, left: 0.7 } }), videoWithForeheadLines());
  const text = JSON.stringify({ o: a.observations, notMeasured: a.eyeArea.notMeasured, expr: a.expression.expressions.map((e) => [e.reason, e.evidence.movementMetric]) }).toLowerCase();
  const banned = [
    "botox", "filler", "threads", "neuromodulator", "laser", "wrinkle", "aging", "ageing", "laxity", "sagging", "diagnos", "acne", "melasma", "rosacea",
    "dermatitis", "scar", "hyperpigment", "volume deficiency", "volume loss", "candidate", "you need", "needs treatment", "suitab", "attractive", "beautiful", "ideal",
  ];
  for (const word of banned) assert.ok(!text.includes(word), `visual observations mention "${word}"`);
});

test("under-eye labels use appearance wording ('dark-looking', 'apparent') and never cause language", () => {
  const eye = buildEyeAreaAnalysis(multiPhoto({ underEye: { right: 0.7, left: 0.7 } }));
  const text = [...eye.visual, ...eye.measured].map((o) => o.label).concat(eye.notMeasured.map((n) => n.label)).join(" ").toLowerCase();
  assert.match(text, /dark-looking/);
  assert.match(text, /apparent under-eye hollowing/);
  for (const w of ["hyperpigmentation", "volume deficiency", "bags", "circles", "fatigue"]) assert.ok(!text.includes(w), w);
});

test("limitations document lighting, angle, expression, video, skin, diagnosis, suitability, prediction and calibration", () => {
  const text = ANALYSIS_LIMITATIONS.join(" ").toLowerCase();
  for (const phrase of ["lighting", "camera angle", "expression", "video", "clinical diagnosis", "treatment suitability determination", "prediction of any treatment result", "calibration reference", "skin analysis is not implemented"]) {
    assert.ok(text.includes(phrase), `limitations should mention "${phrase}"`);
  }
});
