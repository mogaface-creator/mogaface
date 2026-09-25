/**
 * Photo quality validation.
 *
 * Pure function: takes already-computed inputs (face count, landmarks, image
 * size, optional brightness sample) and returns a typed PhotoQualityResult.
 * No browser/canvas access happens in this module, so it is unit-testable
 * with fabricated input and never needs to touch DOM APIs.
 *
 * qualityScore is derived only from the checks below (100 minus a fixed
 * penalty per triggered warning/error) — it is never an invented "beauty"
 * or "ideal face" score.
 */

import { LANDMARK } from "./landmarkMapping.ts";
import { boundingBox } from "./geometry.ts";
import type { LandmarkList, PhotoQualityResult } from "./types.ts";

export interface QualityCheckInput {
  imageWidth: number;
  imageHeight: number;
  /** Number of faces the detector found (0, 1, or more). */
  faceCount: number;
  /** Landmarks for the primary detected face, when exactly one face was found. */
  landmarks?: LandmarkList;
  /** Average luminance of the image, 0-255, if the caller sampled it. */
  meanBrightness?: number;
  /**
   * Whether to warn on roll/yaw that looks non-frontal. Defaults to true,
   * which preserves this function's original behavior for the single-photo
   * pipeline. The multi-photo pipeline sets this to false for 45°/profile
   * slots, where the face is *expected* to be turned — flagging that as a
   * defect would be wrong for those views. Resolution, brightness, face
   * count, and frame-coverage checks always apply regardless of this flag.
   */
  expectFrontalOrientation?: boolean;
}

export const MIN_RESOLUTION_ERROR = 240;
export const MIN_RESOLUTION_WARNING = 480;
export const MIN_BRIGHTNESS = 40;
export const MAX_BRIGHTNESS = 215;
export const MIN_FACE_WIDTH_ERROR = 0.15;
export const MIN_FACE_WIDTH_WARNING = 0.25;
export const EDGE_MARGIN = 0.02;
const MAX_ROLL_WARNING_DEGREES = 15;
const YAW_RATIO_WARNING = 1.8;

/** How much of the image frame the detected face's landmarks span, 0-1 per axis. Shared with the multi-photo pipeline's consistency check. */
export function getFaceFrameCoverage(landmarks: LandmarkList): { width: number; height: number } {
  const box = boundingBox(landmarks);
  return { width: box.maxX - box.minX, height: box.maxY - box.minY };
}

/**
 * Tilt of the eye line away from horizontal, in degrees (0 = level, sign =
 * direction), computed in pixel space when the image size is given so a
 * non-square photo doesn't skew it. Null if the eye landmarks are missing.
 *
 * (An earlier version returned `180 − angle(...)`, which is 180° for a
 * perfectly level face — every level photo was warned as "tilted".)
 */
export function estimateRollDegrees(lm: LandmarkList, imageWidth = 1, imageHeight = 1): number | null {
  const rightEyeOuter = lm[LANDMARK.rightEyeOuter];
  const leftEyeOuter = lm[LANDMARK.leftEyeOuter];
  if (!rightEyeOuter || !leftEyeOuter) return null;
  const dx = (leftEyeOuter.x - rightEyeOuter.x) * imageWidth;
  const dy = (leftEyeOuter.y - rightEyeOuter.y) * imageHeight;
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || (dx === 0 && dy === 0)) return null;
  let degrees = (Math.atan2(dy, dx) * 180) / Math.PI;
  // Fold to [-90, 90] so a mirrored image (eyes in swapped x order) reads the same as an unmirrored one.
  if (degrees > 90) degrees -= 180;
  if (degrees < -90) degrees += 180;
  return degrees;
}

/**
 * Yaw approximation: larger / smaller of the nose-to-inner-eye horizontal
 * spans on each side. 1 is frontal; larger means turned. Infinity when one
 * side collapses; null if landmarks are missing.
 */
export function estimateYawRatio(lm: LandmarkList): number | null {
  const rightEyeInner = lm[LANDMARK.rightEyeInner];
  const leftEyeInner = lm[LANDMARK.leftEyeInner];
  const noseTip = lm[LANDMARK.noseTip];
  if (!rightEyeInner || !leftEyeInner || !noseTip) return null;
  const rightSpan = Math.abs(noseTip.x - rightEyeInner.x);
  const leftSpan = Math.abs(leftEyeInner.x - noseTip.x);
  const smaller = Math.min(rightSpan, leftSpan);
  return smaller === 0 ? Infinity : Math.max(rightSpan, leftSpan) / smaller;
}

export const MAX_ROLL_DEGREES = MAX_ROLL_WARNING_DEGREES;
export const MAX_YAW_RATIO = YAW_RATIO_WARNING;

export function checkPhotoQuality(input: QualityCheckInput): PhotoQualityResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (input.faceCount === 0) {
    errors.push("No face detected. Use a clear, front-facing photo with good lighting.");
  } else if (input.faceCount > 1) {
    errors.push("Multiple faces detected. Only one face should be visible in the photo.");
  }

  const minDimension = Math.min(input.imageWidth, input.imageHeight);
  if (minDimension < MIN_RESOLUTION_ERROR) {
    errors.push("Image resolution is too low. Use a photo at least 480px on its shortest side.");
  } else if (minDimension < MIN_RESOLUTION_WARNING) {
    warnings.push("Image resolution is low; measurements may be less precise.");
  }

  if (typeof input.meanBrightness === "number") {
    if (input.meanBrightness < MIN_BRIGHTNESS) {
      warnings.push("Image appears too dark. Try a photo with more even lighting.");
    } else if (input.meanBrightness > MAX_BRIGHTNESS) {
      warnings.push("Image appears overexposed. Try a photo with softer, more even lighting.");
    }
  }

  if (input.faceCount === 1 && input.landmarks) {
    const lm = input.landmarks;
    const { minX, maxX, minY, maxY } = boundingBox(lm);
    const faceWidthNorm = maxX - minX;

    if (faceWidthNorm < MIN_FACE_WIDTH_ERROR) {
      errors.push("Face is too small in the frame. Move closer to the camera.");
    } else if (faceWidthNorm < MIN_FACE_WIDTH_WARNING) {
      warnings.push("Face is small in the frame. Moving closer may improve accuracy.");
    }

    if (minX < EDGE_MARGIN || maxX > 1 - EDGE_MARGIN || minY < EDGE_MARGIN || maxY > 1 - EDGE_MARGIN) {
      errors.push("Face is partially cut off. Make sure your whole face is visible in the frame.");
    }

    if (input.expectFrontalOrientation ?? true) {
      const roll = estimateRollDegrees(lm, input.imageWidth, input.imageHeight);
      if (roll !== null && Math.abs(roll) > MAX_ROLL_WARNING_DEGREES) {
        warnings.push("Photo appears tilted. Use a level, front-facing photo for the most accurate results.");
      }

      const yawRatio = estimateYawRatio(lm);
      if (yawRatio !== null && yawRatio > YAW_RATIO_WARNING) {
        warnings.push("Face appears turned to the side. Use a front-facing photo for the most accurate results.");
      }
    }
  }

  const penalty = errors.length * 25 + warnings.length * 8;
  const qualityScore = Math.max(0, Math.min(100, 100 - penalty));

  return { valid: errors.length === 0, errors, warnings, qualityScore };
}
