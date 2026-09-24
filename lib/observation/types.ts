/**
 * The observation layer's core data model.
 *
 * This sits ABOVE both lib/assessment/ and lib/facial-analysis/ — it reads
 * their output and re-expresses it with explicit provenance, but never
 * recalculates a measurement or reinterprets a questionnaire answer.
 * Nothing here classifies anything as attractive/unattractive, good/bad,
 * masculine/feminine, or produces a score of any kind. See
 * OBSERVATION_ENGINE.md for the full rationale.
 */

import type { ExpressionEvidence, LinePatternEvidence } from "../facial-analysis/video/types.ts";

export type ObservationSourceType = "measured" | "user_reported" | "inferred";

/**
 * Deliberately just these three states — never a fabricated percentage.
 *   - "not_calibrated": a real measurement exists, but this app has no
 *     statistical confidence model for it (see FACIAL_ANALYSIS_METHODOLOGY.md).
 *   - "self_reported": the user answered a question; the platform has not
 *     verified it.
 *   - "not_available": there is no observation to have confidence in yet.
 */
export type ConfidenceState = "not_calibrated" | "self_reported" | "not_available";

export type AnalysisDomain =
  | "facial-structure"
  | "eye-area"
  | "hair"
  | "facial-hair"
  | "skin"
  | "lifestyle"
  | "style"
  | "expression";

/** A single piece of provenance-tracked information. */
export interface Observation<T> {
  id: string;
  domain: AnalysisDomain;
  /** Human-readable label for display (dev view, future consumer report). */
  label: string;
  type: ObservationSourceType;
  value: T;
  /** e.g. "front" for a measured value, "user" for a questionnaire answer. */
  source: string;
  confidence: ConfidenceState;
  methodologyVersion: string;
  createdAt: string;
}

export interface EvidenceRef {
  type: "measurement" | "questionnaire";
  id: string;
}

/**
 * Represents "this domain could eventually support an inference here, but
 * no defensible methodology exists yet" — never a real conclusion. Every
 * field is filled in honestly: status is always "not_available" today,
 * evidence is always empty, methodology is always null. This type exists so
 * the architecture is visible without fabricating a value (see Step 21 of
 * the Step 2 brief's spirit, applied here to inference rather than pose).
 */
export interface InferencePlaceholder {
  id: string;
  domain: AnalysisDomain;
  observationType: "inferred";
  status: "not_available";
  evidence: EvidenceRef[];
  methodology: string | null;
}

export interface FacialStructureAnalysis {
  measured: Observation<number>[];
  inferences: InferencePlaceholder[];
}

export interface EyeAreaAnalysis {
  measured: Observation<number>[];
  /**
   * Appearance-only visual observations (value `true` = present in this photo), e.g. "visible
   * dark-looking under-eye appearance". Empty unless a front photo with an under-eye measurement exists.
   */
  visual: Observation<boolean>[];
  /** Under-eye categories deliberately NOT measured, each with the reason — never silently omitted. */
  notMeasured: { id: string; label: string; reason: string }[];
  /** Empty today — the assessment does not currently collect glasses use, eyebrow grooming preference, or eye-area concerns. */
  userReported: Observation<string>[];
  /** Empty — no defensible methodology exists for eye-shape classification from landmark thresholds. */
  inferences: InferencePlaceholder[];
}

/**
 * Dynamic expression evidence from the optional video. Every observation is
 * traceable to sampled video frames (`source` = "video_frame_<i>+…").
 */
export interface ExpressionAnalysis {
  /** "not_provided": no video was given. "insufficient_evidence": one was, but no neutral baseline could be established. */
  status: "not_provided" | "analyzed" | "insufficient_evidence";
  /** Measured movement (numbers) and line-contrast observations (numbers, and `true` for a visible pattern). */
  measured: Observation<number | boolean>[];
  expressions: ExpressionEvidence[];
  linePatterns: LinePatternEvidence[];
  notes: string[];
}

export interface HairAnalysis {
  userReported: Observation<string | string[]>[];
  /** Empty — no computer-vision hair analysis exists. */
  inferences: InferencePlaceholder[];
}

export interface FacialHairAnalysis {
  userReported: Observation<string | string[]>[];
  /** Empty — no computer-vision facial-hair analysis (e.g. density from photo) exists. */
  inferences: InferencePlaceholder[];
}

export interface SkinAnalysis {
  status: "not_implemented";
  /** Empty today — the assessment does not currently collect skin concerns. */
  userReported: Observation<string>[];
  /** Always null — placeholder for a future visual/computer-vision layer. */
  visualObservations: null;
  /** Always null — placeholder for a future image-analysis layer. */
  imageAnalysisResults: null;
  inferences: InferencePlaceholder[];
}

export interface LifestyleAnalysis {
  userReported: Observation<string | string[]>[];
}

export interface StyleAnalysis {
  userReported: Observation<string | string[]>[];
}

export interface MogaFaceAnalysisVersions {
  facialAnalysisMethodologyVersion: string;
  observationEngineVersion: string;
  analysisVersion: string;
  multiPhotoAnalysisVersion: string | null;
  /** Null when no video was analyzed. */
  videoAnalysisVersion: string | null;
  assessmentVersion: string;
}

export interface MogaFaceAnalysis {
  assessmentId: string;
  assessmentCreatedAt: string;
  createdAt: string;

  facialStructure: FacialStructureAnalysis;
  eyeArea: EyeAreaAnalysis;
  expression: ExpressionAnalysis;
  hair: HairAnalysis;
  facialHair: FacialHairAnalysis;
  skin: SkinAnalysis;
  lifestyle: LifestyleAnalysis;
  style: StyleAnalysis;

  /** Every Observation across every domain, flattened, for easy iteration (dev view, future export). */
  observations: Observation<unknown>[];
  limitations: string[];
  versions: MogaFaceAnalysisVersions;
}
