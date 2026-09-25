import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MIN_LABELLED_FOR_RATE, STATISTIC_LABEL, aggregateSessions, borderlineDecisions, buildSessionReport, marginReport, multiViewConsistency,
  photoQualityReport, sessionMargins, videoFrameCounts,
} from "../../lib/facial-analysis/calibration/report.ts";
import { emptyExpectations } from "../../lib/facial-analysis/calibration/expectations.ts";
import { createPhotoCalibrationSample } from "../../lib/facial-analysis/calibration/sample.ts";
import { withPhotoSample } from "../../lib/facial-analysis/calibration/session.ts";
import type { ThresholdDecision } from "../../lib/facial-analysis/calibration/types.ts";
import { analyzeVideoFrames } from "../../lib/facial-analysis/video/observe.ts";
import { collectRawVideoMetrics } from "../../lib/facial-analysis/calibration/raw.ts";
import { META, NEUTRAL, sample } from "../visual/fixtures.ts";
import { flatGray } from "../visual/fixtures.ts";
import { frontRecord } from "./fixtures.ts";
import { realSession } from "./sessionFixtures.ts";

const withVideoExpect = (id: string, o: { brow?: "clearly" | "absent" | "subtle" | "unclear"; forehead?: "clearly" | "absent" | "subtle" | "unclear"; frown?: "clearly" | "absent" | "subtle" }) =>
  realSession(id, { expectations: { ...emptyExpectations(), lines: { forehead: o.forehead ?? null, glabellar: null, lateralEye: null }, expression: { BROW_RAISE: o.brow ?? null, FROWN: o.frown ?? null, SMILE: null, SQUINT: null } } });

// ---- input quality with reasons ----

test("photo quality report: failed samples are never hidden — the reason is stated", () => {
  const noFace = frontRecord();
  noFace.faceCount = 0;
  noFace.landmarks = null;
  noFace.quality = { valid: false, errors: ["No face detected. Use a clear, front-facing photo with good lighting."], warnings: [], qualityScore: 75 };
  const r = photoQualityReport(createPhotoCalibrationSample({ record: noFace, gray: null, sourceDescription: "x", role: "front" }));
  assert.equal(r.status, "unusable");
  assert.equal(r.faceDetected, false);
  assert.equal(r.landmarkStatus, "not_detected");
  assert.ok(r.reasons.includes("Face not detected."));
  assert.equal(r.qualityScore, 75);
  assert.equal(r.rollDegrees, null);
});

test("photo quality report: dark, small, tilted and turned inputs each get a plain reason", () => {
  const rec = frontRecord();
  rec.meanBrightness = 12;
  const dark = photoQualityReport(createPhotoCalibrationSample({ record: rec, gray: null, sourceDescription: "x", role: "front" }));
  assert.ok(dark.reasons.includes("Image too dark."));
  assert.equal(dark.status, "borderline");

  const small = frontRecord();
  small.landmarks = small.landmarks!.map((p) => ({ ...p, x: 0.5 + (p.x - 0.5) * 0.3, y: 0.5 + (p.y - 0.5) * 0.3 }));
  assert.ok(photoQualityReport(createPhotoCalibrationSample({ record: small, gray: null, sourceDescription: "x", role: "front" })).reasons.includes("Face too small in frame."));

  const tilted = frontRecord();
  tilted.landmarks = tilted.landmarks!.map((p, i) => (i === 263 ? { ...p, y: p.y + 0.2 } : p));
  assert.ok(photoQualityReport(createPhotoCalibrationSample({ record: tilted, gray: null, sourceDescription: "x", role: "front" })).reasons.includes("Head tilt outside the expected range."));

  const frontal45 = createPhotoCalibrationSample({ record: { ...frontRecord(), slot: "leftFortyFive" }, gray: null, sourceDescription: "x", role: "leftFortyFive" });
  assert.ok(photoQualityReport(frontal45).reasons.includes("This does not look turned enough to be a 45° view."));
});

test("photo quality report exposes the raw quality numbers: score, roll, yaw, brightness, face size, landmarks", () => {
  const r = photoQualityReport(realSession().photoSamples.front!);
  assert.equal(r.faceDetected, true);
  assert.equal(r.landmarkStatus, "complete");
  assert.equal(typeof r.qualityScore, "number");
  assert.ok(Math.abs(r.rollDegrees!) < 1e-6);
  assert.ok(r.yawRatio! >= 1);
  assert.equal(r.brightness, 120);
  assert.ok(Math.abs(r.faceSize! - 0.5) < 1e-9);
  assert.equal(r.status, "usable");
});

// ---- video ----

test("video frame counts: sampled, usable, rejected, neutral, expression and ambiguous frames", () => {
  const counts = videoFrameCounts(collectRawVideoMetrics(analyzeVideoFrames(META, [sample(0, null), ...[NEUTRAL(), NEUTRAL(), NEUTRAL()].map((lm, i) => sample(i + 1, lm))])));
  assert.deepEqual(counts, { sampled: 4, usable: 3, rejected: 1, neutral: 3, expression: 0, ambiguous: 0 });
  const s = realSession();
  assert.deepEqual(buildSessionReport(s).video.frames, { sampled: 5, usable: 5, rejected: 0, neutral: 3, expression: 2, ambiguous: 0 });
});

// ---- borderline ----

test("borderline reporting: the brief's example — threshold 1.30, observed 1.27 → BORDERLINE / WITHHELD with margin and reason", () => {
  const d: ThresholdDecision = {
    id: "video.lineContrast.forehead.BROW_RAISE", kind: "observation", metric: "forehead line contrast: BROW_RAISE ÷ neutral", value: 1.27, threshold: 1.3, comparator: ">=",
    borderline: { clear: 1.43, fail: 1.17 }, result: "BORDERLINE_INSUFFICIENT", note: "Close to the threshold; not used as evidence.", gates: "expression.visibleForeheadLinePattern",
  };
  const m = marginReport(d);
  assert.equal(m.status, "BORDERLINE / WITHHELD");
  assert.ok(Math.abs(m.margin! - -0.03) < 1e-9);
  assert.ok(Math.abs(m.marginPct! - (-0.03 / 1.3) * 100) < 1e-9);
  assert.deepEqual([m.metric, m.value, m.threshold, m.decision], ["forehead line contrast: BROW_RAISE ÷ neutral", 1.27, 1.3, "BORDERLINE_INSUFFICIENT"]);
  assert.match(m.reason, /Close to the threshold/);
  assert.deepEqual(m.band, { clear: 1.43, fail: 1.17 });
});

test("borderline reporting on a real session: a near-threshold under-eye ratio is listed first, with its signed margin", () => {
  const s = realSession("REAL-001", { underEyeRatio: 0.84 });
  const b = borderlineDecisions(s);
  assert.ok(b.length >= 1);
  const right = b.find((x) => x.id === "photo.underEyeRatio.right")!;
  assert.equal(right.status, "BORDERLINE / WITHHELD");
  assert.ok(Math.abs(right.margin! - (0.84 - 0.85)) < 1e-9);
  assert.equal(right.source, "front");
  assert.equal(sessionMargins(s)[0].status, "BORDERLINE / WITHHELD");
  assert.equal(buildSessionReport(s).borderlineCount, b.length);
  assert.equal(borderlineDecisions(realSession("REAL-002", { underEyeRatio: 0.6 })).filter((x) => x.id.startsWith("photo.underEye")).length, 0);
});

test("margins are reported for clear passes and clear fails too, and a threshold is never modified by reporting", () => {
  const clear = marginReport({ id: "a", kind: "observation", metric: "m", value: 0.7, threshold: 0.85, comparator: "<=", borderline: null, result: "OBSERVED", note: "", gates: null });
  assert.equal(clear.status, "CLEAR PASS");
  assert.equal(marginReport({ ...{ id: "a", kind: "observation" as const, metric: "m", value: null, threshold: 0.85, comparator: "<=" as const, borderline: null, note: "", gates: null }, result: "NOT_EVALUATED" }).margin, null);
});

// ---- multi-view consistency ----

test("multi-view consistency: contour angles per view, spread, and the engine's own disagreement guard", () => {
  const s = realSession();
  const c = multiViewConsistency(s);
  assert.ok(c.contour.some((g) => g.metric === "cheekContourAngle" && g.values.length >= 2));
  assert.ok(c.contour.every((g) => g.spread === null || g.spread >= 0));
  assert.equal(c.disagreementThresholdDeg, 20);

  // Force a real disagreement between the two 45° views and check the report agrees with the engine's guard.
  const tweak = (view: "leftFortyFive" | "rightFortyFive", delta: number) => {
    const sample = s.photoSamples[view]!;
    return { ...sample, generatedObservations: sample.generatedObservations.map((o) => (o.id.startsWith(`facialStructure.contour.cheekContourAngle.${view}`) ? { ...o, value: (o.value as number) + delta } : o)) };
  };
  const disagree = multiViewConsistency(withPhotoSample(withPhotoSample(s, "leftFortyFive", tweak("leftFortyFive", 0)), "rightFortyFive", tweak("rightFortyFive", 60)));
  const l = s.photoSamples.leftFortyFive!.generatedObservations.find((o) => o.id.includes("cheekContourAngle.leftFortyFive"))!.value as number;
  const r = s.photoSamples.rightFortyFive!.generatedObservations.find((o) => o.id.includes("cheekContourAngle.rightFortyFive"))!.value as number;
  assert.equal(disagree.contourViewsDisagree, Math.abs(l - (r + 60)) > 20 || Math.abs(l - r) > 20);
  assert.equal(disagree.contourViewsDisagree, true);
  assert.match(disagree.notes.join(" "), /set this contour evidence aside/);
});

test("multi-view consistency: no contour observations → says what is needed; lighting and face-size differences are flagged", () => {
  const empty = { ...realSession("REAL-010"), photoSamples: {} };
  assert.match(multiViewConsistency(empty).notes.join(" "), /No contour observations/);

  const dark = frontRecord();
  dark.meanBrightness = 20;
  const bright = frontRecord();
  bright.meanBrightness = 200;
  let s = realSession("REAL-011");
  s = withPhotoSample(s, "front", createPhotoCalibrationSample({ record: dark, gray: flatGray(), sourceDescription: "x", role: "front" }));
  s = withPhotoSample(s, "leftFortyFive", createPhotoCalibrationSample({ record: { ...bright, slot: "leftFortyFive" }, gray: flatGray(), sourceDescription: "x", role: "leftFortyFive" }));
  const c = multiViewConsistency(s);
  assert.equal(c.brightnessFlagged, true);
  assert.match(c.notes.join(" "), /Lighting differs/);
});

// ---- session summary ----

test("session summary: photos submitted/processed, quality counts, and one cautious line per recorded expectation", () => {
  const s = withVideoExpect("REAL-001", { forehead: "clearly", brow: "clearly", frown: "clearly" });
  const r = buildSessionReport(s);
  assert.deepEqual(r.photos, { submitted: 3, processed: 3, missingRequired: [] });
  assert.deepEqual(r.photoQuality, { usable: 3, borderline: 0, unusable: 0 });
  assert.deepEqual(r.totals, { matches: 2, potentialMisses: 1, potentialFalsePositives: 0, unclear: 0, notRecorded: 10 }); // 6 unrecorded expectations + 4 unrecorded quality rows
  assert.ok(r.lines.includes("Forehead lines: expected clearly present · detected — match"));
  assert.ok(r.lines.includes("Frown: expected clearly present · not detected — Potential miss"));
  assert.doesNotMatch(r.lines.join(" "), /accura|sensitiv|specific|error rate|ground truth/i);
});

test("session summary: missing required views are listed, and a partial session is still reported", () => {
  const s = { ...realSession("REAL-001"), photoSamples: { front: realSession().photoSamples.front } };
  const r = buildSessionReport(s);
  assert.deepEqual(r.photos.missingRequired, ["leftFortyFive", "rightFortyFive"]);
  assert.equal(r.photos.submitted, 1);
});

// ---- aggregate ----

test("aggregate: counts expected positives, detections, potential misses and false positives per domain — no rate on a tiny sample", () => {
  const sessions = [
    withVideoExpect("REAL-001", { brow: "clearly", frown: "clearly" }), // brow detected, frown miss
    withVideoExpect("REAL-002", { brow: "absent", frown: "absent" }), // brow FALSE POSITIVE, frown match
    withVideoExpect("REAL-003", { brow: "unclear", frown: "subtle" }),
  ];
  const agg = aggregateSessions(sessions);
  assert.equal(agg.label, "ENGINEERING CALIBRATION STATISTIC");
  assert.equal(agg.samplesEvaluated, 3);
  const brow = agg.domains.find((d) => d.domain === "expression.BROW_RAISE")!;
  assert.deepEqual([brow.samplesWithExpectation, brow.expectedPositive, brow.detectedPositive, brow.potentialMisses, brow.expectedAbsent, brow.potentialFalsePositives, brow.unclear], [3, 1, 1, 0, 1, 1, 1]);
  const frown = agg.domains.find((d) => d.domain === "expression.FROWN")!;
  assert.deepEqual([frown.expectedPositive, frown.detectedPositive, frown.potentialMisses, frown.expectedAbsent, frown.potentialFalsePositives, frown.unclear], [1, 0, 1, 1, 0, 1]);
  assert.equal(brow.detectionRate, null, "too few clearly-labelled samples for a rate");
  assert.equal(brow.falsePositiveRate, null);
  assert.ok(!agg.domains.some((d) => d.domain.startsWith("quality.")));
});

test("aggregate: a rate appears only once MIN_LABELLED_FOR_RATE evaluable, clearly-labelled samples exist", () => {
  assert.equal(MIN_LABELLED_FOR_RATE, 10);
  const nine = Array.from({ length: 9 }, (_, i) => withVideoExpect(`REAL-${100 + i}`, { brow: "clearly" }));
  assert.equal(aggregateSessions(nine).domains.find((d) => d.domain === "expression.BROW_RAISE")!.detectionRate, null);
  const ten = Array.from({ length: 10 }, (_, i) => withVideoExpect(`REAL-${200 + i}`, { brow: "clearly" }));
  assert.equal(aggregateSessions(ten).domains.find((d) => d.domain === "expression.BROW_RAISE")!.detectionRate, 1);

  const mixed = [...ten.slice(0, 8), ...Array.from({ length: 2 }, (_, i) => withVideoExpect(`REAL-${300 + i}`, { frown: "clearly" }))];
  const frownRate = aggregateSessions(mixed).domains.find((d) => d.domain === "expression.FROWN")!;
  assert.equal(frownRate.detectionRate, null, "only 2 frown-labelled samples");

  const absents = Array.from({ length: 10 }, (_, i) => withVideoExpect(`REAL-${400 + i}`, { brow: "absent" }));
  assert.equal(aggregateSessions(absents).domains.find((d) => d.domain === "expression.BROW_RAISE")!.falsePositiveRate, 1);
});

test("aggregate: samples that could not be evaluated do not count toward a rate", () => {
  const noVideo = Array.from({ length: 12 }, (_, i) => realSession(`REAL-${500 + i}`, { video: false, expectations: { ...emptyExpectations(), expression: { BROW_RAISE: "clearly", FROWN: null, SMILE: null, SQUINT: null } } }));
  const d = aggregateSessions(noVideo).domains.find((x) => x.domain === "expression.BROW_RAISE")!;
  assert.equal(d.expectedPositive, 12);
  assert.equal(d.detectionRate, null, "none of them were evaluable");
  assert.equal(d.unclear, 12);
});

test("the statistic is labelled as engineering calibration and explicitly not accuracy or clinical validation", () => {
  const agg = aggregateSessions([]);
  assert.equal(agg.label, STATISTIC_LABEL);
  assert.match(agg.disclaimer, /not accuracy, not sensitivity or specificity, and not clinical validation/);
  assert.equal(agg.samplesEvaluated, 0);
  assert.deepEqual(agg.domains, []);
});
