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
import { angle, boundingBox } from "./geometry.ts";
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

const MIN_RESOLUTION_ERROR = 240;
const MIN_RESOLUTION_WARNING = 480;
const MIN_FACE_WIDTH_ERROR = 0.15;
const MIN_FACE_WIDTH_WARNING = 0.25;
const EDGE_MARGIN = 0.02;
const MAX_ROLL_WARNING_DEGREES = 15;
const YAW_RATIO_WARNING = 1.8;

/** How much of the image frame the detected face's landmarks span, 0-1 per axis. Shared with the multi-photo pipeline's consistency check. */
export function getFaceFrameCoverage(landmarks: LandmarkList): { width: number; height: number } {
  const box = boundingBox(landmarks);
  return { width: box.maxX - box.minX, height: box.maxY - box.minY };
}

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
    if (input.meanBrightness < 40) {
      warnings.push("Image appears too dark. Try a photo with more even lighting.");
    } else if (input.meanBrightness > 215) {
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
      const rightEyeOuter = lm[LANDMARK.rightEyeOuter];
      const leftEyeOuter = lm[LANDMARK.leftEyeOuter];
      const rightEyeInner = lm[LANDMARK.rightEyeInner];
      const leftEyeInner = lm[LANDMARK.leftEyeInner];
      const noseTip = lm[LANDMARK.noseTip];

      if (rightEyeOuter && leftEyeOuter) {
        // Roll: angle of the eye line away from horizontal.
        const horizontalRef = { x: rightEyeOuter.x + 1, y: rightEyeOuter.y };
        const roll = 180 - angle(horizontalRef, rightEyeOuter, leftEyeOuter);
        if (Number.isFinite(roll) && Math.abs(roll) > MAX_ROLL_WARNING_DEGREES) {
          warnings.push("Photo appears tilted. Use a level, front-facing photo for the most accurate results.");
        }
      }

      if (rightEyeInner && leftEyeInner && noseTip) {
        // Yaw approximation: compare nose-to-eye horizontal spans on each side.
        const rightSpan = Math.abs(noseTip.x - rightEyeInner.x);
        const leftSpan = Math.abs(leftEyeInner.x - noseTip.x);
        const smaller = Math.min(rightSpan, leftSpan);
        const larger = Math.max(rightSpan, leftSpan);
        const yawRatio = smaller === 0 ? Infinity : larger / smaller;
        if (yawRatio > YAW_RATIO_WARNING) {
          warnings.push("Face appears turned to the side. Use a front-facing photo for the most accurate results.");
        }
      }
    }
  }

  const penalty = errors.length * 25 + warnings.length * 8;
  const qualityScore = Math.max(0, Math.min(100, 100 - penalty));

  return { valid: errors.length === 0, errors, warnings, qualityScore };
}
