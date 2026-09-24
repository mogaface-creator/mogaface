/**
 * Expression features, neutral baseline, frame classification, and the
 * neutral-vs-expression movement comparison.
 *
 * Everything is RELATIVE to the same video's own neutral baseline, so no
 * absolute size, camera distance or population norm is involved. The
 * thresholds below are heuristics chosen for a first version and are
 * UNCALIBRATED — no real-footage validation set exists yet. They decide
 * only "did this landmark geometry move noticeably", never anything about
 * the person's skin, age or suitability for anything.
 */

import { LANDMARK } from "../landmarkMapping.ts";
import { distance } from "../geometry.ts";
import type { LandmarkList, Point2D } from "../types.ts";
import type {
  ActiveExpressionState,
  ExpressionFeatures,
  ExpressionRegion,
  FrameExpression,
  NeutralBaseline,
} from "./types.ts";

/** Relative change vs neutral (in %) at which a state's movement counts as "noticeable". UNCALIBRATED. */
export const MOVEMENT_THRESHOLD_PCT: Record<ActiveExpressionState, number> = {
  BROW_RAISE: 12,
  FROWN: 8,
  SMILE: 10,
  SQUINT: 25,
};

export const EXPRESSION_REGION: Record<ActiveExpressionState, ExpressionRegion> = {
  BROW_RAISE: "FOREHEAD",
  FROWN: "GLABELLA",
  SMILE: "MOUTH_AREA",
  SQUINT: "EYE_AREA",
};

export const MOVEMENT_METRIC: Record<ActiveExpressionState, string> = {
  BROW_RAISE: "brow-to-eye distance vs neutral",
  FROWN: "inner-brow separation and inner-brow-to-eye-corner distance vs neutral (mean decrease)",
  SMILE: "mouth width vs neutral",
  SQUINT: "eye opening vs neutral (decrease)",
};

/** How many of the first usable frames form the neutral baseline. */
export const NEUTRAL_WINDOW_FRAMES = 3;
/** Max (max−min)/median spread of any feature across baseline frames for the face to count as at rest. */
export const BASELINE_STABILITY = 0.08;
/** A frame is NEUTRAL only if every state's movement is below this fraction of its threshold. */
export const NEUTRAL_FRACTION = 0.5;
/** The strongest state must beat the runner-up by this factor, or the frame is AMBIGUOUS. */
export const DOMINANCE_FACTOR = 1.5;
/**
 * Borderline half-width (fraction of a state's threshold). A frame whose
 * movement is within this margin ABOVE the threshold is still AMBIGUOUS —
 * movement must clearly exceed the threshold to count as an expression.
 */
export const MOVEMENT_BORDERLINE_FRACTION = 0.1;

const ACTIVE_STATES = Object.keys(MOVEMENT_THRESHOLD_PCT) as ActiveExpressionState[];

const px = (lm: LandmarkList, i: number, w: number, h: number): Point2D => ({ x: lm[i].x * w, y: lm[i].y * h });
const mean = (a: number, b: number) => (a + b) / 2;

/** Null when any needed landmark is missing/non-finite or the interocular distance collapses. */
export function computeExpressionFeatures(lm: LandmarkList, imageWidth: number, imageHeight: number): ExpressionFeatures | null {
  const needed = [
    LANDMARK.rightEyeInner, LANDMARK.leftEyeInner, LANDMARK.rightEyeOuter, LANDMARK.leftEyeOuter,
    LANDMARK.rightUpperLid, LANDMARK.rightLowerLid, LANDMARK.leftUpperLid, LANDMARK.leftLowerLid,
    LANDMARK.rightEyebrowMid, LANDMARK.leftEyebrowMid, LANDMARK.rightEyebrowInner, LANDMARK.leftEyebrowInner,
    LANDMARK.mouthRight, LANDMARK.mouthLeft,
  ];
  if (needed.some((i) => !lm[i] || !Number.isFinite(lm[i].x) || !Number.isFinite(lm[i].y))) return null;

  const p = (i: number) => px(lm, i, imageWidth, imageHeight);
  const iod = distance(p(LANDMARK.rightEyeInner), p(LANDMARK.leftEyeInner));
  if (!Number.isFinite(iod) || iod <= 0) return null;

  const rightEyeWidth = distance(p(LANDMARK.rightEyeInner), p(LANDMARK.rightEyeOuter));
  const leftEyeWidth = distance(p(LANDMARK.leftEyeInner), p(LANDMARK.leftEyeOuter));
  if (rightEyeWidth <= 0 || leftEyeWidth <= 0) return null;

  const browToEye = mean(p(LANDMARK.rightUpperLid).y - p(LANDMARK.rightEyebrowMid).y, p(LANDMARK.leftUpperLid).y - p(LANDMARK.leftEyebrowMid).y) / iod;
  const innerBrowSeparation = Math.abs(p(LANDMARK.rightEyebrowInner).x - p(LANDMARK.leftEyebrowInner).x) / iod;
  const innerBrowToEyeCorner =
    mean(p(LANDMARK.rightEyeInner).y - p(LANDMARK.rightEyebrowInner).y, p(LANDMARK.leftEyeInner).y - p(LANDMARK.leftEyebrowInner).y) / iod;
  const eyeOpening = mean(
    (p(LANDMARK.rightLowerLid).y - p(LANDMARK.rightUpperLid).y) / rightEyeWidth,
    (p(LANDMARK.leftLowerLid).y - p(LANDMARK.leftUpperLid).y) / leftEyeWidth,
  );
  const mouthWidth = distance(p(LANDMARK.mouthRight), p(LANDMARK.mouthLeft)) / iod;

  const features: ExpressionFeatures = { browToEye, innerBrowSeparation, innerBrowToEyeCorner, eyeOpening, mouthWidth };
  return Object.values(features).every(Number.isFinite) ? features : null;
}

const median = (values: number[]) => {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

export interface BaselineResult {
  baseline: NeutralBaseline | null;
  /** Explains a null baseline, or a single-frame one. */
  note: string | null;
}

/**
 * The video is expected to START neutral: the first usable frames are the
 * baseline. Fewer than two frames cannot show stability (the baseline is
 * kept but marked unstable → low evidence); two or three frames that
 * disagree mean the face wasn't at rest, so there is no baseline at all.
 */
export function establishBaseline(usable: { index: number; features: ExpressionFeatures }[]): BaselineResult {
  if (usable.length === 0) return { baseline: null, note: "No usable frame was available to establish a neutral baseline." };
  const window = usable.slice(0, NEUTRAL_WINDOW_FRAMES);
  const keys = Object.keys(window[0].features) as (keyof ExpressionFeatures)[];
  const med = Object.fromEntries(keys.map((k) => [k, median(window.map((w) => w.features[k]))])) as unknown as ExpressionFeatures;
  if (Object.values(med).some((v) => v <= 0)) return { baseline: null, note: "The neutral frames produced unusable measurements." };

  if (window.length === 1) {
    return {
      baseline: { frames: [window[0].index], features: med, stable: false, maxSpread: null },
      note: "Only one usable neutral frame was available, so the baseline's stability could not be checked.",
    };
  }
  const spread = keys.map((k) => (Math.max(...window.map((w) => w.features[k])) - Math.min(...window.map((w) => w.features[k]))) / med[k]);
  if (Math.max(...spread) > BASELINE_STABILITY) {
    return { baseline: null, note: "The opening frames were not a steady neutral face — the video should begin with a still, relaxed face." };
  }
  return { baseline: { frames: window.map((w) => w.index), features: med, stable: true, maxSpread: Math.max(...spread) }, note: null };
}

/** Movement of each state in its expected direction, as % of the neutral value. Positive = moved that way. */
export function movementPercent(f: ExpressionFeatures, b: ExpressionFeatures): Record<ActiveExpressionState, number> {
  const pct = (delta: number, base: number) => (delta / base) * 100;
  return {
    BROW_RAISE: pct(f.browToEye - b.browToEye, b.browToEye),
    FROWN: mean(pct(b.innerBrowSeparation - f.innerBrowSeparation, b.innerBrowSeparation), pct(b.innerBrowToEyeCorner - f.innerBrowToEyeCorner, b.innerBrowToEyeCorner)),
    SMILE: pct(f.mouthWidth - b.mouthWidth, b.mouthWidth),
    SQUINT: pct(b.eyeOpening - f.eyeOpening, b.eyeOpening),
  };
}

/**
 * One frame → one state, or AMBIGUOUS when it sits between neutral and an
 * expression, or two expressions compete. Ambiguous frames are never used
 * as evidence — this guesses nothing.
 */
export function classifyFrame(index: number, f: ExpressionFeatures, baseline: NeutralBaseline): FrameExpression {
  const movementPct = movementPercent(f, baseline.features);
  const scores = ACTIVE_STATES.map((s) => ({ state: s, score: movementPct[s] / MOVEMENT_THRESHOLD_PCT[s] })).sort((a, b) => b.score - a.score);
  const [best, second] = scores;

  if (best.score < NEUTRAL_FRACTION) return { index, features: f, state: "NEUTRAL", movementPct };
  if (best.score < 1 + MOVEMENT_BORDERLINE_FRACTION) return { index, features: f, state: "AMBIGUOUS", movementPct };
  if (second.score >= 1 && best.score < second.score * DOMINANCE_FACTOR) return { index, features: f, state: "AMBIGUOUS", movementPct };
  return { index, features: f, state: best.state, movementPct };
}
