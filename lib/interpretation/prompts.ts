/**
 * Prompt construction for a FUTURE AI interpretation provider.
 *
 * Nothing calls a model today (no key, no network). This module exists so the
 * contract is fixed before a provider is connected: what a model may see, what
 * it must return, and the rules it must follow. The rules here are advisory —
 * validate.ts enforces them on whatever comes back, and a response that breaks
 * them is discarded.
 */

import type { InterpretationInput } from "./types.ts";

export const INTERPRETATION_SYSTEM_PROMPT = [
  "You write short, plain-language statements for a consumer facial assessment report.",
  "You are given STRUCTURED EVIDENCE only. Use nothing else and add nothing.",
  "Every statement you write MUST list evidence references (sourceType + sourceId) that appear in the evidence you were given.",
  "Only mention a treatment category if a supplied treatment opportunity with consumerReady=true and status=potential_opportunity supports it, and cite that opportunity.",
  "Never say a person needs, should get, is suitable for, or is a candidate for any treatment. Use wording like: 'may be worth discussing with your clinician'.",
  "Never diagnose, name a medical or skin condition, state a cause, or refer to aging.",
  "Never give a score, percentage, or rating of attractiveness, symmetry, or anything else. Never compare a face to an ideal.",
  "Never predict a treatment outcome. The clinician is the final decision-maker.",
  "If evidence for a goal is missing or not consumer-ready, say there is not enough visual evidence — do not guess.",
  "Return JSON matching the InterpretationResult schema exactly, with clinicianReviewRequired: true.",
].join("\n");

/**
 * The structured evidence handed to a model. Deliberately narrow: goals,
 * usable observations (id + label + source only — no raw numbers), treatment
 * opportunities (no internal thresholds), limitations. No age, gender, body
 * measurements, images, landmarks, or database state.
 */
export function serializeEvidenceForModel(input: InterpretationInput): string {
  return JSON.stringify(
    {
      assessmentId: input.assessmentId,
      goals: input.goals.map((g) => ({ sourceId: g.sourceId, area: g.area, label: g.label, isPriority: g.isPriority })),
      observations: input.observations.map((o) => ({ id: o.id, label: o.label, type: o.type, source: o.source })),
      opportunities: input.opportunities.map((o) => ({
        id: o.id,
        status: o.status,
        category: o.category,
        consumerReady: o.consumerReady,
        evidenceObservationIds: o.evidenceObservationIds,
        evidenceQuestionIds: o.evidenceQuestionIds,
      })),
      limitations: input.limitations,
    },
    null,
    2,
  );
}

export function buildInterpretationPrompt(input: InterpretationInput): { system: string; user: string } {
  return { system: INTERPRETATION_SYSTEM_PROMPT, user: `Evidence:\n${serializeEvidenceForModel(input)}` };
}
