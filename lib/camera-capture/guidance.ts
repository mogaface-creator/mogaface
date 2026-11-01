/**
 * Live guidance: turns one analysed camera frame into a single, plain-language
 * instruction, and decides when the person has held a good position long
 * enough to capture.
 *
 * Nothing here measures a face. Every judgement reuses the EXISTING rules:
 *   - brightness gates, minimum face size, edge cut-off, roll and yaw limits (quality.ts)
 *   - "turned enough" and near side for angled views (contour.ts)
 *   - 45° plausibility (multiPhoto/viewValidation.ts)
 * The only constants defined here are FRAMING aids for the on-screen guide
 * (how centred is centred, how still is still). They never affect analysis,
 * and no number is ever shown to the user.
 *
 * View convention (existing contract, see viewValidation.ts): "left 45°" is a
 * photo in which the LEFT side of the face is toward the camera, i.e. the head
 * is turned to the person's RIGHT. The on-screen wording is body-relative and
 * says so explicitly, and this mapping lives in one place (VIEW_TARGET).
 */

import { boundingBox } from "../facial-analysis/geometry.ts";
import { LANDMARK } from "../facial-analysis/landmarkMapping.ts";
import { TURNED_SPAN_RATIO, nearSideOf, type FaceSide } from "../facial-analysis/contour.ts";
import { validateThreeQuarter } from "../facial-analysis/multiPhoto/viewValidation.ts";
import type { PhotoSlot } from "../facial-analysis/multiPhoto/types.ts";
import {
  EDGE_MARGIN,
  MAX_BRIGHTNESS,
  MAX_ROLL_DEGREES,
  MAX_YAW_RATIO,
  MIN_BRIGHTNESS,
  MIN_FACE_WIDTH_WARNING,
  checkPhotoQuality,
  estimateRollDegrees,
  estimateYawRatio,
} from "../facial-analysis/quality.ts";
import type { LandmarkList } from "../facial-analysis/types.ts";
import type { GuidanceResult, GuidanceState } from "./types.ts";

/** Framing aids only: how far from the middle of the frame still counts as centred. */
export const CENTER_TOLERANCE_X = 0.08;
export const CENTER_TOLERANCE_Y = 0.1;
/** The face (hairline-to-chin box) must fill this share of the frame height, i.e. sit inside the on-screen oval. */
export const FACE_HEIGHT_RANGE = { min: 0.4, max: 0.82 };
/** Tighter than the analysis rules on purpose: the live guide asks for a clean lock; the analysis gate still decides validity. */
export const LOCK_MAX_ROLL_DEGREES = 7;
export const LOCK_MAX_YAW_RATIO = 1.35;
export const LOCK_FRONT_MAX_YAW_DEGREES = 12;
/** Chin up/down: a front or 45° photo with the head tipped this far reads as looking down or up, which distorts every crop. */
export const LOCK_MAX_PITCH_DEGREES = 20;
/** A 45° view must measure between these angles (from the depth of the two face edges), not just be turned a little. */
export const LOCK_ANGLE_WINDOW = { min: 30, max: 60 };
/** How far the face may drift between samples (fraction of the frame) and still count as "still". */
export const STILLNESS_TOLERANCE = 0.03;
/** The face must satisfy every condition, continuously, for this long before capture. Configurable. */
export const DEFAULT_STABILITY_MS = 1200;

/** The side of the face that must face the camera for each angled view, and which way the head turns to show it. */
export const VIEW_TARGET: Partial<Record<PhotoSlot, { nearSide: FaceSide; headTurn: "LEFT" | "RIGHT" }>> = {
  leftFortyFive: { nearSide: "left", headTurn: "RIGHT" },
  rightFortyFive: { nearSide: "right", headTurn: "LEFT" },
  leftProfile: { nearSide: "left", headTurn: "RIGHT" },
  rightProfile: { nearSide: "right", headTurn: "LEFT" },
};

export const MESSAGES = {
  NO_FACE: "We can't see your face yet",
  MULTIPLE_FACES: "Make sure only one face is in view",
  TOO_FAR: "Move closer",
  TOO_CLOSE: "Move back a little",
  MOVE_LEFT: "Move slightly left",
  MOVE_RIGHT: "Move slightly right",
  MOVE_UP: "Move slightly up",
  MOVE_DOWN: "Move slightly down",
  LOOK_STRAIGHT: "Look straight ahead",
  HEAD_TOO_TILTED: "Keep your head level",
  LOOK_AT_CAMERA: "Look straight into the camera",
  LIGHT_TOO_DARK: "Find a brighter spot",
  LIGHT_TOO_BRIGHT: "That's very bright — try softer light",
  HOLD_STILL: "Perfect — hold still",
  GOOD_TO_CAPTURE: "Perfect — hold still",
  PROCESSING: "Capturing…",
  CAPTURED: "Captured",
} as const;

export interface GuidanceInput {
  faceCount: number;
  landmarks: LandmarkList | null;
  frameWidth: number;
  frameHeight: number;
  /** 0-255 mean luminance of the frame, when sampled. */
  meanBrightness?: number;
  target: PhotoSlot;
  /** True when the preview is shown mirrored (selfie style): left/right movement cues are in what the person SEES. */
  mirrored: boolean;
}

const result = (state: GuidanceState, message: string, frameOk = false): GuidanceResult => ({ state, message, frameOk });

/**
 * Head yaw in degrees from the depth difference between the two face-edge landmarks (MediaPipe z is on the same scale as x).
 * Null when no depth is present (z all zero), so callers fall back to the 2D rules.
 */
export function estimateYawDegrees(lm: LandmarkList): number | null {
  const a = lm[LANDMARK.faceLeftEdge], b = lm[LANDMARK.faceRightEdge];
  if (!a || !b) return null;
  const dz = Math.abs((a.z ?? 0) - (b.z ?? 0)), dx = Math.abs(a.x - b.x);
  return dz === 0 ? null : (Math.atan2(dz, dx) * 180) / Math.PI;
}

/**
 * Head pitch in degrees from the depth difference between forehead and chin (MediaPipe z shares x's scale, so the
 * vertical distance is expressed in width units). Null when no depth is present.
 */
export function estimatePitchDegrees(lm: LandmarkList, frameWidth: number, frameHeight: number): number | null {
  const top = lm[LANDMARK.foreheadTop], chin = lm[LANDMARK.chin];
  if (!top || !chin || !frameWidth) return null;
  const dz = (top.z ?? 0) - (chin.z ?? 0);
  if (dz === 0) return null;
  return (Math.atan2(dz, (Math.abs(chin.y - top.y) * frameHeight) / frameWidth) * 180) / Math.PI;
}

/** The side with the larger nose-to-face-edge span (i.e. toward the camera), or null if they are equal. */
function raw_near_side(lm: LandmarkList): FaceSide | null {
  const nose = lm[LANDMARK.noseTip];
  const right = lm[LANDMARK.faceRightEdge];
  const left = lm[LANDMARK.faceLeftEdge];
  if (!nose || !right || !left) return null;
  const rightSpan = Math.abs(nose.x - right.x);
  const leftSpan = Math.abs(left.x - nose.x);
  if (rightSpan === leftSpan) return null;
  return rightSpan > leftSpan ? "right" : "left";
}

const turn = (dir: "LEFT" | "RIGHT", message: string): GuidanceResult => result(dir === "LEFT" ? "TURN_LEFT" : "TURN_RIGHT", message);
const opposite = (dir: "LEFT" | "RIGHT") => (dir === "LEFT" ? "RIGHT" : "LEFT");
const side = (dir: "LEFT" | "RIGHT") => dir.toLowerCase();

/** Which way is the face turned, as the direction the person should turn BACK toward the camera. */
const backTowardCamera = (near: FaceSide): "LEFT" | "RIGHT" => (near === "left" ? "LEFT" : "RIGHT");

export function evaluateGuidance(input: GuidanceInput): GuidanceResult {
  const { faceCount, landmarks: lm, target } = input;
  if (faceCount === 0 || (faceCount === 1 && !lm)) return result("NO_FACE", MESSAGES.NO_FACE);
  if (faceCount > 1) return result("MULTIPLE_FACES", MESSAGES.MULTIPLE_FACES);
  if (!lm) return result("NO_FACE", MESSAGES.NO_FACE);

  // 1. Light — a very dark or blown-out frame makes every other check unreliable.
  if (typeof input.meanBrightness === "number") {
    if (input.meanBrightness < MIN_BRIGHTNESS) return result("LIGHT_TOO_DARK", MESSAGES.LIGHT_TOO_DARK);
    if (input.meanBrightness > MAX_BRIGHTNESS) return result("LIGHT_TOO_BRIGHT", MESSAGES.LIGHT_TOO_BRIGHT);
  }

  const box = boundingBox(lm);
  const width = box.maxX - box.minX;
  const cx = (box.minX + box.maxX) / 2;
  const cy = (box.minY + box.maxY) / 2;
  // Movement cues are in screen terms: a mirrored preview flips left/right.
  const screenX = input.mirrored ? 1 - cx : cx;

  // 2. Cut off by the frame edge (existing quality rule) → too close, or off to one side.
  const cutLeft = box.minX < EDGE_MARGIN;
  const cutRight = box.maxX > 1 - EDGE_MARGIN;
  const cutTop = box.minY < EDGE_MARGIN;
  const cutBottom = box.maxY > 1 - EDGE_MARGIN;
  if ((cutLeft && cutRight) || (cutTop && cutBottom)) return result("TOO_CLOSE", MESSAGES.TOO_CLOSE);
  const horizontalCue = (faceOnScreenLeft: boolean) => (faceOnScreenLeft ? result("MOVE_RIGHT", MESSAGES.MOVE_RIGHT) : result("MOVE_LEFT", MESSAGES.MOVE_LEFT));
  if (cutLeft || cutRight) return horizontalCue(input.mirrored ? cutRight : cutLeft);
  if (cutTop) return result("MOVE_DOWN", MESSAGES.MOVE_DOWN);
  if (cutBottom) return result("MOVE_UP", MESSAGES.MOVE_UP);

  // 3. Size (existing minimum face width).
  if (width < MIN_FACE_WIDTH_WARNING) return result("TOO_FAR", MESSAGES.TOO_FAR);

  // 3b. The whole face (hairline to chin) must fill the oval: not a small face floating in the frame.
  const height = box.maxY - box.minY;
  if (height < FACE_HEIGHT_RANGE.min) return result("TOO_FAR", MESSAGES.TOO_FAR);
  if (height > FACE_HEIGHT_RANGE.max) return result("TOO_CLOSE", MESSAGES.TOO_CLOSE);

  // 4. Centred in frame.
  if (Math.abs(screenX - 0.5) > CENTER_TOLERANCE_X) return horizontalCue(screenX < 0.5);
  if (Math.abs(cy - 0.5) > CENTER_TOLERANCE_Y) return cy < 0.5 ? result("MOVE_DOWN", MESSAGES.MOVE_DOWN) : result("MOVE_UP", MESSAGES.MOVE_UP);

  // 5. Head orientation, per view — reusing the existing rules.
  if (target === "front") {
    const roll = estimateRollDegrees(lm, input.frameWidth, input.frameHeight);
    if (roll !== null && Math.abs(roll) > Math.min(MAX_ROLL_DEGREES, LOCK_MAX_ROLL_DEGREES)) return result("HEAD_TOO_TILTED", MESSAGES.HEAD_TOO_TILTED);
    const yaw = estimateYawRatio(lm), yawDeg = estimateYawDegrees(lm);
    if ((yaw !== null && yaw > Math.min(MAX_YAW_RATIO, LOCK_MAX_YAW_RATIO)) || (yawDeg !== null && yawDeg > LOCK_FRONT_MAX_YAW_DEGREES)) {
      const near = raw_near_side(lm);
      return turn(near ? backTowardCamera(near) : "LEFT", MESSAGES.LOOK_STRAIGHT);
    }
    const pitch = estimatePitchDegrees(lm, input.frameWidth, input.frameHeight);
    if (pitch !== null && Math.abs(pitch) > LOCK_MAX_PITCH_DEGREES) return result("HEAD_TOO_TILTED", MESSAGES.LOOK_AT_CAMERA);
  } else if (target === "leftFortyFive" || target === "rightFortyFive") {
    const want = VIEW_TARGET[target]!;
    const near = nearSideOf(lm); // null until turned enough (TURNED_SPAN_RATIO)
    if (near === null) {
      const leaning = raw_near_side(lm);
      return turn(want.headTurn, leaning === want.nearSide ? `Turn a little more to your ${side(want.headTurn)}` : `Turn slightly to your ${side(want.headTurn)}`);
    }
    if (near !== want.nearSide) return turn(want.headTurn, `Turn the other way — to your ${side(want.headTurn)}`);
    if (!validateThreeQuarter(lm, want.nearSide).plausible) return turn(opposite(want.headTurn), `Turn back a little to your ${side(opposite(want.headTurn))}`);
    const angle = estimateYawDegrees(lm);
    if (angle !== null && angle < LOCK_ANGLE_WINDOW.min) return turn(want.headTurn, `Turn a little more to your ${side(want.headTurn)}`);
    if (angle !== null && angle > LOCK_ANGLE_WINDOW.max) return turn(opposite(want.headTurn), `Turn back a little to your ${side(opposite(want.headTurn))}`);
    const pitch = estimatePitchDegrees(lm, input.frameWidth, input.frameHeight);
    if (pitch !== null && Math.abs(pitch) > LOCK_MAX_PITCH_DEGREES) return result("HEAD_TOO_TILTED", MESSAGES.LOOK_AT_CAMERA);
  } else {
    // Profiles: the face mesh is not reliable side-on and no profile rule exists, so profiles are captured manually
    // (see profileIsManual). Guidance only checks that a face is visible and lit.
    return result("HOLD_STILL", `Turn fully to your ${side(VIEW_TARGET[target]!.headTurn)}, then tap Capture`);
  }

  // 6. The existing quality gate must agree, so this never approves a frame the analysis would reject.
  const quality = checkPhotoQuality({
    imageWidth: input.frameWidth,
    imageHeight: input.frameHeight,
    faceCount: 1,
    landmarks: lm,
    meanBrightness: input.meanBrightness,
    expectFrontalOrientation: target === "front",
  });
  if (!quality.valid) return result("TOO_FAR", MESSAGES.TOO_FAR);

  return result("HOLD_STILL", MESSAGES.HOLD_STILL, true);
}

/** Profiles are never auto-captured: no defensible live rule exists (documented in docs/GUIDED_CAMERA_CAPTURE.md). */
export const profileIsManual = (slot: PhotoSlot) => slot === "leftProfile" || slot === "rightProfile";

export { TURNED_SPAN_RATIO };

// ---------------------------------------------------------------------------
// Stability: capture only after a short, continuous run of good, still frames.
// ---------------------------------------------------------------------------

export interface StabilityState {
  /** Timestamp (ms) at which the current unbroken good run began, or null. */
  goodSince: number | null;
  lastCenter: { x: number; y: number } | null;
}

export const INITIAL_STABILITY: StabilityState = { goodSince: null, lastCenter: null };

export interface StabilityOptions {
  requiredMs: number;
  stillnessTolerance: number;
}

export interface StabilityStep {
  state: StabilityState;
  /** 0..1 — how far through the required hold the person is (for the progress ring). */
  progress: number;
  /** True once the run has lasted requiredMs. */
  stable: boolean;
}

/**
 * Pure step function. A frame that is not OK, or in which the face moved more
 * than the stillness tolerance since the previous sample, restarts the run.
 * A single passing frame therefore can never trigger a capture.
 */
export function stepStability(
  prev: StabilityState,
  sample: { ok: boolean; center: { x: number; y: number } | null; timeMs: number },
  options: StabilityOptions = { requiredMs: DEFAULT_STABILITY_MS, stillnessTolerance: STILLNESS_TOLERANCE },
): StabilityStep {
  if (!sample.ok || !sample.center) return { state: { goodSince: null, lastCenter: null }, progress: 0, stable: false };

  const moved = prev.lastCenter ? Math.hypot(sample.center.x - prev.lastCenter.x, sample.center.y - prev.lastCenter.y) > options.stillnessTolerance : false;
  const goodSince = prev.goodSince === null || moved ? sample.timeMs : prev.goodSince;
  const held = sample.timeMs - goodSince;
  const progress = options.requiredMs <= 0 ? 1 : Math.min(1, Math.max(0, held / options.requiredMs));
  return { state: { goodSince, lastCenter: sample.center }, progress, stable: held >= options.requiredMs };
}

/** Center of the face box in frame fractions, for the stillness check. Null without landmarks. */
export function faceCenter(lm: LandmarkList | null): { x: number; y: number } | null {
  if (!lm) return null;
  const b = boundingBox(lm);
  return Number.isFinite(b.minX) ? { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 } : null;
}
