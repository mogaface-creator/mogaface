/**
 * Per-view landmark plausibility checks.
 *
 * These are deliberately weak: MediaPipe's static-image FaceLandmarker
 * output does not include a calibrated head-rotation angle in this app (see
 * viewCapabilities.ts), so none of this claims to verify "this is exactly a
 * 45° photo". It only checks the one thing 2D landmark geometry can
 * honestly tell us: roughly how visible each eye's landmarks are, which is
 * a coarse proxy for "does this look plausible for the claimed pose."
 */

import { LANDMARK } from "../landmarkMapping.ts";
import { distance } from "../geometry.ts";
import type { LandmarkList } from "../types.ts";
import type { ViewValidation } from "./types.ts";

/** Below this normalized width, an eye's corner landmarks are treated as collapsed/degenerate rather than "visible". */
const MIN_PLAUSIBLE_EYE_WIDTH = 0.01;

function eyeWidths(landmarks: LandmarkList): { left: number; right: number } {
  return {
    left: distance(landmarks[LANDMARK.leftEyeInner], landmarks[LANDMARK.leftEyeOuter]),
    right: distance(landmarks[LANDMARK.rightEyeInner], landmarks[LANDMARK.rightEyeOuter]),
  };
}

export function validateFront(landmarks: LandmarkList): ViewValidation {
  const { left, right } = eyeWidths(landmarks);
  const warnings: string[] = [];
  if (left < MIN_PLAUSIBLE_EYE_WIDTH || right < MIN_PLAUSIBLE_EYE_WIDTH) {
    warnings.push("Both eyes should be clearly visible in the front photo.");
  }
  return {
    plausible: warnings.length === 0,
    warnings,
    notes: [
      "Frontal orientation (roll/yaw) is checked separately by the standard photo-quality checks used for every photo in this app.",
    ],
  };
}

export function validateThreeQuarter(landmarks: LandmarkList, side: "left" | "right"): ViewValidation {
  const { left, right } = eyeWidths(landmarks);
  const nearEye = side === "left" ? left : right;
  const farEye = side === "left" ? right : left;
  const warnings: string[] = [];

  if (nearEye < MIN_PLAUSIBLE_EYE_WIDTH) {
    warnings.push("The near eye isn't clearly visible — recheck this is a 45° photo, not a profile.");
  }
  if (farEye < MIN_PLAUSIBLE_EYE_WIDTH) {
    warnings.push("This looks very side-on for a 45° photo — both eyes should generally still be visible.");
  }

  return {
    plausible: warnings.length === 0,
    warnings,
    notes: [
      "This checks only that landmarks for both eyes were placed with non-trivial spacing — it cannot verify the head is turned to exactly 45°, since this app has no calibrated head-rotation angle for static images.",
    ],
  };
}

export function validateProfile(landmarks: LandmarkList): ViewValidation {
  // Deliberately minimal: unlike front/45°, a profile photo is expected to
  // have one eye's landmarks compressed or absent, so we don't treat that
  // as a warning here — only confirm a face was detected with landmarks at
  // all, which the caller already knows before calling this.
  return {
    plausible: landmarks.length > 0,
    warnings: [],
    notes: [
      "Profile photos are not checked for pose accuracy — only that a face was detected. See viewCapabilities.ts for why profile-specific geometry isn't implemented yet.",
    ],
  };
}
