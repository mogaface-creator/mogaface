/**
 * Prompt construction for the AI interpretation provider.
 *
 * Fixes the contract: what a model may see, what it must return, and the rules
 * it must follow. The rules here are advisory — validate.ts enforces them on
 * whatever comes back, and a response that breaks them is discarded.
 */

import { AI_EDITABLE_SECTIONS } from "./immutable.ts";
import type { InterpretationInput, MogaFaceReport } from "./types.ts";

export const INTERPRETATION_SYSTEM_PROMPT = [
  "You are the MogaFace report wording assistant.",
  "",
  "MogaFace has already performed the analysis. You are not performing analysis. You are not a clinician.",
  "Everything you receive is STRUCTURED EVIDENCE produced by MogaFace, in the form of a draft report. You must only rewrite and organize information supplied by MogaFace.",
  "",
  "Every factual statement must remain supported by the evidence references it was given.",
  "Never add a new finding. Never create a treatment opportunity. Never diagnose. Never prescribe.",
  "Never assess treatment suitability or candidacy. Never assess attractiveness. Never create a beauty score.",
  "Never infer a medical cause. Never name a treatment, product or brand. Never promise an outcome.",
  "Never invent measurements. Never invent numbers: give no dose, percentage or number that is not already in the draft. Never invent evidence.",
  "Never change evidence references, confidence, opportunity status, category or consumer readiness.",
  "Treatment-related wording must remain conservative. The deterministic MogaFace report is the source of truth.",
  "",
  "When discussing treatment-related areas, preserve the wording 'may be worth discussing with your clinician'.",
  "If evidence is insufficient, preserve the limitation exactly as written. Do not fill a gap with generic content.",
  "",
  "Write in a premium, clear, calm, personalized editorial style. Do not exaggerate. Do not flatter the user. Do not use generic beauty language or unnecessary medical terminology.",
  "Make the report feel personal because it accurately reflects the user's supplied goals and evidence, not because you invent personal details.",
  "Prefer 'Your analysis shows…', 'Your assessment indicates…', 'Your submitted views provide…'. Never write 'You have poor…', 'You need…', 'Your face would benefit from…'.",
  "",
  "OUTPUT: return ONLY one JSON object with exactly the structure of the draft you were given (overview, priorities, sections, opportunities). No markdown, no HTML, no links, no commentary.",
  "Keep every id, evidenceRefs entry, sourceType, confidence, concern, title, status, category, area, basis, howAssessed, evidenceLines and clinicianCanEvaluate exactly as given, and keep every statement whose sourceType is 'limitation' exactly as given.",
  "You may change only the `text` of the other statements, and their order within a section. Keep each `text` close to the length of the draft.",
].join("\n");

/** Marks where the draft begins in the user message (tests and the adapter rely on it). */
export const DRAFT_MARKER = "Draft report (rewrite the wording only):\n";

/** Stands in for the real assessment id, which a model has no need to see. */
export const ASSESSMENT_TOKEN = "assessment";

type Walkable = unknown;
/** Applies `fn` to every evidence reference of type "assessment" inside `value` (returns a copy). */
function mapAssessmentRefs(value: Walkable, fn: (ref: { sourceType: string; sourceId: string }) => string): Walkable {
  if (Array.isArray(value)) return value.map((v) => mapAssessmentRefs(v, fn));
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) out[k] = mapAssessmentRefs(v, fn);
    if (o.sourceType === "assessment" && typeof o.sourceId === "string") out.sourceId = fn(o as { sourceType: string; sourceId: string });
    return out;
  }
  return value;
}

/** What a model may see and reword: overview, priorities, four findings sections, areas. No questionnaire-only sections, no limitations copy, no CTA. */
export function editableDraft(report: MogaFaceReport, assessmentId: string): Record<string, unknown> {
  const sections: Record<string, unknown> = {};
  for (const key of AI_EDITABLE_SECTIONS) sections[key] = report.sections[key] ?? null; // null = "no evidence for this section" (the schema allows it for expression only)
  const subset = { overview: report.overview, priorities: report.priorities, sections, opportunities: report.opportunities };
  return mapAssessmentRefs(subset, (r) => (r.sourceId === assessmentId ? ASSESSMENT_TOKEN : r.sourceId)) as Record<string, unknown>;
}

/** Puts the real assessment id back into a model's answer before it is compared with the draft. */
export function restoreAssessmentId(value: unknown, assessmentId: string): unknown {
  return mapAssessmentRefs(value, (r) => (r.sourceId === ASSESSMENT_TOKEN ? assessmentId : r.sourceId));
}

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

/**
 * `draft` is the deterministic report the local rules built from the same
 * input. Only its editable part is sent (see editableDraft): no photos, no
 * image references, no landmarks, no observation values, no age, gender, body
 * measurements or identifiers — and no questionnaire-only sections (hair,
 * facial hair, lifestyle, style), which are kept verbatim and never leave the
 * server. What remains are goal and finding sentences and evidence ids.
 * Without a draft (legacy callers) only the narrow evidence summary is returned.
 */
export function buildInterpretationPrompt(input: InterpretationInput, draft?: MogaFaceReport): { system: string; user: string } {
  if (!draft) return { system: INTERPRETATION_SYSTEM_PROMPT, user: `Evidence:\n${serializeEvidenceForModel(input)}` };
  return { system: INTERPRETATION_SYSTEM_PROMPT, user: `${DRAFT_MARKER}${JSON.stringify(editableDraft(draft, input.assessmentId), null, 1)}` };
}
