import type { ExpressionAnalysis } from "./types.ts";
import type { ActiveExpressionState, ExpressionEvidence, LinePatternKind } from "../facial-analysis/video/types.ts";

const EXPRESSIONS: Record<ActiveExpressionState, string> = {
  BROW_RAISE: "Brow raise", FROWN: "Frown", SMILE: "Smile", SQUINT: "Squint",
};
const PATTERNS: Record<LinePatternKind, string> = {
  forehead: "forehead", glabellar: "between the eyebrows", lateralEye: "outer eye area",
};
const REGIONS = { BROW_RAISE: "FOREHEAD", FROWN: "GLABELLA", SMILE: "MOUTH_AREA", SQUINT: "EYE_AREA" };
const PATTERN_EXPRESSIONS: Record<LinePatternKind, ActiveExpressionState[]> = {
  forehead: ["BROW_RAISE"], glabellar: ["FROWN"], lateralEye: ["SMILE", "SQUINT"],
};
const validFrames = (frames: unknown): frames is number[] => Array.isArray(frames) && frames.length > 0 &&
  frames.every(frame => Number.isInteger(frame) && frame >= 0);

/** Bounded, traceable descriptions only; thresholds are not clinically calibrated. */
export function expressionContext(analysis?: ExpressionAnalysis | null) {
  const supplied = !!analysis && analysis.status !== "not_provided";
  const usable = analysis?.status === "analyzed";
  const movements = Object.entries(EXPRESSIONS).map(([key, label]) => {
    const matching = analysis?.expressions?.filter(row => row.expression === key) ?? [];
    const row = matching.length === 1 ? matching[0] : undefined;
    const observed = usable && row?.status === "observed" && row.region === REGIONS[key as ActiveExpressionState] &&
      validFrames(row.evidence?.neutralFrames) && validFrames(row.evidence?.expressionFrames) &&
      Number.isFinite(row.evidence?.movementPct) && row.evidence.movementPct! >= 0 &&
      ["low", "moderate", "high"].includes(row.strength ?? "");
    const evidence = observed ? row as ExpressionEvidence : null;
    return { key: key as ActiveExpressionState, label, evidence,
      reliable: !!evidence && ["moderate", "high"].includes(evidence.strength!),
      text: evidence
        ? `${label}: movement observed versus neutral (${evidence.strength} evidence completeness).`
        : `${label}: no usable comparison; this does not mean movement is absent.` };
  });
  const patterns = Object.entries(PATTERNS).flatMap(([kind, label]) => {
    const matches = analysis?.linePatterns?.filter(row => row.kind === kind) ?? [];
    // Smile and squint legitimately supply separate outer-eye comparisons.
    if (!usable || new Set(matches.map(row=>row.expression)).size !== matches.length) return [];
    const supported = matches.some(row => row.mode === "DYNAMIC_VIDEO_EVIDENCE" && row.status === "observed" &&
      validFrames(row.neutralFrames) && validFrames(row.expressionFrames) &&
      Number.isFinite(row.contrastRatio) && row.contrastRatio! > 1 &&
      PATTERN_EXPRESSIONS[kind as LinePatternKind].includes(row.expression) &&
      movements.some(movement => movement.reliable && movement.key === row.expression));
    if (!supported) return [];
    return [{kind: kind as LinePatternKind, text: `The ${label} region showed greater line contrast during expression than at rest.`}];
  });
  const observedCount = movements.filter(movement => movement.evidence).length;
  const status = !supplied ? "not_provided" : usable && observedCount ? "usable" : "inconclusive";
  return {status, movements, patterns,
    summary: status === "not_provided" ? "No expression video was supplied. No movement findings are inferred from still photographs."
      : status === "inconclusive" ? "A video was supplied, but usable neutral-to-expression movement comparisons could not be established."
      : `${observedCount} of 4 expression comparisons had usable movement evidence. Missing expressions remain unassessed.`,
  };
}
