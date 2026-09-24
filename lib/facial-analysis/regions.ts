/**
 * Pixel-level region measurements for the visual-observation layer.
 *
 * Pure functions over a luminance image and MediaPipe landmarks — no DOM, no
 * canvas — so they are unit-testable with synthetic pixels. Everything here
 * describes what a region LOOKS like in one image (mean brightness, how
 * strongly it is banded by lines). Nothing here classifies a skin condition,
 * and no threshold in this file decides anything: thresholds live with the
 * caller that interprets a measurement (and are documented as uncalibrated).
 *
 * Region boxes are approximations built from landmarks: the mesh does not
 * track hair, skin folds or eyelid shading, so a box is "roughly the area
 * between these points", not an anatomical boundary.
 */

import { LANDMARK } from "./landmarkMapping.ts";
import type { LandmarkList } from "./types.ts";

export interface GrayImage {
  width: number;
  height: number;
  /** One luminance byte (0-255) per pixel, row-major. */
  data: Uint8ClampedArray | Uint8Array;
}

/** Half-open pixel box: x in [x0, x1), y in [y0, y1). */
export interface PixelRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const MIN_REGION_PX = 6;

/** Rounds to whole pixels and clips to the image; null if what is left is too small to measure. */
export function clipRect(rect: PixelRect, image: GrayImage): PixelRect | null {
  const x0 = Math.max(0, Math.round(Math.min(rect.x0, rect.x1)));
  const x1 = Math.min(image.width, Math.round(Math.max(rect.x0, rect.x1)));
  const y0 = Math.max(0, Math.round(Math.min(rect.y0, rect.y1)));
  const y1 = Math.min(image.height, Math.round(Math.max(rect.y0, rect.y1)));
  if (![x0, x1, y0, y1].every(Number.isFinite)) return null;
  if (x1 - x0 < MIN_REGION_PX || y1 - y0 < MIN_REGION_PX) return null;
  return { x0, y0, x1, y1 };
}

export function meanLuminance(image: GrayImage, rect: PixelRect): number | null {
  const r = clipRect(rect, image);
  if (!r) return null;
  let sum = 0;
  for (let y = r.y0; y < r.y1; y++) for (let x = r.x0; x < r.x1; x++) sum += image.data[y * image.width + x];
  return sum / ((r.x1 - r.x0) * (r.y1 - r.y0));
}

/** Subtracts a moving average (odd `window`) so slow lighting gradients don't count as lines. */
function highPass(profile: number[], window: number): number[] {
  const half = Math.floor(window / 2);
  return profile.map((v, i) => {
    let sum = 0;
    let n = 0;
    for (let j = Math.max(0, i - half); j <= Math.min(profile.length - 1, i + half); j++) {
      sum += profile[j];
      n++;
    }
    return v - sum / n;
  });
}

const rms = (values: number[]) => Math.sqrt(values.reduce((a, v) => a + v * v, 0) / values.length);

/**
 * How strongly the region is banded by lines of one orientation, as a
 * fraction of its mean brightness (so it is comparable across exposures).
 *
 * "horizontal" averages each ROW, then measures how much that row profile
 * varies after removing slow trends — horizontal creases raise it, a flat
 * or vertically-streaked region does not. "vertical" is the same across
 * columns. Returns null when the region is too small or too dark to measure.
 */
export function lineBandContrast(image: GrayImage, rect: PixelRect, orientation: "horizontal" | "vertical"): number | null {
  const r = clipRect(rect, image);
  if (!r) return null;
  const w = r.x1 - r.x0;
  const h = r.y1 - r.y0;
  const profile: number[] = [];
  let total = 0;
  if (orientation === "horizontal") {
    for (let y = r.y0; y < r.y1; y++) {
      let s = 0;
      for (let x = r.x0; x < r.x1; x++) s += image.data[y * image.width + x];
      profile.push(s / w);
      total += s;
    }
  } else {
    for (let x = r.x0; x < r.x1; x++) {
      let s = 0;
      for (let y = r.y0; y < r.y1; y++) s += image.data[y * image.width + x];
      profile.push(s / h);
      total += s;
    }
  }
  const mean = total / (w * h);
  if (mean < 10) return null;
  const window = Math.max(5, Math.round(profile.length / 3) | 1);
  return rms(highPass(profile, window)) / mean;
}

/**
 * Orientation-free local contrast: RMS of (pixel − its 3×3 neighbourhood
 * mean), as a fraction of the region's mean brightness. Used where lines
 * fan out in mixed directions (outer eye corners).
 */
export function localTextureContrast(image: GrayImage, rect: PixelRect): number | null {
  const r = clipRect(rect, image);
  if (!r) return null;
  let sumSq = 0;
  let sum = 0;
  let n = 0;
  for (let y = Math.max(1, r.y0); y < Math.min(image.height - 1, r.y1); y++) {
    for (let x = Math.max(1, r.x0); x < Math.min(image.width - 1, r.x1); x++) {
      let local = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) local += image.data[(y + dy) * image.width + x + dx];
      const v = image.data[y * image.width + x];
      const d = v - local / 9;
      sumSq += d * d;
      sum += v;
      n++;
    }
  }
  if (n === 0) return null;
  const mean = sum / n;
  return mean < 10 ? null : Math.sqrt(sumSq / n) / mean;
}

// ---------------------------------------------------------------------------
// Landmark → region boxes
// ---------------------------------------------------------------------------

interface FaceFrame {
  w: number;
  h: number;
  /** Face height (foreheadTop → chin) and width (edge → edge) in pixels. */
  faceH: number;
  faceW: number;
}

function frame(lm: LandmarkList, image: GrayImage): FaceFrame {
  const w = image.width;
  const h = image.height;
  return {
    w,
    h,
    faceH: Math.abs(lm[LANDMARK.chin].y - lm[LANDMARK.foreheadTop].y) * h,
    faceW: Math.abs(lm[LANDMARK.faceLeftEdge].x - lm[LANDMARK.faceRightEdge].x) * w,
  };
}

/** Central forehead: between the outer brows (middle 60%), from just below the mesh top to just above the brows. */
export function foreheadRegion(lm: LandmarkList, image: GrayImage): PixelRect | null {
  const f = frame(lm, image);
  const xa = lm[LANDMARK.rightEyebrowOuter].x * f.w;
  const xb = lm[LANDMARK.leftEyebrowOuter].x * f.w;
  const span = Math.abs(xb - xa);
  const x0 = Math.min(xa, xb) + span * 0.2;
  const x1 = Math.max(xa, xb) - span * 0.2;
  const y0 = lm[LANDMARK.foreheadTop].y * f.h + f.faceH * 0.05;
  const y1 = Math.min(lm[LANDMARK.rightEyebrowMid].y, lm[LANDMARK.leftEyebrowMid].y) * f.h - f.faceH * 0.03;
  if (y1 - y0 < f.faceH * 0.06) return null;
  return clipRect({ x0, y0, x1, y1 }, image);
}

/** Between the inner brows, just above and at the brow line. */
export function glabellarRegion(lm: LandmarkList, image: GrayImage): PixelRect | null {
  const f = frame(lm, image);
  const xa = lm[LANDMARK.rightEyebrowInner].x * f.w;
  const xb = lm[LANDMARK.leftEyebrowInner].x * f.w;
  const span = Math.abs(xb - xa);
  const browY = Math.min(lm[LANDMARK.rightEyebrowInner].y, lm[LANDMARK.leftEyebrowInner].y) * f.h;
  return clipRect(
    { x0: Math.min(xa, xb) + span * 0.15, x1: Math.max(xa, xb) - span * 0.15, y0: browY - f.faceH * 0.1, y1: browY + f.faceH * 0.02 },
    image,
  );
}

/** Outside each outer eye corner. Returns [subject's right, subject's left]; either may be null. */
export function lateralEyeRegions(lm: LandmarkList, image: GrayImage): [PixelRect | null, PixelRect | null] {
  const f = frame(lm, image);
  const side = (outer: number, direction: -1 | 1) => {
    const p = lm[outer];
    const x = p.x * f.w;
    return clipRect(
      { x0: x + direction * f.faceW * 0.01, x1: x + direction * f.faceW * 0.1, y0: p.y * f.h - f.faceH * 0.06, y1: p.y * f.h + f.faceH * 0.06 },
      image,
    );
  };
  return [side(LANDMARK.rightEyeOuter, -1), side(LANDMARK.leftEyeOuter, 1)];
}

export interface UnderEyeRegions {
  /** The strip just below the lower lid. */
  underEye: PixelRect | null;
  /** A same-width reference strip on the cheek below it. */
  cheek: PixelRect | null;
}

/** Subject's right eye, then left. Sizes are relative to that eye's own width. */
export function underEyeRegions(lm: LandmarkList, image: GrayImage): [UnderEyeRegions, UnderEyeRegions] {
  const w = image.width;
  const h = image.height;
  const side = (inner: number, outer: number, lowerLid: number): UnderEyeRegions => {
    const xi = lm[inner].x * w;
    const xo = lm[outer].x * w;
    const ew = Math.abs(xo - xi);
    const x0 = Math.min(xi, xo) + ew * 0.15;
    const x1 = Math.max(xi, xo) - ew * 0.15;
    const lid = lm[lowerLid].y * h;
    return {
      underEye: clipRect({ x0, x1, y0: lid + ew * 0.2, y1: lid + ew * 0.45 }, image),
      cheek: clipRect({ x0, x1, y0: lid + ew * 0.95, y1: lid + ew * 1.3 }, image),
    };
  };
  return [
    side(LANDMARK.rightEyeInner, LANDMARK.rightEyeOuter, LANDMARK.rightLowerLid),
    side(LANDMARK.leftEyeInner, LANDMARK.leftEyeOuter, LANDMARK.leftLowerLid),
  ];
}
