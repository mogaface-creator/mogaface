/**
 * The structured result the consumer page renders — shaped so it can later be
 * persisted server-side. It never contains image bytes: `visualization` holds
 * a reference (URL) only, and the front photo is referenced by blob URL.
 */

import type { Assessment } from "../assessment/types.ts";
import type { InterpretationConsent } from "../interpretation/consent.ts";
import type { IllustrationDecision } from "../visualization/eligibility.ts";
import type { PhotoVisualizationConsent } from "../visualization/consent.ts";
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
  /** Whether an image model may be called at all — decided by MogaFace before any generation. */
  illustration: IllustrationDecision;
  visualization: Visualization;
  status: ResultStage;
  limitations: string[];
}

export const SNAPSHOT_VERSION = "0.1.0";

/**
 * What the assessment/analysis screen hands to the results page. Everything
 * needed to build a result, with no image bytes. `frontPhoto` here is a
 * RESOLVED reference (a URL good for display right now) — the demo fixture
 * builds this shape directly with a data: URI; a real assessment's snapshot
 * is resolved into this shape from a StoredAssessmentSnapshot (see below) by
 * ResultsExperience, never persisted in it.
 */
export interface AssessmentSnapshot {
  version: typeof SNAPSHOT_VERSION;
  createdAt: string;
  /** True only for the development demo fixture (never a real assessment). */
  isDemo?: boolean;
  /** Consent to third-party interpretation. Absent means "pending": no consent screen exists yet, so real results stay on the local provider. */
  interpretationConsent?: InterpretationConsent;
  /** Consent to send the front photo to an external AI image service. Absent means "pending": nothing is sent until the person agrees. */
  photoVisualizationConsent?: PhotoVisualizationConsent;
  assessment: Assessment;
  analysis: MogaFaceAnalysis;
  opportunities: TreatmentOpportunity[];
  frontPhoto: FrontPhotoRef | null;
  /**
   * The server-issued handle for this assessment's trusted analysis record
   * (see lib/analysis-session/), created once, right after "Analyze My Face"
   * finishes real analysis. Absent means no session was created — either the
   * server-computed opportunities were never eligible, or session creation
   * failed; either way the illustration is honestly unavailable, never a
   * client-submitted-opportunities fallback. `sessionToken` is a bearer
   * capability scoped to this one record (see AnalysisSessionHandle) — never
   * treated as proof of anything beyond "may read this specific record".
   */
  analysisSession?: { analysisId: string; sessionToken: string };
}

/**
 * A stable reference to the front photo's bytes in
 * lib/assessment/mediaStore.ts's IndexedDB cache — never a blob: URL. A
 * blob: URL is only valid in the document that created it, so persisting one
 * in sessionStorage would leave a dead reference the moment this page's
 * document reloads (backgrounding, memory pressure, or just hitting
 * reload — common on mobile). "front" is the only slot this concerns: it is
 * MogaFace's required front-facing photo.
 */
export interface StoredFrontPhotoRef {
  mediaKey: "front";
  qualityValid: boolean;
}

/**
 * What saveSnapshot/loadSnapshot actually persist to sessionStorage: identical
 * to AssessmentSnapshot except the front photo is a durable media key, not a
 * resolved (and possibly stale) URL. See lib/results/store.ts's
 * resolveStoredFrontPhoto for how this becomes an AssessmentSnapshot again.
 */
export type StoredAssessmentSnapshot = Omit<AssessmentSnapshot, "frontPhoto"> & { frontPhoto: StoredFrontPhotoRef | null };
