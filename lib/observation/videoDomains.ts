/**
 * The expression domain — observations derived from the optional video.
 *
 * Every observation names the sampled frames it came from
 * ("video_frame_3+video_frame_14"), so nothing is untraceable. Movement is
 * reported as a number (a % change of landmark geometry versus the same
 * video's neutral frames); a "visible line pattern" is `true` only when the
 * region's line contrast was higher in expression frames than in neutral
 * frames (see video/observe.ts for the uncalibrated thresholds). Absence of
 * an observation means "not evidenced", never "not present".
 */

import { measuredObservation } from "./helpers.ts";
import { frameId } from "../facial-analysis/video/sampling.ts";
import type { ActiveExpressionState, LinePatternKind, VideoExpressionAnalysis } from "../facial-analysis/video/types.ts";
import type { ExpressionAnalysis, Observation } from "./types.ts";

const MOVEMENT_OBSERVATIONS: Record<ActiveExpressionState, { id: string; label: string }> = {
  BROW_RAISE: { id: "expression.browRaise.foreheadRegionMovementPct", label: "Brow raise: brow-to-eye distance change vs neutral (%)" },
  FROWN: { id: "expression.frown.glabellarRegionMovementPct", label: "Frown: inner-brow closeness change vs neutral (%)" },
  SMILE: { id: "expression.smile.mouthAreaMovementPct", label: "Smile: mouth width change vs neutral (%)" },
  SQUINT: { id: "expression.squint.eyeAreaMovementPct", label: "Squint: eye-opening decrease vs neutral (%)" },
};

const PATTERN_OBSERVATIONS: Record<LinePatternKind, { id: string; label: string }> = {
  forehead: { id: "expression.visibleForeheadLinePattern", label: "Visible forehead line pattern (brow raise vs neutral, video)" },
  glabellar: { id: "expression.visibleGlabellarLinePattern", label: "Visible glabellar line pattern (frown vs neutral, video)" },
  lateralEye: { id: "expression.visibleLateralEyeLinePattern", label: "Visible lateral eye line pattern (smile/squint vs neutral, video)" },
};

/** Ids of the observations that report measured expression movement (used by the engine as video evidence). */
export const EXPRESSION_MOVEMENT_OBSERVATION_IDS: readonly string[] = Object.values(MOVEMENT_OBSERVATIONS).map((m) => m.id);
/** Ids of the "visible line pattern" observations. */
export const LINE_PATTERN_OBSERVATION_IDS: readonly string[] = Object.values(PATTERN_OBSERVATIONS).map((p) => p.id);

const sourceOf = (frames: number[]) => [...new Set(frames)].sort((a, b) => a - b).map(frameId).join("+");

export function buildExpressionAnalysis(video: VideoExpressionAnalysis | null): ExpressionAnalysis {
  if (!video) return { status: "not_provided", measured: [], expressions: [], linePatterns: [], notes: [] };

  const measured: Observation<number | boolean>[] = [];
  const add = (id: string, label: string, value: number | boolean, frames: number[]) =>
    measured.push(measuredObservation({ id, domain: "expression", label, value, source: sourceOf(frames) }));

  for (const e of video.expressions) {
    if (e.status !== "observed" || e.evidence.movementPct === null) continue;
    const m = MOVEMENT_OBSERVATIONS[e.expression];
    add(m.id, m.label, e.evidence.movementPct, [...e.evidence.neutralFrames, ...e.evidence.expressionFrames]);
  }

  const observedKinds = new Set<LinePatternKind>();
  for (const p of video.linePatterns) {
    if (p.contrastRatio !== null && Number.isFinite(p.contrastRatio) && p.neutralFrames.length + p.expressionFrames.length > 0) {
      add(`expression.lineContrastRatio.${p.kind}.${p.expression.toLowerCase()}`, `Line contrast, ${p.kind} region: ${p.expression.toLowerCase().replace("_", " ")} vs neutral (ratio)`, p.contrastRatio, [
        ...p.neutralFrames,
        ...p.expressionFrames,
      ]);
    }
    if (p.status === "observed" && !observedKinds.has(p.kind)) {
      observedKinds.add(p.kind);
      add(PATTERN_OBSERVATIONS[p.kind].id, PATTERN_OBSERVATIONS[p.kind].label, true, [...p.neutralFrames, ...p.expressionFrames]);
    }
  }

  return { status: video.status, measured, expressions: video.expressions, linePatterns: video.linePatterns, notes: video.notes };
}
