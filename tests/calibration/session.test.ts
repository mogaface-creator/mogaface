import { test } from "node:test";
import assert from "node:assert/strict";
import { PRESENCE_LEVELS, QUALITY_LABELS, PRESENCE_WORDING, emptyExpectations, validateExpectations } from "../../lib/facial-analysis/calibration/expectations.ts";
import {
  AGE_BANDS, MAX_NOTES_LENGTH, PHOTO_VIEWS, baselineCoverage, createSession, defaultMetadata, validateMetadata, validateSession, validateSessionId,
  withNotes, withPhotoSample,
} from "../../lib/facial-analysis/calibration/session.ts";
import { CALIBRATION_VERSION } from "../../lib/facial-analysis/calibration/status.ts";
import { realSession, slotSample } from "./sessionFixtures.ts";

const problems = (v: unknown) => validateSession(v).join(" | ");

test("session id: anonymous ids are accepted; names, emails, phone numbers and dates are refused", () => {
  for (const ok of ["REAL-001", "REAL-042", "sample_7", "R1"]) assert.deepEqual(validateSessionId(ok), [], ok);
  assert.ok(validateSessionId("").length > 0);
  assert.ok(validateSessionId(undefined).length > 0);
  assert.match(validateSessionId("jane@example.com").join(), /only letters|email/);
  assert.match(validateSessionId("0412345678901").join(), /long number/);
  assert.match(validateSessionId("1990-05-17-0000").join(), /long number/);
  assert.match(validateSessionId("Jane Smith").join(), /only letters/);
  assert.match(validateSessionId("x".repeat(40)).join(), /max 32/);
  assert.throws(() => createSession("bob@x.io"));
});

test("session creation: engineering metadata defaults to 'not recorded'/'unknown' and carries the calibration version", () => {
  const s = createSession("REAL-001");
  assert.deepEqual(s.metadata, defaultMetadata());
  assert.equal(s.metadata.ageBand, "not_recorded");
  assert.equal(s.calibrationVersion, CALIBRATION_VERSION);
  assert.deepEqual(s.photoSamples, {});
  assert.equal(s.videoSample, null);
  assert.deepEqual(validateSession(s), []);
});

test("metadata: only the five engineering fields are allowed, with fixed values; nothing identifying can ride along", () => {
  assert.deepEqual([...AGE_BANDS], ["not_recorded", "18-29", "30-39", "40-49", "50+"]);
  assert.deepEqual(validateMetadata({ ageBand: "30-39", lighting: "indoor", camera: "front", glasses: "yes", makeup: "no" }), []);
  assert.match(validateMetadata({ ...defaultMetadata(), ageBand: "31" }).join(), /ageBand/);
  assert.match(validateMetadata({ ...defaultMetadata(), lighting: "studio" }).join(), /lighting/);
  assert.match(validateMetadata({ ...defaultMetadata(), name: "Jane" }).join(), /"name" is not allowed/);
  assert.match(validateMetadata({ ...defaultMetadata(), email: "a@b.c", phone: "1", dateOfBirth: "x", ethnicity: "x" }).join(), /"email" is not allowed/);
  assert.ok(validateMetadata(null).length > 0);
});

test("a session has no field that can hold media or identity: extra fields are rejected", () => {
  const s = realSession();
  for (const key of ["file", "blob", "imageUrl", "name", "email", "photo"]) assert.match(problems({ ...s, [key]: "x" }), new RegExp(`session field "${key}" is not allowed`));
  assert.deepEqual(validateSession(s), []);
});

test("expected labels: the four presence levels and three quality labels; unknown values and diagnostic fields are rejected", () => {
  assert.deepEqual([...PRESENCE_LEVELS], ["clearly", "subtle", "absent", "unclear"]);
  assert.deepEqual([...QUALITY_LABELS], ["usable", "borderline", "unusable"]);
  assert.deepEqual(validateExpectations(emptyExpectations()), []);
  const good = { ...emptyExpectations(), contour: "subtle", underEye: "clearly", lines: { forehead: "clearly", glabellar: "absent", lateralEye: "unclear" }, quality: { front: "usable", video: "borderline" } };
  assert.deepEqual(validateExpectations(good), []);
  assert.match(validateExpectations({ ...emptyExpectations(), underEye: "tear trough" }).join(), /underEye/);
  assert.match(validateExpectations({ ...emptyExpectations(), contour: "definitely" }).join(), /contour/);
  assert.match(validateExpectations({ ...emptyExpectations(), quality: { front: "great" } }).join(), /quality.front/);
  assert.match(validateExpectations({ ...emptyExpectations(), quality: { chin: "usable" } }).join(), /not a photo view/);
  assert.match(validateExpectations({ ...emptyExpectations(), diagnosis: "melasma" }).join(), /diagnostic labels are not allowed/);
  assert.ok(validateExpectations(null).length > 0);
});

test("labels are worded as engineering expectations for each domain, and never as diagnoses", () => {
  assert.equal(PRESENCE_WORDING.lines.clearly, "clearly visible");
  assert.equal(PRESENCE_WORDING.lines.subtle, "somewhat visible");
  assert.equal(PRESENCE_WORDING.underEye.clearly, "dark-looking appearance clearly visible");
  assert.equal(PRESENCE_WORDING.expression.clearly, "clearly present");
  const all = JSON.stringify(PRESENCE_WORDING).toLowerCase();
  for (const w of ["tear trough", "pigment", "puffiness", "medical", "diagnos", "ground truth"]) assert.ok(!all.includes(w), w);
});

test("photo views: front, left 45° and right 45° are required for a baseline; profiles and video are optional", () => {
  assert.deepEqual(PHOTO_VIEWS.filter((v) => v.required).map((v) => v.slot), ["front", "leftFortyFive", "rightFortyFive"]);
  assert.deepEqual(PHOTO_VIEWS.filter((v) => !v.required).map((v) => v.slot), ["leftProfile", "rightProfile"]);
  let s = createSession("REAL-002");
  assert.deepEqual(baselineCoverage(s).missingRequired, ["front", "leftFortyFive", "rightFortyFive"]);
  s = withPhotoSample(s, "front", slotSample("front"));
  assert.deepEqual(baselineCoverage(s).missingRequired, ["leftFortyFive", "rightFortyFive"]);
  assert.deepEqual(validateSession(s), [], "a partial session is valid: not every view is required");
});

test("session validation: a sample stored under the wrong slot, a non-video video sample, oversized notes and malformed input", () => {
  const s = realSession();
  assert.match(problems({ ...s, photoSamples: { front: s.photoSamples.leftFortyFive } }), /role does not match its slot/);
  assert.match(problems({ ...s, videoSample: s.photoSamples.front }), /must be a video sample/);
  assert.match(problems({ ...s, notes: "x".repeat(MAX_NOTES_LENGTH + 1) }), /limited to/);
  assert.equal(withNotes(s, "x".repeat(MAX_NOTES_LENGTH + 50)).notes.length, MAX_NOTES_LENGTH);
  assert.match(problems({ ...s, photoSamples: { chin: s.photoSamples.front } }), /not a photo view/);
  for (const v of [null, undefined, 3, "x", []]) { assert.doesNotThrow(() => validateSession(v)); assert.ok(validateSession(v).length > 0); }
  assert.deepEqual(validateSession(s), []);
});
