import { LANDMARK } from "../../lib/facial-analysis/landmarkMapping.ts";
import { buildSymmetricFace } from "../facial-analysis/fixtures.ts";
import type { GrayImage } from "../../lib/facial-analysis/regions.ts";
import type { LandmarkList } from "../../lib/facial-analysis/types.ts";
import type { VideoFrameSample, VideoMetadata } from "../../lib/facial-analysis/video/types.ts";

export const SIZE = 1000;

export const META: VideoMetadata = { durationSec: 10, width: 1280, height: 720, sizeBytes: 5_000_000, mimeType: "video/mp4" };

export interface FaceOptions {
  /** Brow-to-eye distance grows by this much (normalized units); baseline gap is 0.055. */
  browRaise?: number;
  /** Inner brows move together by dx and down by dy. */
  frown?: { dx: number; dy: number };
  /** Each mouth corner moves outward by this much; baseline mouth width is 0.20. */
  smile?: number;
  /** Each lid moves toward the other by this much; baseline lid gap is 0.03. */
  squint?: number;
  /** Shift the whole face horizontally (to fake a head turn use `yawShift`). */
  yawShift?: number;
  tiltY?: number;
}

/** A symmetric frontal face with eyelids, mid-brow, and inner lips added, and optional expression. */
export function expressionFace(o: FaceOptions = {}): LandmarkList {
  const lm = buildSymmetricFace();
  const set = (i: number, x: number, y: number) => (lm[i] = { x, y, z: 0 });
  const raise = o.browRaise ?? 0;
  const frown = o.frown ?? { dx: 0, dy: 0 };
  const squint = o.squint ?? 0;
  const smile = o.smile ?? 0;

  set(LANDMARK.rightUpperLid, 0.385, 0.385 + squint);
  set(LANDMARK.rightLowerLid, 0.385, 0.415 - squint);
  set(LANDMARK.leftUpperLid, 0.615, 0.385 + squint);
  set(LANDMARK.leftLowerLid, 0.615, 0.415 - squint);
  set(LANDMARK.rightEyebrowMid, 0.385, 0.33 - raise);
  set(LANDMARK.leftEyebrowMid, 0.615, 0.33 - raise);
  set(LANDMARK.rightEyebrowInner, 0.45 + frown.dx, 0.34 - raise + frown.dy);
  set(LANDMARK.leftEyebrowInner, 0.55 - frown.dx, 0.34 - raise + frown.dy);
  set(LANDMARK.rightEyebrowOuter, 0.3, 0.35 - raise);
  set(LANDMARK.leftEyebrowOuter, 0.7, 0.35 - raise);
  set(LANDMARK.mouthRight, 0.4 - smile, 0.7);
  set(LANDMARK.mouthLeft, 0.6 + smile, 0.7);
  set(LANDMARK.innerUpperLip, 0.5, 0.695);
  set(LANDMARK.innerLowerLip, 0.5, 0.705);

  if (o.yawShift) lm[LANDMARK.noseTip] = { x: 0.5 + o.yawShift, y: 0.55, z: 0 };
  if (o.tiltY) lm[LANDMARK.leftEyeOuter] = { x: 0.68, y: 0.4 + o.tiltY, z: 0 };
  return lm;
}

export function sample(index: number, landmarks: LandmarkList | null, extra: Partial<VideoFrameSample> = {}): VideoFrameSample {
  return {
    index,
    timeSec: index * 0.5,
    imageWidth: SIZE,
    imageHeight: SIZE,
    faceCount: landmarks ? 1 : 0,
    landmarks,
    meanBrightness: 120,
    gray: null,
    ...extra,
  };
}

export const NEUTRAL = () => expressionFace();
export const BROW_RAISED = () => expressionFace({ browRaise: 0.015 }); // +27% brow-to-eye
export const FROWNING = () => expressionFace({ frown: { dx: 0.01, dy: 0.01 } }); // sep -20%, drop -17%
export const SMILING = () => expressionFace({ smile: 0.02 }); // mouth width +20%
export const SQUINTING = () => expressionFace({ squint: 0.006 }); // eye opening -40%

/** Three steady neutral frames (indices 0..2) followed by the given frames, indexed onward. */
export function withNeutralOpening(...rest: LandmarkList[]): VideoFrameSample[] {
  const opening = [NEUTRAL(), NEUTRAL(), NEUTRAL()];
  return [...opening, ...rest].map((lm, i) => sample(i, lm));
}

// ---- synthetic pixels ----

export function flatGray(value = 120): GrayImage {
  return { width: SIZE, height: SIZE, data: new Uint8ClampedArray(SIZE * SIZE).fill(value) };
}

/** Fills a rectangle with horizontal stripes (rows alternate `lo`/`hi` every `period`/2 rows). */
export function stripeRows(img: GrayImage, x0: number, x1: number, y0: number, y1: number, period = 8, lo = 100, hi = 140): GrayImage {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) img.data[y * img.width + x] = y % period < period / 2 ? lo : hi;
  return img;
}

export function stripeCols(img: GrayImage, x0: number, x1: number, y0: number, y1: number, period = 4, lo = 100, hi = 140): GrayImage {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) img.data[y * img.width + x] = x % period < period / 2 ? lo : hi;
  return img;
}

export function checker(img: GrayImage, x0: number, x1: number, y0: number, y1: number, lo = 100, hi = 140): GrayImage {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) img.data[y * img.width + x] = (x + y) % 2 ? lo : hi;
  return img;
}

/** Symmetric face with the face-oval points the contour geometry uses. */
export function contourFace(): LandmarkList {
  const lm = buildSymmetricFace();
  const set = (i: number, x: number, y: number) => (lm[i] = { x, y, z: 0 });
  set(LANDMARK.faceRightEdge, 0.25, 0.5);
  set(LANDMARK.rightOvalCheek, 0.27, 0.62);
  set(LANDMARK.rightJaw, 0.3, 0.75);
  set(LANDMARK.rightOvalJawFront, 0.38, 0.82);
  set(LANDMARK.faceLeftEdge, 0.75, 0.5);
  set(LANDMARK.leftOvalCheek, 0.73, 0.62);
  set(LANDMARK.leftJaw, 0.7, 0.75);
  set(LANDMARK.leftOvalJawFront, 0.62, 0.82);
  return lm;
}

