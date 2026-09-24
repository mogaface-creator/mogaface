import { buildConcernSignals, videoObservationsFrom } from "./evidence.ts";
import { TREATMENT_RULES } from "./rules.ts";
import { validateOpportunity } from "./validate.ts";
import { CONCERN_SIGNAL_KINDS } from "./types.ts";
import type { Assessment } from "../assessment/types.ts";
import type { MogaFaceAnalysis } from "../observation/types.ts";
import type { EvaluationContext, TreatmentOpportunity, VideoObservation } from "./types.ts";

export interface TreatmentEngineInput {
  assessment: Assessment;
  /** Null when photos have not been analyzed yet. */
  analysis: MogaFaceAnalysis | null;
  /**
   * Extra video evidence supplied directly. Normally omitted: video evidence
   * is derived from the expression observations already in `analysis`.
   */
  videoObservations?: VideoObservation[];
}

export function buildEvaluationContext(input: TreatmentEngineInput): EvaluationContext {
  const observations = Array.isArray(input.analysis?.observations) ? input.analysis.observations : [];
  return {
    photoAnalysisAvailable: observations.some((o) => o.type === "measured"),
    videoAnalyzed: input.analysis?.expression?.status === "analyzed" || input.analysis?.expression?.status === "insufficient_evidence",
    signals: buildConcernSignals(input.assessment),
    observations,
    videoObservations: [
      ...videoObservationsFrom(observations),
      ...(Array.isArray(input.videoObservations) ? input.videoObservations : []),
    ].filter((v) => v && typeof v.id === "string" && v.id.length > 0 && (CONCERN_SIGNAL_KINDS as readonly unknown[]).includes(v.supports)),
  };
}

/**
 * Runs every rule and returns the opportunities in rule order. Pure apart
 * from createdAt timestamps. Malformed rule output is dropped rather than
 * returned, and duplicates (same concern + category) keep the first.
 * Returns [] when no rule has a user goal to work from — the conservative default.
 */
export function evaluateTreatmentOpportunities(input: TreatmentEngineInput): TreatmentOpportunity[] {
  const ctx = buildEvaluationContext(input);
  const seen = new Set<string>();
  const out: TreatmentOpportunity[] = [];

  for (const rule of TREATMENT_RULES) {
    for (const opportunity of rule.evaluate(ctx)) {
      if (validateOpportunity(opportunity).length > 0 || seen.has(opportunity.id)) continue;
      seen.add(opportunity.id);
      out.push(opportunity);
    }
  }
  return out;
}
