import { test } from "node:test";
import assert from "node:assert/strict";
import { COMPARISON_RESULTS, actualForDomain, compareQuality, comparePresence, compareSession, photoQualityActual, potentialWording, videoQualityActual, type Actual, type ActualState } from "../../lib/facial-analysis/calibration/comparison.ts";
import { collectRawPhotoMetrics, collectRawVideoMetrics } from "../../lib/facial-analysis/calibration/raw.ts";
import { photoThresholdDecisions } from "../../lib/facial-analysis/calibration/decisions.ts";
import { emptyExpectations, type PresenceLevel } from "../../lib/facial-analysis/calibration/expectations.ts";
import { withExpectations } from "../../lib/facial-analysis/calibration/session.ts";
import { analyzeVideoFrames } from "../../lib/facial-analysis/video/observe.ts";
import { META } from "../visual/fixtures.ts";
import { frontRecord } from "./fixtures.ts";
import { realSession } from "./sessionFixtures.ts";

const actual = (state: ActualState): Actual => ({ state, reason: "test reason", decisionIds: [] });
const row = (rows: ReturnType<typeof compareSession>, domain: string) => rows.find((r) => r.domain === domain)!;

// ---- the rule table, exhaustively ----

test("comparison rules: every (expected × actual) combination gives the documented result", () => {
  const table: Record<PresenceLevel, Record<ActualState, string>> = {
    clearly: { detected: "MATCH", not_detected: "MISS", withheld_borderline: "MISS", not_evaluated: "UNCLEAR" },
    subtle: { detected: "MATCH", not_detected: "UNCLEAR", withheld_borderline: "UNCLEAR", not_evaluated: "UNCLEAR" },
    absent: { detected: "FALSE_POSITIVE", not_detected: "MATCH", withheld_borderline: "MATCH", not_evaluated: "UNCLEAR" },
    unclear: { detected: "UNCLEAR", not_detected: "UNCLEAR", withheld_borderline: "UNCLEAR", not_evaluated: "UNCLEAR" },
  };
  for (const [expected, byActual] of Object.entries(table)) {
    for (const [state, result] of Object.entries(byActual)) {
      assert.equal(comparePresence(expected as PresenceLevel, actual(state as ActualState)).result, result, `${expected} × ${state}`);
    }
  }
  assert.equal(comparePresence(null, actual("detected")).result, "NOT_RECORDED");
  assert.deepEqual([...COMPARISON_RESULTS], ["MATCH", "MISS", "FALSE_POSITIVE", "UNCLEAR", "NOT_RECORDED"]);
});

test("notes use cautious wording: 'potential' miss / false positive, and say when a result was withheld as borderline", () => {
  assert.match(comparePresence("clearly", actual("not_detected")).note, /Potential miss/);
  assert.match(comparePresence("clearly", actual("withheld_borderline")).note, /withheld as borderline/);
  assert.match(comparePresence("absent", actual("detected")).note, /Potential false positive/);
  assert.match(comparePresence("subtle", actual("not_detected")).note, /not counted as a miss/);
  assert.match(comparePresence("clearly", actual("not_evaluated")).note, /Could not be evaluated: test reason/);
  assert.equal(potentialWording("MISS"), "Potential miss");
  assert.equal(potentialWording("FALSE_POSITIVE"), "Potential false positive");
  assert.equal(potentialWording("MATCH"), null);
});

// ---- against real decisions from the existing pipeline ----

test("MATCH: expected clearly visible forehead lines and the layer detected the pattern", () => {
  const rows = compareSession(realSession("REAL-001", { expectations: { ...emptyExpectations(), lines: { forehead: "clearly", glabellar: null, lateralEye: null } } }));
  const r = row(rows, "lines.forehead");
  assert.equal(r.actual.state, "detected");
  assert.equal(r.result, "MATCH");
  assert.deepEqual(r.actual.decisionIds, ["video.lineContrast.forehead.BROW_RAISE"]);
});

test("MISS: expected a clearly performed frown, but no frame was classified as a frown", () => {
  const r = row(compareSession(realSession("REAL-001", { expectations: { ...emptyExpectations(), expression: { BROW_RAISE: null, FROWN: "clearly", SMILE: null, SQUINT: null } } })), "expression.FROWN");
  assert.equal(r.actual.state, "not_detected");
  assert.equal(r.result, "MISS");
});

test("FALSE POSITIVE: expected no brow raise, but the layer observed one", () => {
  const r = row(compareSession(realSession("REAL-001", { expectations: { ...emptyExpectations(), expression: { BROW_RAISE: "absent", FROWN: null, SMILE: null, SQUINT: null } } })), "expression.BROW_RAISE");
  assert.equal(r.actual.state, "detected");
  assert.equal(r.result, "FALSE_POSITIVE");
});

test("UNCLEAR: an expectation the video could not evaluate (glabellar pattern without a frown), or one the labeller marked unclear", () => {
  const rows = compareSession(realSession("REAL-001", { expectations: { ...emptyExpectations(), lines: { forehead: "unclear", glabellar: "clearly", lateralEye: "clearly" } } }));
  assert.equal(row(rows, "lines.glabellar").actual.state, "not_evaluated");
  assert.equal(row(rows, "lines.glabellar").result, "UNCLEAR");
  assert.equal(row(rows, "lines.lateralEye").result, "UNCLEAR");
  assert.equal(row(rows, "lines.forehead").result, "UNCLEAR");
});

test("under-eye: clearly dark → detected; a borderline ratio is WITHHELD and shown as a potential miss with the borderline flag", () => {
  const dark = row(compareSession(realSession("REAL-001", { underEyeRatio: 0.7, expectations: { ...emptyExpectations(), underEye: "clearly" } })), "underEye");
  assert.deepEqual([dark.actual.state, dark.result, dark.borderline], ["detected", "MATCH", false]);

  const near = row(compareSession(realSession("REAL-001", { underEyeRatio: 0.84, expectations: { ...emptyExpectations(), underEye: "clearly" } })), "underEye");
  assert.deepEqual([near.actual.state, near.result, near.borderline], ["withheld_borderline", "MISS", true]);
  assert.match(near.note, /withheld as borderline/);

  const notDark = row(compareSession(realSession("REAL-001", { underEyeRatio: 0.95, expectations: { ...emptyExpectations(), underEye: "subtle" } })), "underEye");
  assert.deepEqual([notDark.actual.state, notDark.result], ["not_detected", "UNCLEAR"]);

  const fp = row(compareSession(realSession("REAL-001", { underEyeRatio: 0.7, expectations: { ...emptyExpectations(), underEye: "absent" } })), "underEye");
  assert.equal(fp.result, "FALSE_POSITIVE");
});

test("contour has no detection threshold: any expectation is UNCLEAR, with an explanation — it is never called a match or a false positive", () => {
  for (const expected of ["clearly", "subtle", "absent"] as const) {
    const r = row(compareSession(realSession("REAL-001", { expectations: { ...emptyExpectations(), contour: expected } })), "contour");
    assert.equal(r.result, "UNCLEAR", expected);
    assert.match(r.actual.reason, /no detection threshold/);
  }
});

test("no video / no front photo → not evaluated, never a guess", () => {
  const s = realSession("REAL-001", { video: false, expectations: { ...emptyExpectations(), expression: { BROW_RAISE: "clearly", FROWN: null, SMILE: null, SQUINT: null } } });
  assert.match(actualForDomain(s, "expression.BROW_RAISE").reason, /No video was supplied/);
  assert.equal(row(compareSession(s), "expression.BROW_RAISE").result, "UNCLEAR");
  const noFront = { ...s, photoSamples: { ...s.photoSamples, front: undefined } };
  assert.match(actualForDomain(noFront, "underEye").reason, /No front photo/);
});

test("rows are produced only for recorded expectations (others are NOT_RECORDED) and quality rows only for supplied views", () => {
  const rows = compareSession(realSession("REAL-001"));
  assert.ok(rows.filter((r) => !r.domain.startsWith("quality.")).every((r) => r.result === "NOT_RECORDED"));
  assert.deepEqual(rows.filter((r) => r.domain.startsWith("quality.")).map((r) => r.domain).sort(), ["quality.front", "quality.leftFortyFive", "quality.rightFortyFive", "quality.video"]);
});

// ---- quality ----

test("input quality: actual usability comes from detection, the quality result and failed gates", () => {
  const good = frontRecord();
  assert.equal(photoQualityActual(collectRawPhotoMetrics(good, null), photoThresholdDecisions(collectRawPhotoMetrics(good, null), "front")), "usable");

  const noFace = frontRecord();
  noFace.faceCount = 0;
  noFace.landmarks = null;
  assert.equal(photoQualityActual(collectRawPhotoMetrics(noFace, null), []), "unusable");

  const dark = frontRecord();
  dark.meanBrightness = 20;
  const rawDark = collectRawPhotoMetrics(dark, null);
  assert.equal(photoQualityActual(rawDark, photoThresholdDecisions(rawDark, "front")), "borderline");

  const warned = frontRecord();
  warned.quality = { valid: true, errors: [], warnings: ["Face is small in the frame."], qualityScore: 92 };
  assert.equal(photoQualityActual(collectRawPhotoMetrics(warned, null), []), "borderline");

  assert.equal(videoQualityActual(collectRawVideoMetrics(analyzeVideoFrames(META, []))), "unusable");
});

test("quality comparison: same → MATCH; bad input accepted → potential false positive; good input rejected → potential miss; else UNCLEAR", () => {
  assert.equal(compareQuality("usable", "usable").result, "MATCH");
  assert.equal(compareQuality("unusable", "usable").result, "FALSE_POSITIVE");
  assert.equal(compareQuality("usable", "unusable").result, "MISS");
  assert.equal(compareQuality("borderline", "usable").result, "UNCLEAR");
  assert.equal(compareQuality("usable", "borderline").result, "UNCLEAR");
  assert.equal(compareQuality(null, "usable").result, "NOT_RECORDED");
});

test("a session's quality rows compare the recorded input label with what the layer judged", () => {
  const s = withExpectations(realSession("REAL-001"), { ...emptyExpectations(), quality: { front: "unusable", leftFortyFive: "usable" } });
  const rows = compareSession(s);
  assert.equal(row(rows, "quality.front").result, "FALSE_POSITIVE");
  assert.equal(row(rows, "quality.leftFortyFive").result, "MATCH");
  assert.equal(row(rows, "quality.rightFortyFive").result, "NOT_RECORDED");
});
