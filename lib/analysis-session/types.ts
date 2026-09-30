/**
 * The trusted analysis record — the one place a server-computed
 * (never client-asserted) treatment-opportunity list and illustration
 * eligibility decision live for a given assessment. See store.ts for how a
 * record is created and referenced, and lib/image-generation/trustedHandler.ts
 * for the one consumer allowed to read it.
 */

import type { Assessment } from "../assessment/types.ts";
import type { MogaFaceAnalysis } from "../observation/types.ts";
import type { TreatmentOpportunity } from "../treatment-opportunities/types.ts";
import type { AngleSlot } from "../image-generation/angles.ts";
import type { PredictionPlan } from "../visualization/predict.ts";

export const ANALYSIS_RECORD_VERSION = "0.1.0";

export type AnalysisRecordStatus = "active" | "expired";

export interface AnalysisRecord {
  /** Opaque, server-minted, unguessable (crypto.randomUUID). Never derived from user input. */
  id: string;
  version: typeof ANALYSIS_RECORD_VERSION;
  /**
   * The methodology versions this record was produced under (observation
   * engine + treatment-opportunity engine), so a later reader can tell
   * whether the record predates a rule/threshold change — never used to
   * silently reinterpret old data under new rules.
   */
  methodologyVersion: { analysis: string; treatmentOpportunities: string };
  /** As reported by the client at submission time — user input, not a finding. Never a source of evidence on its own. */
  assessment: Assessment;
  /**
   * The client's own local analysis (MediaPipe/video are browser-only — see
   * ARCHITECTURE.md's "Explicitly not built" — so these raw measurements are
   * unavoidably client-computed). What this record guarantees is NOT "these
   * measurements are independently re-derived from pixels" — it is that
   * everything downstream of them (opportunities, eligibility) is computed
   * ONCE, here, server-side, from these raw values, and never again trusted
   * as a pre-built object from any later request.
   */
  analysis: MogaFaceAnalysis;
  /** SERVER-COMPUTED via evaluateTreatmentOpportunities — never accepted from a client as a pre-built object. */
  opportunities: TreatmentOpportunity[];
  /**
   * SERVER-COMPUTED via buildPredictionPlan (lib/visualization/predict.ts) —
   * the goal-driven illustration pathway, independent of `opportunities`
   * above and of CALIBRATION_STATE. Computed ONCE here, from `assessment` +
   * `analysis`, and reused unchanged for every angle at generation time
   * (see trustedHandler.ts/multiAngle.ts) — never recomputed from a
   * client-submitted value, never accepted as a pre-built object.
   */
  predictionPlan: PredictionPlan;
  /**
   * SERVER-COMPUTED via buildVisualizationPlan + decideIllustrationEligibility, with NO
   * calibration override — the real, unmodified, production decision. Recomputed fresh
   * at generation time from `opportunities` (see trustedHandler.ts), not trusted from here
   * as a cached verdict, so a later threshold/policy change is never silently stale.
   */
  createdAt: string;
  status: AnalysisRecordStatus;
  /**
   * Which angles the client reported having a real photo for at submission
   * time — "front" is always included (required for eligibility itself).
   * Informational only: it shapes which angle buttons the UI offers, never
   * an authorization. The real gate, at generation time, is simply whether a
   * photo file was actually present in that request (see multiAngle.ts) —
   * a client claiming an angle here that it never actually uploads a photo
   * for at generation time gets `not_requested` for that angle, nothing more.
   */
  availableAngles: AngleSlot[];
  /**
   * How many illustration provider calls this session has already been allowed
   * to make. Server-owned, incremented only inside the verified illustration
   * path. Absent on records created before this field existed.
   */
  illustrationUses?: number;
}

/** What the client receives after a successful POST /api/analysis-session — the capability needed to later request an illustration. Never the record itself. */
export interface AnalysisSessionHandle {
  analysisId: string;
  /** A per-record secret, shown once. The server stores only its hash (see store.ts). */
  sessionToken: string;
  illustrationEligible: boolean;
  availableAngles: AngleSlot[];
  expiresAt: string;
}
