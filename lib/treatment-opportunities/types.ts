/**
 * The treatment-opportunity layer's data model.
 *
 * This sits ABOVE lib/observation/ and lib/assessment/ — it reads their
 * output and never recalculates a measurement. The flow it encodes is:
 *
 *   OBSERVATION + USER-REPORTED GOAL → CONCERN → POSSIBLE TREATMENT CATEGORY
 *   → CLINICIAN ASSESSMENT REQUIRED
 *
 * An opportunity is never a diagnosis, a recommendation, or a suitability
 * claim — only "this may be worth discussing with a qualified clinician".
 * See docs/TREATMENT_OPPORTUNITY_ENGINE.md.
 */

import { isConsumerReady } from "../facial-analysis/calibration/status.ts";
import { TREATMENT_OPPORTUNITY_ENGINE_VERSION } from "./versions.ts";
import type { Observation } from "../observation/types.ts";

export const TREATMENT_CATEGORIES = [
  "NEUROMODULATOR",
  "DERMAL_FILLER",
  "FACIAL_CONTOURING",
  "FACIAL_LIFTING",
  "SKIN_TREATMENT",
  "HAIR_SCALP_ASSESSMENT",
  "CLINIC_CONSULTATION",
] as const;
export type TreatmentCategory = (typeof TREATMENT_CATEGORIES)[number];

export const OPPORTUNITY_STATUSES = ["potential_opportunity", "insufficient_evidence", "not_available"] as const;
export type OpportunityStatus = (typeof OPPORTUNITY_STATUSES)[number];

/** Evidence completeness/strength — never a statistical probability. See CONFIDENCE_MEANING in evidence.ts. */
export const OPPORTUNITY_CONFIDENCES = ["low", "moderate", "high"] as const;
export type OpportunityConfidence = (typeof OPPORTUNITY_CONFIDENCES)[number];

export const TREATMENT_CONCERNS = [
  "dynamic_facial_lines",
  "facial_contour_volume",
  "facial_lifting",
  "skin_appearance",
] as const;
export type TreatmentConcern = (typeof TREATMENT_CONCERNS)[number];

/** Normalized user-goal vocabulary, mapped from the questionnaire in evidence.ts. */
export const CONCERN_SIGNAL_KINDS = [
  "expression_lines",
  "facial_definition",
  "facial_contour",
  "facial_volume",
  "facial_lifting",
  "skin_concern",
  "under_eye",
] as const;
export type ConcernSignalKind = (typeof CONCERN_SIGNAL_KINDS)[number];

export const EVIDENCE_KINDS = ["observation", "questionnaire", "video"] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

/** One traceable input to an opportunity. `source` is the photo view, "video", or "user". */
export interface EvidenceItem {
  kind: EvidenceKind;
  id: string;
  label: string;
  source: string;
}

/**
 * A user goal/concern normalized from the questionnaire. `explicit` means the
 * user named the concern itself; `general` means a broad goal that only
 * indirectly relates to it.
 */
export interface ConcernSignal {
  kind: ConcernSignalKind;
  strength: "explicit" | "general";
  evidence: EvidenceItem[];
}

/**
 * Evidence from a video pipeline. No video analysis exists in MogaFace yet —
 * this is the input contract for when one does; the engine never produces one.
 */
export interface VideoObservation {
  id: string;
  label: string;
  supports: ConcernSignalKind;
}

export interface TreatmentOpportunity {
  id: string;
  concern: TreatmentConcern;
  /** Null unless status is "potential_opportunity" — no category is suggested without evidence. */
  category: TreatmentCategory | null;
  title: string;
  rationale: string;
  /** Source of truth; the two id lists below are derived from it. */
  evidence: EvidenceItem[];
  /** Ids of observation- and video-kind evidence. */
  evidenceObservationIds: string[];
  /** Ids of questionnaire-kind evidence. */
  evidenceQuestionIds: string[];
  status: OpportunityStatus;
  /** Null unless status is "potential_opportunity". */
  confidence: OpportunityConfidence | null;
  limitations: string[];
  /** Always true — the AI never makes the treatment decision. */
  clinicianReviewRequired: true;
  /**
   * False while any cited observation rests on uncalibrated visual evidence
   * (see VISUAL_OBSERVATIONS_CALIBRATED). Consumer-facing surfaces must show
   * only `consumerReady` opportunities; development views may show all.
   */
  consumerReady: boolean;
  methodologyVersion: string;
  createdAt: string;
}

/** Everything a rule may look at — built once per evaluation in evaluate.ts. */
export interface EvaluationContext {
  /** True when at least one photo produced measured observations. */
  photoAnalysisAvailable: boolean;
  /** True when a video was provided and analyzed (even if it yielded no usable evidence). */
  videoAnalyzed: boolean;
  signals: ConcernSignal[];
  observations: Observation<unknown>[];
  videoObservations: VideoObservation[];
}

export function isTreatmentCategory(value: unknown): value is TreatmentCategory {
  return (TREATMENT_CATEGORIES as readonly unknown[]).includes(value);
}
export function isOpportunityStatus(value: unknown): value is OpportunityStatus {
  return (OPPORTUNITY_STATUSES as readonly unknown[]).includes(value);
}
export function isOpportunityConfidence(value: unknown): value is OpportunityConfidence {
  return (OPPORTUNITY_CONFIDENCES as readonly unknown[]).includes(value);
}

export interface NewOpportunity {
  concern: TreatmentConcern;
  category: TreatmentCategory | null;
  title: string;
  rationale: string;
  evidence: EvidenceItem[];
  status: OpportunityStatus;
  confidence: OpportunityConfidence | null;
  limitations: string[];
}

/**
 * The only constructor rules use. It fixes what must never vary —
 * clinicianReviewRequired, methodologyVersion, createdAt, the derived id
 * lists, and a deterministic id (one opportunity per concern+category, so
 * evaluate.ts can drop duplicates). It does not validate; validate.ts does.
 */
export function createOpportunity(input: NewOpportunity): TreatmentOpportunity {
  const unique = (ids: string[]) => [...new Set(ids)];
  return {
    id: `${input.concern}:${input.category ?? input.status}`,
    concern: input.concern,
    category: input.category,
    title: input.title,
    rationale: input.rationale,
    evidence: input.evidence,
    evidenceObservationIds: unique(input.evidence.filter((e) => e.kind !== "questionnaire").map((e) => e.id)),
    evidenceQuestionIds: unique(input.evidence.filter((e) => e.kind === "questionnaire").map((e) => e.id)),
    status: input.status,
    confidence: input.confidence,
    limitations: input.limitations,
    clinicianReviewRequired: true,
    consumerReady: isConsumerReady(unique(input.evidence.filter((e) => e.kind !== "questionnaire").map((e) => e.id))),
    methodologyVersion: TREATMENT_OPPORTUNITY_ENGINE_VERSION,
    createdAt: new Date().toISOString(),
  };
}

/** The only opportunities a consumer-facing surface may show. Development views should use the full list. */
export function selectConsumerOpportunities(opportunities: TreatmentOpportunity[]): TreatmentOpportunity[] {
  return opportunities.filter((o) => o.consumerReady);
}
