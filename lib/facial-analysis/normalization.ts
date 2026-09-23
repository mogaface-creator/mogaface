/**
 * Normalization layer.
 *
 * MediaPipe landmarks are normalized to [0,1] against image width/height,
 * which already removes absolute pixel scale — but image aspect ratio and
 * camera distance still distort raw x/y distances relative to each other.
 * Every measurement we report as a *ratio* is expressed against a facial
 * reference dimension (face width or face height) so it is comparable
 * across photos taken at different distances/crops. Raw distances are only
 * ever surfaced alongside their reference, never as a standalone "score".
 *
 * Formulas used throughout the engine:
 *   - eyeDistance / faceWidth      → relative interocular spacing
 *   - noseWidth / faceWidth        → relative nose width
 *   - mouthWidth / faceWidth       → relative mouth width
 *   - jawWidth / faceWidth         → relative jaw width
 *   - lowerFaceHeight / faceHeight → relative lower-face proportion
 *   - thirds: each third / faceHeight → relative vertical proportion
 *
 * No "ideal" ratio is encoded anywhere in this module. These are descriptive
 * ratios only (see FACIAL_ANALYSIS_METHODOLOGY.md).
 */

import { ratio } from "./geometry.ts";

/** value / faceWidth, or null if faceWidth is 0. */
export function normalizeToFaceWidth(value: number, faceWidth: number): number | null {
  return ratio(value, faceWidth);
}

/** value / faceHeight, or null if faceHeight is 0. */
export function normalizeToFaceHeight(value: number, faceHeight: number): number | null {
  return ratio(value, faceHeight);
}
