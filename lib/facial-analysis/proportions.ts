/**
 * Proportion engine — descriptive ratios only.
 *
 * No "ideal" or "golden" ratio is encoded here. These are the same
 * measurable ratios classically used in facial-geometry references (facial
 * thirds, width/height ratios), reported as plain numbers with a plain-text
 * description of what they compare. See FACIAL_ANALYSIS_METHODOLOGY.md.
 */

import { ratio } from "./geometry.ts";
import type { FaceMeasurements, ProportionResult } from "./types.ts";

export function calculateProportions(measurements: FaceMeasurements): ProportionResult {
  const { face, eyes, nose, mouth, jaw, thirds } = measurements;
  const thirdsTotal = thirds.upper + thirds.middle + thirds.lower;

  const metrics = [
    {
      metric: "Face width / face height",
      value: face.widthHeightRatio,
      description: "Overall face width relative to face height.",
    },
    {
      metric: "Interocular distance / face width",
      value: ratio(eyes.interocularDistance, face.width) ?? 0,
      description: "Distance between the inner eye corners relative to face width.",
    },
    {
      metric: "Nose width / face width",
      value: nose.widthToFaceWidthRatio,
      description: "Nose width relative to face width.",
    },
    {
      metric: "Mouth width / face width",
      value: mouth.widthToFaceWidthRatio,
      description: "Mouth width relative to face width.",
    },
    {
      metric: "Lower face height / face height",
      value: ratio(jaw.lowerFaceHeight, face.height) ?? 0,
      description: "Nose base to chin distance relative to total face height.",
    },
    {
      metric: "Upper third proportion",
      value: ratio(thirds.upper, thirdsTotal) ?? 0,
      description: "Forehead-to-brow segment as a share of the three facial thirds.",
    },
    {
      metric: "Middle third proportion",
      value: ratio(thirds.middle, thirdsTotal) ?? 0,
      description: "Brow-to-nose-base segment as a share of the three facial thirds.",
    },
    {
      metric: "Lower third proportion",
      value: ratio(thirds.lower, thirdsTotal) ?? 0,
      description: "Nose-base-to-chin segment as a share of the three facial thirds.",
    },
  ];

  return { metrics };
}
