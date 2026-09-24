import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyAgainstBand, thresholdBand } from "../../lib/facial-analysis/bands.ts";
import { collectRawPhotoMetrics, collectRawVideoMetrics } from "../../lib/facial-analysis/calibration/raw.ts";
import { photoThresholdDecisions, videoThresholdDecisions } from "../../lib/facial-analysis/calibration/decisions.ts";
import { VISUAL_THRESHOLDS } from "../../lib/facial-analysis/calibration/thresholds.ts";
import { DECISION_RESULTS } from "../../lib/facial-analysis/calibration/types.ts";
import { MOVEMENT_THRESHOLD_PCT } from "../../lib/facial-analysis/video/expressions.ts";
import { analyzeVideoFrames } from "../../lib/facial-analysis/video/observe.ts";
import { UNDER_EYE_DARKER_RATIO, classifyUnderEyeDarkness } from "../../lib/facial-analysis/underEye.ts";
import { buildEyeAreaAnalysis } from "../../lib/observation/photoDomains.ts";
import { buildMultiPhotoAnalysisWithFront } from "../observation/fixtures.ts";
import { META, NEUTRAL, expressionFace, flatGray, sample, stripeRows, withNeutralOpening, BROW_RAISED } from "../visual/fixtures.ts";
import { frontRecord, photoSample } from "./fixtures.ts";

const decision = (list: ReturnType<typeof photoThresholdDecisions>, id: string) => list.find((d) => d.id === id)!;

// ---- band utility ----

test("bands: at-least and at-most thresholds have a borderline zone on both sides of the threshold", () => {
  const up = thresholdBand(1.3, 0.1, "atLeast");
  assert.equal(classifyAgainstBand(1.5, up, "atLeast"), "PASSES");
  assert.equal(classifyAgainstBand(1.3, up, "atLeast"), "BORDERLINE"); // exactly AT the threshold is borderline
  assert.equal(classifyAgainstBand(1.2, up, "atLeast"), "BORDERLINE");
  assert.equal(classifyAgainstBand(1.1, up, "atLeast"), "FAILS");
  const down = thresholdBand(0.85, 0.05, "atMost");
  assert.equal(classifyAgainstBand(0.7, down, "atMost"), "PASSES");
  assert.equal(classifyAgainstBand(0.85, down, "atMost"), "BORDERLINE");
  assert.equal(classifyAgainstBand(0.95, down, "atMost"), "FAILS");
  assert.equal(classifyAgainstBand(Number.NaN, down, "atMost"), "FAILS");
});

// ---- under-eye: close to threshold → insufficient ----

test("under-eye near the threshold is BORDERLINE and produces NO observation (conservative)", () => {
  for (const ratio of [0.82, 0.84, UNDER_EYE_DARKER_RATIO, 0.87]) {
    const rec = frontRecord(ratio);
    assert.equal(classifyUnderEyeDarkness(rec.underEye), "BORDERLINE", String(ratio));
    const mp = { ...buildMultiPhotoAnalysisWithFront(), photos: [rec] };
    assert.deepEqual(buildEyeAreaAnalysis(mp).visual, [], `ratio ${ratio} must not yield an observation`);
  }
});

test("under-eye: clearly dark → observed; clearly not dark → not observed; unmeasured → not evaluated", () => {
  assert.equal(classifyUnderEyeDarkness(frontRecord(0.7).underEye), "OBSERVED");
  assert.equal(classifyUnderEyeDarkness(frontRecord(0.95).underEye), "NOT_OBSERVED");
  assert.equal(classifyUnderEyeDarkness(null), "NOT_EVALUATED");
  assert.equal(classifyUnderEyeDarkness({ right: null, left: null }), "NOT_EVALUATED");
});

test("the decision shown to a developer always agrees with whether the observation was produced", () => {
  for (const ratio of [0.5, 0.7, 0.8, 0.83, 0.85, 0.88, 0.95, 1.1]) {
    const rec = frontRecord(ratio);
    const raw = collectRawPhotoMetrics(rec, null);
    const d = decision(photoThresholdDecisions(raw, "front"), "photo.visibleUnderEyeDarkness");
    const produced = buildEyeAreaAnalysis({ ...buildMultiPhotoAnalysisWithFront(), photos: [rec] }).visual.length > 0;
    assert.equal(d.result === "OBSERVED", produced, `ratio ${ratio}`);
  }
});

test("threshold decision shape: metric, value, threshold, comparator, band, result, note", () => {
  const list = photoThresholdDecisions(collectRawPhotoMetrics(frontRecord(0.7), null), "front");
  const d = decision(list, "photo.underEyeRatio.right");
  assert.equal(d.value, 0.7);
  assert.equal(d.threshold, UNDER_EYE_DARKER_RATIO);
  assert.equal(d.comparator, "<=");
  assert.ok(d.borderline && d.borderline.clear < UNDER_EYE_DARKER_RATIO && d.borderline.fail > UNDER_EYE_DARKER_RATIO);
  assert.equal(d.result, "OBSERVED");
  assert.equal(d.gates, "eyeArea.visibleUnderEyeDarkness");
  for (const x of list) {
    assert.ok((DECISION_RESULTS as readonly string[]).includes(x.result));
    assert.ok(x.value === null || Number.isFinite(x.value));
    assert.ok(x.metric.length > 0 && x.note.length >= 0);
  }
});

test("threshold decisions serialize to JSON and back unchanged", () => {
  const list = photoSample().thresholdDecisions;
  assert.deepEqual(JSON.parse(JSON.stringify(list)), list);
});

test("photo quality gates and 45° turned-enough check appear with values", () => {
  const front = photoThresholdDecisions(collectRawPhotoMetrics(frontRecord(), null), "front");
  assert.equal(decision(front, "photo.roll").result, "PASSED");
  assert.equal(decision(front, "photo.yaw").result, "PASSED");
  assert.ok(!front.some((d) => d.id === "photo.turned45"));
  const left = photoThresholdDecisions(collectRawPhotoMetrics(frontRecord(), null), "leftFortyFive");
  const turned = decision(left, "photo.turned45");
  assert.equal(turned.result, "FAILED", "a frontal-looking '45°' photo is flagged");
  assert.equal(turned.gates, "facialStructure.contour.*");
  assert.ok(!left.some((d) => d.id === "photo.roll"), "roll/yaw gates only apply to front photos");
});

test("no face: raw metrics are honest nulls and decisions are NOT_EVALUATED, never invented", () => {
  const rec = frontRecord();
  rec.faceCount = 0;
  rec.landmarks = null;
  rec.measurements = rec.contour = rec.underEye = rec.quality = null;
  const raw = collectRawPhotoMetrics(rec, null);
  assert.equal(raw.detectionStatus, "no_face");
  assert.equal(raw.rollDegrees, null);
  assert.equal(raw.faceBoundingBox, null);
  assert.equal(raw.requiredLandmarksPresent, false);
  const d = photoThresholdDecisions(raw, "front");
  assert.equal(decision(d, "photo.visibleUnderEyeDarkness").result, "NOT_EVALUATED");
  assert.equal(decision(d, "photo.roll").result, "NOT_EVALUATED");
});

test("multiple faces are reported as such", () => {
  const rec = frontRecord();
  rec.faceCount = 2;
  assert.equal(collectRawPhotoMetrics(rec, null).detectionStatus, "multiple_faces");
});

// ---- video: movement ----

test("video movement near the threshold is BORDERLINE: not classified, not an observation", () => {
  const nearMiss = expressionFace({ browRaise: 0.0066 }); // ≈ +12.0%: exactly at the 12% threshold
  const a = analyzeVideoFrames(META, withNeutralOpening(nearMiss));
  assert.equal(a.expressions.find((e) => e.expression === "BROW_RAISE")!.status, "insufficient_evidence");
  const d = videoThresholdDecisions(collectRawVideoMetrics(a)).find((x) => x.id === "video.movement.BROW_RAISE")!;
  assert.equal(d.result, "BORDERLINE_INSUFFICIENT");
  assert.equal(d.threshold, MOVEMENT_THRESHOLD_PCT.BROW_RAISE);
  assert.ok(Math.abs(d.value! - 12) < 0.5);
});

test("video movement: clear → OBSERVED; none → NOT_OBSERVED; no baseline → NOT_EVALUATED", () => {
  const clear = videoThresholdDecisions(collectRawVideoMetrics(analyzeVideoFrames(META, withNeutralOpening(BROW_RAISED()))));
  assert.equal(clear.find((x) => x.id === "video.movement.BROW_RAISE")!.result, "OBSERVED");
  assert.equal(clear.find((x) => x.id === "video.movement.SMILE")!.result, "NOT_OBSERVED");
  assert.equal(clear.find((x) => x.id === "video.baselineStability")!.result, "PASSED");

  const none = videoThresholdDecisions(collectRawVideoMetrics(analyzeVideoFrames(META, [])));
  assert.ok(none.filter((x) => x.id.startsWith("video.movement.")).every((x) => x.result === "NOT_EVALUATED"));
  assert.equal(none.find((x) => x.id === "video.baselineStability")!.result, "FAILED");
});

// ---- video: line contrast ----

const framesWithContrast = (neutralAmp: number, exprAmp: number) =>
  withNeutralOpening(BROW_RAISED(), expressionFace({ browRaise: 0.016 })).map((f) => ({
    ...f,
    gray: stripeRows(flatGray(), 300, 700, 150, 330, 8, 120 - (f.index >= 3 ? exprAmp : neutralAmp), 120 + (f.index >= 3 ? exprAmp : neutralAmp)),
  }));

test("line contrast close to the threshold is insufficient evidence (no pattern observation)", () => {
  // Amplitudes 10 vs 14 measure a ratio of ≈1.30 (the forehead box moves with the raised brows, so it is not exactly 1.4).
  const a = analyzeVideoFrames(META, framesWithContrast(10, 14));
  const p = a.linePatterns.find((x) => x.kind === "forehead")!;
  assert.ok(p.contrastRatio! > 1.17 && p.contrastRatio! < 1.43, `ratio ${p.contrastRatio} should sit in the borderline band`);
  assert.equal(p.status, "insufficient_evidence");
  assert.match(p.reason, /close to the threshold/);
  const d = videoThresholdDecisions(collectRawVideoMetrics(a)).find((x) => x.id === "video.lineContrast.forehead.BROW_RAISE")!;
  assert.equal(d.result, "BORDERLINE_INSUFFICIENT");
  assert.equal(d.gates, "expression.visibleForeheadLinePattern");
});

test("line contrast clearly higher → OBSERVED, with the raw neutral and expression contrasts exposed", () => {
  const a = analyzeVideoFrames(META, framesWithContrast(4, 12)); // ratio ≈ 3
  const p = a.linePatterns.find((x) => x.kind === "forehead")!;
  assert.equal(p.status, "observed");
  assert.ok(p.neutralContrast! > 0 && p.expressionContrast! > p.neutralContrast!);
  const d = videoThresholdDecisions(collectRawVideoMetrics(a)).find((x) => x.id === "video.lineContrast.forehead.BROW_RAISE")!;
  assert.equal(d.result, "OBSERVED");
  assert.match(d.note, /neutral 0\.\d+, expression 0\.\d+/);
});

test("line contrast: no pixel data → NOT_EVALUATED", () => {
  const a = analyzeVideoFrames(META, withNeutralOpening(BROW_RAISED()));
  const d = videoThresholdDecisions(collectRawVideoMetrics(a)).find((x) => x.id === "video.lineContrast.forehead.BROW_RAISE")!;
  assert.equal(d.result, "NOT_EVALUATED");
});

test("video raw frames: unusable frames keep their timestamps and reasons but carry no classification", () => {
  const frames = [sample(0, null), ...[NEUTRAL(), NEUTRAL(), NEUTRAL()].map((lm, i) => sample(i + 1, lm))];
  const raw = collectRawVideoMetrics(analyzeVideoFrames(META, frames));
  assert.equal(raw.frames[0].usable, false);
  assert.equal(raw.frames[0].state, null);
  assert.equal(raw.frames[0].movementPct, null);
  assert.match(raw.frames[0].reasons.join(), /No face detected/);
  assert.equal(raw.frames[1].timeSec, 0.5);
});

// ---- registry ----

test("threshold registry: unique ids, finite values, every kind documented, values are the live constants", () => {
  const ids = VISUAL_THRESHOLDS.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(VISUAL_THRESHOLDS.every((t) => Number.isFinite(t.value) && t.value > 0 && t.meaning.length > 20 && t.affects.length > 0));
  assert.equal(VISUAL_THRESHOLDS.find((t) => t.id === "movement.BROW_RAISE")!.value, MOVEMENT_THRESHOLD_PCT.BROW_RAISE);
  assert.equal(VISUAL_THRESHOLDS.find((t) => t.id === "underEye.darkerRatio")!.value, UNDER_EYE_DARKER_RATIO);
});
