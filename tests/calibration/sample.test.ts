import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseCalibrationExport,
  serializeCalibrationSamples,
  validateCalibrationSample,
  withEvaluatorNote,
  withoutEvaluatorNote,
} from "../../lib/facial-analysis/calibration/sample.ts";
import { CALIBRATION_VERSION } from "../../lib/facial-analysis/calibration/status.ts";
import { EVALUATOR_LABELS } from "../../lib/facial-analysis/calibration/types.ts";
import { photoSample, videoSample } from "./fixtures.ts";

const problems = (v: unknown) => validateCalibrationSample(v).join(" | ");

test("calibration sample creation: a photo sample carries every required part", () => {
  const s = photoSample();
  assert.equal(s.sourceType, "photo");
  assert.equal(s.photoRole, "front");
  assert.equal(s.videoState, null);
  assert.equal(s.calibrationVersion, CALIBRATION_VERSION);
  assert.ok(s.sampleId.length > 0 && !Number.isNaN(Date.parse(s.createdAt)));
  assert.equal(s.rawMetrics.kind, "photo");
  assert.ok(s.thresholdDecisions.length > 0);
  assert.ok(s.generatedObservations.some((o) => o.id === "eyeArea.visibleUnderEyeDarkness"));
  assert.deepEqual(s.evaluatorNotes, []);
  assert.deepEqual(validateCalibrationSample(s), []);
});

test("calibration sample creation: a video sample carries raw frames, decisions and observations", () => {
  const s = videoSample();
  assert.equal(s.sourceType, "video");
  assert.equal(s.photoRole, null);
  assert.equal(s.videoState, "BROW_RAISE");
  assert.equal(s.rawMetrics.kind, "video");
  if (s.rawMetrics.kind !== "video") return;
  assert.equal(s.rawMetrics.framesSampled, 5);
  assert.equal(s.rawMetrics.frames.length, 5);
  assert.deepEqual(s.rawMetrics.neutralFrameCandidates, [0, 1, 2]);
  assert.deepEqual(s.rawMetrics.stateCandidates.BROW_RAISE.frameIndices, [3, 4]);
  assert.ok(s.generatedObservations.some((o) => o.id === "expression.visibleForeheadLinePattern"));
  assert.deepEqual(validateCalibrationSample(s), []);
});

test("raw values are exposed, not hidden behind low/moderate/high (frames carry timestamps, quality, movement and features)", () => {
  const s = videoSample();
  if (s.rawMetrics.kind !== "video") throw new Error("expected video");
  const f = s.rawMetrics.frames[3];
  assert.equal(typeof f.timeSec, "number");
  assert.equal(typeof f.qualityScore, "number");
  assert.ok(f.movementPct && Number.isFinite(f.movementPct.BROW_RAISE));
  assert.ok(f.features && Number.isFinite(f.features.browToEye));
  assert.ok(s.rawMetrics.stateCandidates.BROW_RAISE.bestMovementPct! > 20);
  assert.equal(s.rawMetrics.baseline?.stable, true);
  assert.equal(typeof s.rawMetrics.baseline?.maxSpread, "number");
});

test("photo raw metrics: detection, quality, roll, yaw, bounding box, landmarks, measurements, contour, under-eye", () => {
  const s = photoSample();
  if (s.rawMetrics.kind !== "photo") throw new Error("expected photo");
  const r = s.rawMetrics;
  assert.equal(r.detectionStatus, "detected");
  assert.equal(typeof r.qualityScore, "number");
  assert.ok(Math.abs(r.rollDegrees!) < 1e-9, "level face has ~0° roll");
  assert.ok(r.yawRatio! >= 1);
  assert.ok(r.faceBoundingBox!.maxX > r.faceBoundingBox!.minX);
  assert.equal(r.landmarkCount, 478);
  assert.ok(r.measurements && r.contour && r.underEye);
  assert.ok(r.staticLineContrast && r.staticLineContrast.forehead !== undefined);
});

test("missing raw metrics are reported by validation", () => {
  const s = photoSample();
  const stripped = { ...s, rawMetrics: { kind: "photo", faceCount: 1 } };
  const p = problems(stripped);
  assert.match(p, /rawMetrics is missing "detectionStatus"/);
  assert.match(p, /rawMetrics is missing "underEye"/);
  assert.match(problems({ ...s, rawMetrics: undefined }), /rawMetrics is missing/);
  assert.match(problems({ ...s, rawMetrics: { ...s.rawMetrics, kind: "video" } }), /does not match sourceType/);
});

test("evaluator labels: all five are valid; an invalid label is rejected", () => {
  assert.deepEqual([...EVALUATOR_LABELS], ["true_positive", "false_positive", "true_negative", "false_negative", "unclear"]);
  const s = photoSample();
  const target = s.thresholdDecisions.find((d) => d.gates)!.id;
  for (const label of EVALUATOR_LABELS) assert.deepEqual(validateCalibrationSample(withEvaluatorNote(s, { target, label, note: "looks right" })), []);
  const bad = withEvaluatorNote(s, { target, label: "clinically_true" as never, note: "" });
  assert.match(problems(bad), /not a valid evaluator label/);
});

test("evaluator notes must point at a real decision or observation, and one target keeps one note", () => {
  const s = photoSample();
  assert.match(problems(withEvaluatorNote(s, { target: "nothing.here", label: "unclear", note: "" })), /matches no decision or observation/);
  const twice = withEvaluatorNote(withEvaluatorNote(s, { target: "eyeArea.visibleUnderEyeDarkness", label: "false_positive", note: "a" }), { target: "eyeArea.visibleUnderEyeDarkness", label: "true_positive", note: "b" });
  assert.equal(twice.evaluatorNotes.length, 1);
  assert.equal(twice.evaluatorNotes[0].label, "true_positive");
  assert.equal(withoutEvaluatorNote(twice, "eyeArea.visibleUnderEyeDarkness").evaluatorNotes.length, 0);
});

test("record validation: bad source type, role, video state, ids and dates", () => {
  const s = photoSample();
  assert.match(problems({ ...s, sourceType: "audio" }), /not photo or video/);
  assert.match(problems({ ...s, photoRole: "top" }), /valid photoRole/);
  assert.match(problems({ ...s, videoState: "GRIN" }), /valid expression state/);
  assert.match(problems({ ...s, videoState: "SMILE" }), /photo sample must have videoState null/);
  assert.match(problems({ ...s, sampleId: "" }), /sampleId/);
  assert.match(problems({ ...s, createdAt: "yesterday" }), /createdAt/);
  assert.match(problems({ ...videoSample(), photoRole: "front" }), /video sample must have photoRole null/);
});

test("record validation: a generated observation without provenance or with a NaN value is flagged", () => {
  const s = photoSample();
  const noSource = { ...s, generatedObservations: [{ ...s.generatedObservations[0], source: "" }] };
  assert.match(problems(noSource), /source/);
  const nan = { ...s, generatedObservations: [{ ...s.generatedObservations[0], value: Number.NaN }] };
  assert.match(problems(nan), /non-finite/);
});

test("malformed input never throws", () => {
  for (const v of [null, undefined, 3, "x", [], {}]) {
    assert.doesNotThrow(() => validateCalibrationSample(v));
    assert.ok(validateCalibrationSample(v).length > 0);
  }
});

test("calibration versioning: samples and exports carry the version; a mismatched export is reported", () => {
  const text = serializeCalibrationSamples([photoSample()]);
  assert.equal(JSON.parse(text).calibrationVersion, CALIBRATION_VERSION);
  const old = JSON.stringify({ ...JSON.parse(text), calibrationVersion: "0.0.1" });
  assert.match(parseCalibrationExport(old).problems.join(), /calibrationVersion "0.0.1"/);
  assert.match(problems({ ...photoSample(), calibrationVersion: "" }), /calibrationVersion/);
});

test("serialization → deserialization round-trips valid samples (including labels) and contains no media bytes", () => {
  const labelled = withEvaluatorNote(photoSample(), { target: "eyeArea.visibleUnderEyeDarkness", label: "true_positive", note: "visibly darker to my eye" });
  const text = serializeCalibrationSamples([labelled, videoSample()]);
  assert.ok(!/data:image|data:video|base64/.test(text), "no embedded media");
  assert.ok(text.length < 200_000, "records are small (numbers + text)");
  const { samples, problems: p } = parseCalibrationExport(text);
  assert.deepEqual(p, []);
  assert.equal(samples.length, 2);
  assert.equal(samples[0].evaluatorNotes[0].label, "true_positive");
  assert.deepEqual(samples[0].rawMetrics, labelled.rawMetrics);
});

test("parsing: non-finite numbers export as null, invalid samples are dropped and reported, garbage never throws", () => {
  const s = photoSample();
  if (s.rawMetrics.kind === "photo") s.rawMetrics.yawRatio = Number.POSITIVE_INFINITY;
  const round = parseCalibrationExport(serializeCalibrationSamples([s]));
  assert.equal(round.samples.length, 1);
  assert.ok(round.samples[0].rawMetrics.kind === "photo" && round.samples[0].rawMetrics.yawRatio === null);

  const broken = JSON.stringify({ calibrationVersion: CALIBRATION_VERSION, samples: [{ nope: true }, JSON.parse(serializeCalibrationSamples([photoSample()])).samples[0]] });
  const r = parseCalibrationExport(broken);
  assert.equal(r.samples.length, 1);
  assert.match(r.problems.join(), /sample 0/);
  assert.deepEqual(parseCalibrationExport("not json").samples, []);
  assert.deepEqual(parseCalibrationExport("{}").samples, []);
});
