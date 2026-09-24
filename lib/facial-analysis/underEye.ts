/**
 * Under-eye region measurement — a single, conservative, appearance-only
 * quantity: how bright the strip just below each lower lid is compared with
 * a reference strip on the cheek below it, in the same photo.
 *
 * A ratio below 1 means that strip looks darker in this image. It does NOT
 * say why (shadow, lighting direction, skin tone variation, camera
 * processing and anatomy all produce the same number), and it says nothing
 * about pigmentation, volume, puffiness or any condition. Puffiness,
 * hollowing and fine-line patterns are deliberately NOT measured — see
 * VISUAL_OBSERVATION_LAYER.md.
 */

import { classifyAgainstBand, thresholdBand, type BandResult } from "./bands.ts";
import { meanLuminance, underEyeRegions, type GrayImage } from "./regions.ts";
import type { LandmarkList } from "./types.ts";

/**
 * A strip this much darker than the adjacent cheek (ratio ≤ 0.85) on BOTH
 * eyes is a candidate "visible dark-looking under-eye appearance"; it is only
 * reported when it clears the borderline band below. A heuristic chosen for
 * a first version — UNCALIBRATED against real photos.
 */
export const UNDER_EYE_DARKER_RATIO = 0.85;
/** Borderline half-width (fraction of the threshold): a ratio inside 0.85 ± 5% is insufficient evidence, not an observation. */
export const UNDER_EYE_BORDERLINE_FRACTION = 0.05;

const UNDER_EYE_BAND = thresholdBand(UNDER_EYE_DARKER_RATIO, UNDER_EYE_BORDERLINE_FRACTION, "atMost");
export const UNDER_EYE_DARKNESS_BAND = UNDER_EYE_BAND;

export const classifyUnderEyeRatio = (ratio: number): BandResult => classifyAgainstBand(ratio, UNDER_EYE_BAND, "atMost");

export type UnderEyeDarkness = "OBSERVED" | "BORDERLINE" | "NOT_OBSERVED" | "NOT_EVALUATED";

/**
 * Both eyes must clearly pass. Either eye borderline (and none clearly
 * failing) → BORDERLINE, which yields no observation. A side that could not
 * be measured → NOT_EVALUATED.
 */
export function classifyUnderEyeDarkness(m: UnderEyeMeasurement | null | undefined): UnderEyeDarkness {
  if (!m || !m.right || !m.left) return "NOT_EVALUATED";
  const results = [classifyUnderEyeRatio(m.right.luminanceRatio), classifyUnderEyeRatio(m.left.luminanceRatio)];
  if (results.includes("FAILS")) return "NOT_OBSERVED";
  return results.includes("BORDERLINE") ? "BORDERLINE" : "OBSERVED";
}

export interface UnderEyeSide {
  underEyeLuminance: number;
  cheekLuminance: number;
  /** underEyeLuminance / cheekLuminance. Below 1 = the under-eye strip looks darker than the adjacent cheek. */
  luminanceRatio: number;
}

export interface UnderEyeMeasurement {
  /** Subject's right eye, then left. Null when that side's regions could not be measured. */
  right: UnderEyeSide | null;
  left: UnderEyeSide | null;
}

export function measureUnderEye(image: GrayImage, landmarks: LandmarkList): UnderEyeMeasurement {
  const [rightRegions, leftRegions] = underEyeRegions(landmarks, image);
  const side = (r: { underEye: Parameters<typeof meanLuminance>[1] | null; cheek: Parameters<typeof meanLuminance>[1] | null }): UnderEyeSide | null => {
    if (!r.underEye || !r.cheek) return null;
    const under = meanLuminance(image, r.underEye);
    const cheek = meanLuminance(image, r.cheek);
    if (under === null || cheek === null || cheek < 10) return null;
    return { underEyeLuminance: under, cheekLuminance: cheek, luminanceRatio: under / cheek };
  };
  return { right: side(rightRegions), left: side(leftRegions) };
}
