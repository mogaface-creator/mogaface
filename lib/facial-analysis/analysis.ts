import { calculateMeasurements } from "./measurements.ts";
import { calculateSymmetry } from "./symmetry.ts";
import { calculateProportions } from "./proportions.ts";
import type { FacialAnalysisResult, LandmarkList, PhotoQualityResult } from "./types.ts";

/** Bump whenever a formula in measurements/symmetry/proportions changes. */
export const ANALYSIS_VERSION = "0.1.0";

export function buildAnalysisResult(
  landmarks: LandmarkList,
  quality: PhotoQualityResult,
  imageWidth: number,
  imageHeight: number,
): FacialAnalysisResult {
  const measurements = calculateMeasurements(landmarks);
  const symmetry = calculateSymmetry(landmarks, measurements);
  const proportions = calculateProportions(measurements);

  return {
    analysisVersion: ANALYSIS_VERSION,
    timestamp: new Date().toISOString(),
    imageMetadata: { width: imageWidth, height: imageHeight },
    quality,
    measurements,
    symmetry,
    proportions,
  };
}
