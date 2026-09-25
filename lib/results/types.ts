/**
 * The structured result the consumer page renders — shaped so it can later be
 * persisted server-side. It never contains image bytes: `visualization` holds
 * a reference (URL) only, and the front photo is referenced by blob URL.
 */

import type { Assessment } from "../assessment/types.ts";
import type { InterpretationConsent } from "../interpretation/consent.ts";
import type { Visualization } from "../image-generation/types.ts";
import type { InterpretationResult } from "../interpretation/types.ts";
import type { MogaFaceAnalysis } from "../observation/types.ts";
import type { TreatmentOpportunity } from "../treatment-opportunities/types.ts";
import type { FrontPhotoRef, } from "../visualization/build.ts";
import type { VisualizationPlan } from "../visualization/types.ts";

/** The lifecycle the results page shows. The last three are terminal for a completed result. */
export type ResultStage =
  | "analyzing"
  | "interpreting"
  | "preparing_visualization"
  | "visualization_ready"
  | "visualization_unavailable"
  | "error";

export interface MogaFaceResult {
  id: string;
  assessmentId: string;
  createdAt: string;
  /** When the assessment was started (ISO) — the report's date line. */
  assessmentCreatedAt?: string;
  interpretation: InterpretationResult;
  treatmentOpportunities: TreatmentOpportunity[];
  visualizationPlan: VisualizationPlan;
  visualization: Visualization;
  status: ResultStage;
  limitations: string[];
}

export const SNAPSHOT_VERSION = "0.1.0";

/**
 * What the assessment/analysis screen hands to the results page. Everything
 * needed to build a result, with no image bytes. Kept in sessionStorage only.
 */
export interface AssessmentSnapshot {
  version: typeof SNAPSHOT_VERSION;
  createdAt: string;
  /** True only for the development demo fixture (never a real assessment). */
  isDemo?: boolean;
  /** Consent to third-party interpretation. Absent means "pending": no consent screen exists yet, so real results stay on the local provider. */
  interpretationConsent?: InterpretationConsent;
  assessment: Assessment;
  analysis: MogaFaceAnalysis;
  opportunities: TreatmentOpportunity[];
  frontPhoto: FrontPhotoRef | null;
}
