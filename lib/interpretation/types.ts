/**
 * The interpretation layer's data model.
 *
 * An InterpretationResult turns the EXISTING structured evidence
 * (questionnaire signals, observations, treatment opportunities) into
 * consumer-safe statements. It invents nothing: every statement carries
 * explicit evidence references, each of which must resolve to something in
 * the InterpretationInput it was built from (validate.ts enforces this,
 * including for anything an AI provider returns).
 *
 * It never diagnoses, never says a person needs or suits a treatment, and
 * never scores a face. The clinician remains the final decision-maker.
 */

import type { TreatmentCategory } from "../treatment-opportunities/types.ts";
import type { Observation } from "../observation/types.ts";
import type { TreatmentOpportunity } from "../treatment-opportunities/types.ts";

export const EVIDENCE_SOURCE_TYPES = ["questionnaire", "visual_observation", "treatment_opportunity", "assessment"] as const;
export type EvidenceSourceType = (typeof EVIDENCE_SOURCE_TYPES)[number];

/** A pointer to the thing a statement rests on. `sourceId` is internal — it is never shown to consumers. */
export interface EvidenceRef {
  sourceType: EvidenceSourceType;
  /** questionnaire: a normalized signal id (e.g. "user_reports_facial_definition_goal"); visual_observation: an Observation id; treatment_opportunity: an opportunity id; assessment: the assessment id. */
  sourceId: string;
}

/** An evidence ref plus a human label, for the audit list on the result. */
export interface EvidenceEntry extends EvidenceRef {
  label: string;
}

export interface InterpretationStatement {
  id: string;
  statement: string;
  /** Never empty. */
  evidence: EvidenceRef[];
}

export const INTERPRETATION_AREAS = [
  "facial_lines",
  "facial_definition",
  "facial_volume",
  "facial_lifting",
  "under_eye",
  "skin",
  "facial_balance",
  "overall",
] as const;
export type InterpretationArea = (typeof INTERPRETATION_AREAS)[number];

export interface InterpretationPriority {
  id: string;
  /** Consumer wording, e.g. "A more defined appearance". */
  label: string;
  evidence: EvidenceRef[];
}

/**
 *   discuss               — a consumer-ready treatment opportunity supports discussing this area with a clinician.
 *   observation_only      — a usable visual observation is described; no treatment is implied.
 *   insufficient_evidence — the goal was recorded but the evidence to interpret it does not exist (or is not consumer-ready).
 */
export type AreaStatus = "discuss" | "observation_only" | "insufficient_evidence";

export interface InterpretationOpportunity {
  id: string;
  area: InterpretationArea;
  /** Consumer wording, e.g. "Facial definition". */
  title: string;
  status: AreaStatus;
  statement: string;
  /** Internal only — set for "discuss" and always matches a treatment opportunity in the input. Never shown as a recommendation. */
  category: TreatmentCategory | null;
  evidence: EvidenceRef[];
}

export interface InterpretationSection {
  statements: InterpretationStatement[];
}

export interface InterpretationResult {
  version: string;
  createdAt: string;
  summary: InterpretationStatement;
  priorities: InterpretationPriority[];
  facialStructure: InterpretationSection;
  eyeArea: InterpretationSection;
  skin: InterpretationSection;
  hair: InterpretationSection;
  facialHair: InterpretationSection;
  lifestyle: InterpretationSection;
  style: InterpretationSection;
  opportunities: InterpretationOpportunity[];
  /** Consumer-safe limitations, always non-empty. */
  limitations: string[];
  /** Audit list of every distinct evidence ref used above, with labels. */
  evidence: EvidenceEntry[];
  clinicianReviewRequired: true;
  /** The premium personalised report, built from the same evidence. See report.ts. */
  report: MogaFaceReport;
}

/** One user-stated goal/concern, already normalized. */
export interface UserGoal {
  /** Evidence id: a normalized appearance-concern signal id, or "goals.priorities.<id>" for the older broad goals. */
  sourceId: string;
  area: InterpretationArea | null;
  /** Consumer-facing wording for a priority list. */
  label: string;
  isPriority: boolean;
  /** True for a refinement (e.g. "Forehead lines") rather than the concern itself. */
  isDetail: boolean;
}

/**
 * Everything an interpretation provider — local or AI — is allowed to see.
 * Structured evidence only: never raw assessment state, never age, gender,
 * height, weight, images, or landmark arrays.
 */
export interface InterpretationInput {
  assessmentId: string;
  goals: UserGoal[];
  /** Validated observations (measured and user-reported). Consumer-usability of each is decided from its id, not trusted from here. */
  observations: Observation<unknown>[];
  opportunities: TreatmentOpportunity[];
  /** Technical limitations from the analysis (for a provider's context; consumers see InterpretationResult.limitations). */
  limitations: string[];
  /** When the assessment was started (ISO). Used only for the report's date line. Never sent to a model. */
  assessmentCreatedAt?: string;
  /** Internal provenance of the analysis that produced the evidence. Never shown to consumers or sent to a model. */
  methodologyVersions?: Record<string, string | null>;
}

export interface InterpretationProvider {
  /** Stable id, e.g. "local-rules". */
  id: string;
  interpret(input: InterpretationInput): Promise<InterpretationResult>;
}

// ---------------------------------------------------------------------------
// The personalised report
// ---------------------------------------------------------------------------

/**
 * Where a report statement's content comes from:
 *   user_reported — the person's own answers ("Your assessment reports…")
 *   observed      — a computer-vision observation ("MogaFace observed…")
 *   opportunity   — a treatment opportunity produced by the existing engine
 *   limitation    — an honest statement that evidence is missing or unsupported
 */
export const REPORT_SOURCE_TYPES = ["user_reported", "observed", "opportunity", "limitation"] as const;
export type ReportSourceType = (typeof REPORT_SOURCE_TYPES)[number];

/** Evidence completeness/availability ONLY — never a probability that a claim is true. */
export const EVIDENCE_LEVELS = ["complete", "partial", "limited"] as const;
export type EvidenceLevel = (typeof EVIDENCE_LEVELS)[number];

export interface ReportStatement {
  id: string;
  text: string;
  /** Never empty. Every reference must resolve to something in the InterpretationInput. */
  evidenceRefs: EvidenceRef[];
  confidence: EvidenceLevel;
  sourceType: ReportSourceType;
}

/** How a report section's content was obtained — drives the label the reader sees. */
export type SectionBasis = "observed" | "user_reported" | "not_assessed";

export interface ReportSection {
  basis: SectionBasis;
  /** Never empty: a section with no evidence carries an honest limitation statement instead. */
  statements: ReportStatement[];
  /** Plain-language description of how the content was obtained; null when nothing was measured. */
  howAssessed: string | null;
}

export interface ReportPriority {
  id: string;
  /** Consumer wording, e.g. "A more defined appearance". */
  concern: string;
  why: ReportStatement;
  evidence: ReportStatement;
  status: "discuss" | "observation_only" | "recorded";
}

export interface ReportOpportunity {
  id: string;
  area: InterpretationArea;
  title: string;
  status: AreaStatus;
  /** Why this area appeared. */
  why: ReportStatement;
  /** Plain-language description of the evidence behind it (no ids, no numbers). */
  evidenceLines: string[];
  /** What the clinician can evaluate — fixed wording, never a treatment claim. */
  clinicianCanEvaluate: string;
  /** Internal only — matches the backing treatment opportunity for "discuss". */
  category: TreatmentCategory | null;
}

export interface MogaFaceReport {
  overview: ReportStatement;
  /** At most 3. */
  priorities: ReportPriority[];
  sections: {
    facialStructure: ReportSection;
    eyeArea: ReportSection;
    /** Null unless valid, consumer-usable expression evidence exists. */
    expression: ReportSection | null;
    skin: ReportSection;
    hair: ReportSection;
    facialHair: ReportSection;
    lifestyle: ReportSection;
    style: ReportSection;
  };
  opportunities: ReportOpportunity[];
  /** Non-empty. */
  limitations: string[];
  clinicianReview: string;
  cta: { heading: string; supportingText: string };
}
