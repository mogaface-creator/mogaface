/**
 * What each view category can and cannot reliably contribute.
 *
 * This is documentation made checkable at runtime, not a claim of accuracy.
 * `combinable` metrics are the ONLY ones combine.ts is allowed to pull into
 * CombinedMeasurements; everything else stays per-photo-only (visible in
 * the per-photo debug view for transparency, never presented as a primary
 * result).
 */

import type { ViewCategory } from "./types.ts";

export interface ViewCapability {
  view: ViewCategory;
  label: string;
  /** Metric paths the existing engine can compute for this view (dot-path into FaceMeasurements, or "symmetry"/"proportions" for those whole sections). */
  computable: string[];
  /** Subset of `computable` that combine.ts treats as trustworthy enough to use as a primary/supporting result. */
  combinable: string[];
  limitations: string[];
}

const FRONT_METRICS = [
  "face.width",
  "face.height",
  "face.widthHeightRatio",
  "eyes.leftEyeWidth",
  "eyes.rightEyeWidth",
  "eyes.interocularDistance",
  "eyes.eyeWidthDifferencePct",
  "nose.width",
  "nose.height",
  "nose.widthToFaceWidthRatio",
  "mouth.width",
  "mouth.widthToFaceWidthRatio",
  "jaw.width",
  "jaw.chinHeight",
  "jaw.lowerFaceHeight",
  "thirds.upper",
  "thirds.middle",
  "thirds.lower",
  "symmetry",
  "proportions",
];

export const VIEW_CAPABILITIES: Record<ViewCategory, ViewCapability> = {
  front: {
    view: "front",
    label: "Front",
    computable: FRONT_METRICS,
    combinable: FRONT_METRICS,
    limitations: [],
  },
  threeQuarter: {
    view: "threeQuarter",
    label: "45°",
    // The existing engine still runs on these landmarks (same formulas,
    // same code) and the numbers are stored per-photo for transparency —
    // but they are foreshortened by the head turn and not directly
    // comparable to a front photo's values, so none are combined.
    computable: FRONT_METRICS,
    combinable: [],
    limitations: [
      "The face is turned, so frontal-style measurements are foreshortened and not directly comparable to a front photo's values — shown per-photo for transparency only, never combined.",
      "No 45°-specific geometry (e.g. nose projection) is implemented: MediaPipe does not provide a calibrated head-rotation angle from a single static image in this app, so a pose-specific formula could not be verified without real-photo testing.",
    ],
  },
  profile: {
    view: "profile",
    label: "Profile",
    // Intentionally empty: see Step 7 of the brief ("do not calculate
    // frontal-only measurements from profile images"). The engine is not
    // even invoked for profile photos — see coordinator.ts.
    computable: [],
    combinable: [],
    limitations: [
      "Frontal-style measurements are not calculated from profile photos — landmarks the formulas need (the opposite eye, the opposite nostril) are not reliably visible from the side, so running the existing engine here would produce numbers that look precise but aren't meaningful.",
      "Profile-specific geometry (nose projection, chin projection, facial convexity) is not implemented in this step. MediaPipe's face mesh topology is designed and trained for frontal/near-frontal faces.",
    ],
  },
};
