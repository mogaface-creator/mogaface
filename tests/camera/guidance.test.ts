import { test } from "node:test";
import assert from "node:assert/strict";
import { LANDMARK } from "../../lib/facial-analysis/landmarkMapping.ts";
import { TURNED_SPAN_RATIO } from "../../lib/facial-analysis/contour.ts";
import { MAX_BRIGHTNESS, MAX_ROLL_DEGREES, MAX_YAW_RATIO, MIN_BRIGHTNESS } from "../../lib/facial-analysis/quality.ts";
import {
  CENTER_TOLERANCE_X, DEFAULT_STABILITY_MS, INITIAL_STABILITY, MESSAGES, STILLNESS_TOLERANCE, VIEW_TARGET, evaluateGuidance, faceCenter, profileIsManual, stepStability,
  type GuidanceInput,
} from "../../lib/camera-capture/guidance.ts";
import { GUIDANCE_STATES } from "../../lib/camera-capture/types.ts";
import { buildSymmetricFace } from "../facial-analysis/fixtures.ts";
import type { LandmarkList } from "../../lib/facial-analysis/types.ts";

const shift = (lm: LandmarkList, dx: number, dy: number) => lm.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy }));
const scale = (lm: LandmarkList, f: number) => lm.map((p) => ({ ...p, x: 0.5 + (p.x - 0.5) * f, y: 0.5 + (p.y - 0.5) * f }));
const input = (over: Partial<GuidanceInput> = {}): GuidanceInput => ({ faceCount: 1, landmarks: buildSymmetricFace(), frameWidth: 640, frameHeight: 480, meanBrightness: 120, target: "front", mirrored: true, ...over });
const g = (over: Partial<GuidanceInput> = {}) => evaluateGuidance(input(over));
const nose = (x: number) => { const lm = buildSymmetricFace(); lm[LANDMARK.noseTip] = { x, y: 0.55, z: 0 }; return lm; };

// ---- states ----

test("no face and multiple faces", () => {
  assert.equal(g({ faceCount: 0, landmarks: null }).state, "NO_FACE");
  assert.equal(g({ faceCount: 1, landmarks: null }).state, "NO_FACE");
  assert.equal(g({ faceCount: 2, landmarks: null }).state, "MULTIPLE_FACES");
  assert.equal(g({ faceCount: 0, landmarks: null }).frameOk, false);
});

test("light: too dark and too bright use the existing brightness limits", () => {
  assert.equal(g({ meanBrightness: MIN_BRIGHTNESS - 1 }).state, "LIGHT_TOO_DARK");
  assert.equal(g({ meanBrightness: MAX_BRIGHTNESS + 1 }).state, "LIGHT_TOO_BRIGHT");
  assert.equal(g({ meanBrightness: MIN_BRIGHTNESS }).state, "HOLD_STILL");
  assert.equal(g({ meanBrightness: undefined }).state, "HOLD_STILL", "brightness is optional");
  assert.equal(g({ meanBrightness: 10 }).message, "Find a brighter spot");
});

test("size: too far when the face is small in frame; too close when it fills the frame", () => {
  const far = g({ landmarks: scale(buildSymmetricFace(), 0.4) });
  assert.deepEqual([far.state, far.message], ["TOO_FAR", "Move closer"]);
  const close = g({ landmarks: scale(buildSymmetricFace(), 2) });
  assert.deepEqual([close.state, close.message], ["TOO_CLOSE", "Move back a little"]);
});

test("position: movement cues are in what the person SEES, so a mirrored preview flips left/right", () => {
  const faceOnVideoRight = shift(buildSymmetricFace(), 0.2, 0); // centre x = 0.7 in the video frame
  assert.equal(g({ landmarks: faceOnVideoRight, mirrored: true }).state, "MOVE_RIGHT"); // mirrored → appears on the LEFT of the screen → move right
  assert.equal(g({ landmarks: faceOnVideoRight, mirrored: false }).state, "MOVE_LEFT");
  const faceOnVideoLeft = shift(buildSymmetricFace(), -0.2, 0);
  assert.equal(g({ landmarks: faceOnVideoLeft, mirrored: true }).state, "MOVE_LEFT");
  assert.equal(g({ landmarks: faceOnVideoLeft, mirrored: false }).state, "MOVE_RIGHT");
  assert.equal(g({ landmarks: shift(buildSymmetricFace(), 0, -0.2) }).state, "MOVE_DOWN"); // face too high
  assert.equal(g({ landmarks: shift(buildSymmetricFace(), 0, 0.2) }).state, "MOVE_UP");
  assert.equal(g({ landmarks: shift(buildSymmetricFace(), CENTER_TOLERANCE_X - 0.02, 0) }).state, "HOLD_STILL", "within tolerance counts as centred");
});

test("edge cut-off (existing rule) is turned into a movement cue, not a number", () => {
  const cutAtVideoLeft = shift(buildSymmetricFace(), -0.26, 0); // minX < 0
  assert.equal(g({ landmarks: cutAtVideoLeft, mirrored: false }).state, "MOVE_RIGHT");
  assert.equal(g({ landmarks: cutAtVideoLeft, mirrored: true }).state, "MOVE_LEFT");
  assert.equal(g({ landmarks: shift(buildSymmetricFace(), 0, -0.2 - 0.0).map((p) => ({ ...p, y: p.y - 0.1 })) }).state, "MOVE_DOWN");
});

test("front view: a level, frontal, centred face is good; a tilted or turned head is not", () => {
  const ok = g();
  assert.deepEqual([ok.state, ok.frameOk, ok.message], ["HOLD_STILL", true, "Perfect — hold still"]);

  const tilted = buildSymmetricFace();
  tilted[LANDMARK.leftEyeOuter] = { x: 0.68, y: 0.4 + 0.36 * Math.tan(((MAX_ROLL_DEGREES + 6) * Math.PI) / 180), z: 0 };
  assert.deepEqual([g({ landmarks: tilted }).state, g({ landmarks: tilted }).message], ["HEAD_TOO_TILTED", "Keep your head level"]);

  const turned = g({ landmarks: nose(0.35) });
  assert.equal(turned.state, "TURN_LEFT", "left cheek toward the camera → turn back to your left");
  assert.equal(turned.message, "Look straight ahead");
  assert.equal(g({ landmarks: nose(0.65) }).state, "TURN_RIGHT");
  assert.ok(MAX_YAW_RATIO > 1);
});

test("45° views reuse the existing turned-enough rule and near-side contract (left 45° = LEFT side toward the camera)", () => {
  assert.deepEqual(VIEW_TARGET.leftFortyFive, { nearSide: "left", headTurn: "RIGHT" });
  assert.deepEqual(VIEW_TARGET.rightFortyFive, { nearSide: "right", headTurn: "LEFT" });
  assert.ok(TURNED_SPAN_RATIO === 1.25);

  const straight = g({ target: "leftFortyFive" });
  assert.deepEqual([straight.state, straight.message, straight.frameOk], ["TURN_RIGHT", "Turn slightly to your right", false]);

  const leaning = g({ target: "leftFortyFive", landmarks: nose(0.49) }); // leaning the right way, but not turned enough yet
  assert.equal(leaning.message, "Turn a little more to your right");

  const good = g({ target: "leftFortyFive", landmarks: nose(0.35) });
  assert.deepEqual([good.state, good.frameOk], ["HOLD_STILL", true]);

  const wrongWay = g({ target: "leftFortyFive", landmarks: nose(0.65) });
  assert.deepEqual([wrongWay.state, wrongWay.frameOk], ["TURN_RIGHT", false]);
  assert.match(wrongWay.message, /Turn the other way/);
});

test("right 45° is the mirror image, and a face turned too far is asked to turn back", () => {
  assert.equal(g({ target: "rightFortyFive", landmarks: nose(0.65) }).frameOk, true);
  assert.equal(g({ target: "rightFortyFive", landmarks: nose(0.35) }).state, "TURN_LEFT");
  assert.equal(g({ target: "rightFortyFive" }).message, "Turn slightly to your left");

  const tooFar = nose(0.35); // left view, but the far (right) eye has collapsed → existing validateThreeQuarter says implausible
  tooFar[LANDMARK.rightEyeOuter] = { x: 0.449, y: 0.4, z: 0 };
  const r = g({ target: "leftFortyFive", landmarks: tooFar });
  assert.deepEqual([r.state, r.frameOk], ["TURN_LEFT", false]);
  assert.match(r.message, /Turn back a little/);
});

test("profiles are never auto-approved: no defensible live rule exists, so they are manual", () => {
  for (const target of ["leftProfile", "rightProfile"] as const) {
    const r = g({ target, landmarks: nose(0.35) });
    assert.equal(r.frameOk, false);
    assert.match(r.message, /tap Capture/);
    assert.equal(profileIsManual(target), true);
  }
  assert.equal(profileIsManual("front"), false);
  assert.equal(profileIsManual("leftFortyFive"), false);
});

test("guidance never approves a frame the existing quality gate rejects", () => {
  // A face that passes every guidance check but is below the hard minimum size is impossible to reach: TOO_FAR comes first.
  assert.equal(g({ landmarks: scale(buildSymmetricFace(), 0.25) }).frameOk, false);
});

test("messages are plain language: no numbers, no jargon, no threshold names", () => {
  const all = Object.values(MESSAGES).join(" | ");
  assert.doesNotMatch(all, /\d/);
  assert.doesNotMatch(all, /yaw|roll|landmark|threshold|mediapipe|ratio|pixel|score/i);
  const dynamic = [g({ target: "leftFortyFive" }), g({ target: "rightFortyFive", landmarks: nose(0.35) }), g({ target: "leftFortyFive", landmarks: nose(0.49) })].map((r) => r.message).join(" ");
  assert.doesNotMatch(dynamic, /\d|yaw|roll|landmark/i);
});

test("every guidance state the brief lists exists", () => {
  for (const s of ["NO_FACE", "TOO_FAR", "TOO_CLOSE", "MOVE_LEFT", "MOVE_RIGHT", "MOVE_UP", "MOVE_DOWN", "TURN_LEFT", "TURN_RIGHT", "HEAD_TOO_TILTED", "LIGHT_TOO_DARK", "LIGHT_TOO_BRIGHT", "HOLD_STILL", "GOOD_TO_CAPTURE", "PROCESSING", "CAPTURED"]) {
    assert.ok((GUIDANCE_STATES as readonly string[]).includes(s), s);
  }
});

// ---- stability timer ----

const c0 = { x: 0.5, y: 0.5 };
const run = (samples: { ok: boolean; x?: number; t: number }[], opts?: { requiredMs: number; stillnessTolerance: number }) => {
  let state = INITIAL_STABILITY;
  return samples.map((s) => {
    const step = stepStability(state, { ok: s.ok, center: { x: s.x ?? c0.x, y: c0.y }, timeMs: s.t }, opts);
    state = step.state;
    return step;
  });
};

test("stability: a single passing frame can never trigger a capture", () => {
  const [first] = run([{ ok: true, t: 0 }]);
  assert.equal(first.stable, false);
  assert.equal(first.progress, 0);
});

test("stability: capture only after a CONTINUOUS good run of the required time", () => {
  const steps = run([0, 200, 400, 600, 799, 800].map((t) => ({ ok: true, t })));
  assert.deepEqual(steps.map((s) => s.stable), [false, false, false, false, false, true]);
  assert.ok(steps[3].progress > 0.5 && steps[3].progress < 1);
  assert.equal(steps[5].progress, 1);
  assert.equal(DEFAULT_STABILITY_MS, 800);
});

test("stability: one bad frame restarts the hold (no accumulating across gaps)", () => {
  const steps = run([{ ok: true, t: 0 }, { ok: true, t: 500 }, { ok: false, t: 600 }, { ok: true, t: 700 }, { ok: true, t: 1300 }, { ok: true, t: 1500 }]);
  assert.equal(steps[1].stable, false);
  assert.equal(steps[2].progress, 0);
  assert.equal(steps[4].stable, false, "only 600ms since the restart at 700");
  assert.equal(steps[5].stable, true, "800ms since the restart");
});

test("stability: moving the face more than the stillness tolerance restarts the hold; small drift does not", () => {
  const moved = run([{ ok: true, t: 0 }, { ok: true, t: 500 }, { ok: true, t: 900, x: 0.5 + STILLNESS_TOLERANCE + 0.05 }, { ok: true, t: 1300, x: 0.5 + STILLNESS_TOLERANCE + 0.05 }]);
  assert.equal(moved[2].stable, false, "the jump restarts the run at t=900");
  assert.equal(moved[3].stable, false);
  const drift = run([{ ok: true, t: 0 }, { ok: true, t: 400, x: 0.51 }, { ok: true, t: 800, x: 0.52 }]);
  assert.equal(drift[2].stable, true);
});

test("stability: the required time is configurable, and no centre means not ok", () => {
  const quick = run([{ ok: true, t: 0 }, { ok: true, t: 300 }], { requiredMs: 300, stillnessTolerance: 0.04 });
  assert.equal(quick[1].stable, true);
  const slow = run([{ ok: true, t: 0 }, { ok: true, t: 900 }], { requiredMs: 1000, stillnessTolerance: 0.04 });
  assert.equal(slow[1].stable, false);
  assert.equal(stepStability(INITIAL_STABILITY, { ok: true, center: null, timeMs: 0 }).progress, 0);
  assert.deepEqual(faceCenter(buildSymmetricFace()), { x: 0.5, y: 0.5 });
  assert.equal(faceCenter(null), null);
});
