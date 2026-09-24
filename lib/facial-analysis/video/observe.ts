/**
 * Pure video → expression analysis. Takes already-sampled, already-detected
 * frames (see capture.ts for the browser side) and returns what can be
 * SUPPORTED by them — never more:
 *
 *   validate metadata → assess each frame → baseline from the opening
 *   usable frames → classify every usable frame → per-state movement
 *   evidence → (where pixels exist) within-video line-contrast comparison.
 *
 * A state with no reliably identified frame is "insufficient_evidence".
 * Nothing here says an expression, movement or line pattern means anything
 * about treatment; see docs/VISUAL_OBSERVATION_LAYER.md.
 */

import { foreheadRegion, glabellarRegion, lateralEyeRegions, lineBandContrast, localTextureContrast } from "../regions.ts";
import type { GrayImage } from "../regions.ts";
import { classifyAgainstBand, thresholdBand } from "../bands.ts";
import { assessFrame } from "./quality.ts";
import {
  EXPRESSION_REGION,
  MOVEMENT_METRIC,
  MOVEMENT_THRESHOLD_PCT,
  classifyFrame,
  computeExpressionFeatures,
  establishBaseline,
} from "./expressions.ts";
import { VIDEO_ANALYSIS_VERSION } from "./types.ts";
import type {
  ActiveExpressionState,
  ExpressionEvidence,
  ExpressionFeatures,
  FrameExpression,
  LinePatternEvidence,
  LinePatternKind,
  VideoExpressionAnalysis,
  VideoFrameSample,
  VideoMetadata,
} from "./types.ts";
import type { LandmarkList } from "../types.ts";
import { validateVideoMetadata } from "./validate.ts";

/** Expression-frame line contrast must be at least this many times the neutral frames' contrast. UNCALIBRATED. */
export const LINE_CONTRAST_RATIO_THRESHOLD = 1.3;
/** …and at least this fraction of the region's mean brightness, so a near-flat region can't pass on a ratio of tiny numbers. UNCALIBRATED. */
export const LINE_CONTRAST_FLOOR = 0.01;
/** Movement is "consistent" when its coefficient of variation across expression frames is at most this. */
export const CONSISTENT_CV = 0.35;
export const HIGH_STRENGTH_MIN_FRAMES = 3;
/** Borderline half-width (fraction of the contrast-ratio threshold): a ratio within 1.3 ± 10% is insufficient evidence. */
export const LINE_CONTRAST_BORDERLINE_FRACTION = 0.1;
export const LINE_CONTRAST_BAND = thresholdBand(LINE_CONTRAST_RATIO_THRESHOLD, LINE_CONTRAST_BORDERLINE_FRACTION, "atLeast");

const ACTIVE_STATES = Object.keys(MOVEMENT_THRESHOLD_PCT) as ActiveExpressionState[];

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

function insufficientEvidence(state: ActiveExpressionState, reason: string): ExpressionEvidence {
  return {
    type: "dynamic_expression_observation",
    expression: state,
    region: EXPRESSION_REGION[state],
    status: "insufficient_evidence",
    evidence: { neutralFrames: [], expressionFrames: [], movementMetric: MOVEMENT_METRIC[state], movementPct: null },
    strength: null,
    reason,
  };
}

function emptyAnalysis(metadata: VideoMetadata, notes: string[], frames: VideoExpressionAnalysis["frames"] = []): VideoExpressionAnalysis {
  return {
    videoAnalysisVersion: VIDEO_ANALYSIS_VERSION,
    metadata,
    framesSampled: frames.length,
    framesUsable: frames.filter((f) => f.usable).length,
    frames,
    baseline: null,
    classifications: [],
    expressions: ACTIVE_STATES.map((s) => insufficientEvidence(s, notes[0] ?? "No baseline.")),
    linePatterns: [],
    status: "insufficient_evidence",
    notes,
  };
}

interface Contrast {
  kind: LinePatternKind;
  expression: ActiveExpressionState;
  measure: (lm: LandmarkList, gray: GrayImage) => number | null;
}

function averageDefined(values: (number | null)[]): number | null {
  const ok = values.filter((v): v is number => v !== null);
  return ok.length === 0 ? null : mean(ok);
}

const CONTRASTS: Contrast[] = [
  {
    kind: "forehead",
    expression: "BROW_RAISE",
    measure: (lm, gray) => {
      const r = foreheadRegion(lm, gray);
      return r ? lineBandContrast(gray, r, "horizontal") : null;
    },
  },
  {
    kind: "glabellar",
    expression: "FROWN",
    measure: (lm, gray) => {
      const r = glabellarRegion(lm, gray);
      return r ? lineBandContrast(gray, r, "vertical") : null;
    },
  },
  ...(["SMILE", "SQUINT"] as const).map(
    (expression): Contrast => ({
      kind: "lateralEye",
      expression,
      measure: (lm, gray) => averageDefined(lateralEyeRegions(lm, gray).map((r) => (r ? localTextureContrast(gray, r) : null))),
    }),
  ),
];

function linePatternFor(
  c: Contrast,
  evidence: ExpressionEvidence,
  neutralIdx: number[],
  samples: Map<number, VideoFrameSample>,
): LinePatternEvidence {
  const base = {
    kind: c.kind,
    mode: "DYNAMIC_VIDEO_EVIDENCE" as const,
    expression: c.expression,
    neutralFrames: [] as number[],
    expressionFrames: [] as number[],
    contrastRatio: null,
    neutralContrast: null,
    expressionContrast: null,
  };
  if (evidence.status !== "observed") {
    return { ...base, status: "insufficient_evidence", reason: `No reliable ${c.expression.toLowerCase().replace("_", " ")} frames to compare against neutral.` };
  }
  const contrastOf = (idx: number[]) => {
    const used: number[] = [];
    const values: number[] = [];
    for (const i of idx) {
      const s = samples.get(i);
      if (!s?.gray || !s.landmarks) continue;
      const v = c.measure(s.landmarks, s.gray);
      if (v !== null) {
        used.push(i);
        values.push(v);
      }
    }
    return { used, mean: values.length ? mean(values) : null };
  };
  const neutral = contrastOf(neutralIdx);
  const expr = contrastOf(evidence.evidence.expressionFrames);
  if (neutral.mean === null || expr.mean === null) {
    return { ...base, status: "insufficient_evidence", reason: "Pixel data for the region was not available in both neutral and expression frames." };
  }
  // The floor keeps a perfectly flat neutral region from producing an infinite ratio.
  const ratio = expr.mean / Math.max(neutral.mean, LINE_CONTRAST_FLOOR);
  const band = classifyAgainstBand(ratio, LINE_CONTRAST_BAND, "atLeast");
  const observed = band === "PASSES" && expr.mean >= LINE_CONTRAST_FLOOR;
  return {
    ...base,
    neutralFrames: neutral.used,
    expressionFrames: expr.used,
    contrastRatio: ratio,
    neutralContrast: neutral.mean,
    expressionContrast: expr.mean,
    status: observed ? "observed" : "insufficient_evidence",
    reason: observed
      ? "Line contrast in this region was clearly higher in expression frames than in neutral frames of the same video."
      : band === "BORDERLINE"
        ? "Line contrast was close to the threshold, so it is treated as insufficient evidence rather than a coin-flip observation."
        : "Line contrast in this region did not clearly differ between neutral and expression frames.",
  };
}

export function analyzeVideoFrames(metadata: VideoMetadata, samples: VideoFrameSample[]): VideoExpressionAnalysis {
  const metaCheck = validateVideoMetadata(metadata);
  if (!metaCheck.valid) return emptyAnalysis(metadata, metaCheck.errors);

  const frames = samples.map(assessFrame);
  const usable: { index: number; features: ExpressionFeatures }[] = [];
  for (const [i, f] of frames.entries()) {
    if (!f.usable) continue;
    const s = samples[i];
    const features = s.landmarks ? computeExpressionFeatures(s.landmarks, s.imageWidth, s.imageHeight) : null;
    if (features) usable.push({ index: s.index, features });
    else {
      f.usable = false;
      f.reasons.push("Expression landmarks could not be measured in this frame.");
    }
  }

  if (usable.length === 0) return emptyAnalysis(metadata, ["No frame of the video had a single, clear, front-facing face."], frames);

  const { baseline, note } = establishBaseline(usable);
  const notes = [...metaCheck.warnings, ...(note ? [note] : [])];
  if (!baseline) return emptyAnalysis(metadata, notes.length ? notes : ["No neutral baseline."], frames);

  const classifications: FrameExpression[] = usable.map((u) => classifyFrame(u.index, u.features, baseline));
  const byIndex = new Map(samples.map((s) => [s.index, s]));
  const neutralIdx = classifications.filter((c) => c.state === "NEUTRAL").map((c) => c.index);

  const expressions = ACTIVE_STATES.map((state): ExpressionEvidence => {
    const hits = classifications.filter((c) => c.state === state);
    if (hits.length === 0) {
      return insufficientEvidence(state, `No frame could be reliably identified as ${state.toLowerCase().replace("_", " ")}.`);
    }
    const pcts = hits.map((h) => h.movementPct[state]);
    const avg = mean(pcts);
    const cv = avg === 0 ? Infinity : Math.sqrt(mean(pcts.map((p) => (p - avg) ** 2))) / Math.abs(avg);
    const strength = !baseline.stable
      ? ("low" as const)
      : hits.length >= HIGH_STRENGTH_MIN_FRAMES && cv <= CONSISTENT_CV
        ? ("high" as const)
        : ("moderate" as const);
    return {
      type: "dynamic_expression_observation",
      expression: state,
      region: EXPRESSION_REGION[state],
      status: "observed",
      evidence: {
        neutralFrames: baseline.frames,
        expressionFrames: hits.map((h) => h.index),
        movementMetric: MOVEMENT_METRIC[state],
        movementPct: avg,
      },
      strength,
      reason: `${hits.length} frame(s) showed ${MOVEMENT_METRIC[state]} of ${avg.toFixed(1)}% on average.`,
    };
  });

  const linePatterns = CONTRASTS.map((c) => linePatternFor(c, expressions.find((e) => e.expression === c.expression)!, neutralIdx, byIndex));

  return {
    videoAnalysisVersion: VIDEO_ANALYSIS_VERSION,
    metadata,
    framesSampled: frames.length,
    framesUsable: frames.filter((f) => f.usable).length,
    frames,
    baseline,
    classifications,
    expressions,
    linePatterns,
    status: "analyzed",
    notes,
  };
}
