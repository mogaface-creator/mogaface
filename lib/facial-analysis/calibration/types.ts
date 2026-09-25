/**
 * Calibration record types. A CalibrationSample is a DEVELOPMENT-ONLY record
 * of what the visual layer measured and decided on one real photo or video,
 * next to a human developer's own label of whether it looked right.
 *
 * Labels are ENGINEERING labels against the developer's visual inspection of
 * the same media. They are not clinical truth, and nothing here says whether
 * anyone has any condition. No image or video bytes are ever stored in a
 * record — numbers and short text only.
 */

import type { ContourGeometry } from "../contour.ts";
import type { PhotoSlot } from "../multiPhoto/types.ts";
import type { UnderEyeMeasurement } from "../underEye.ts";
import type { FaceMeasurements } from "../types.ts";
import type { Observation } from "../../observation/types.ts";
import type { ActiveExpressionState, ExpressionFeatures, ExpressionState, LinePatternKind, VideoMetadata } from "../video/types.ts";

export const EVALUATOR_LABELS = ["true_positive", "false_positive", "true_negative", "false_negative", "unclear"] as const;
export type EvaluatorLabel = (typeof EVALUATOR_LABELS)[number];

export const CALIBRATION_SOURCE_TYPES = ["photo", "video"] as const;
export type CalibrationSourceType = (typeof CALIBRATION_SOURCE_TYPES)[number];

/**
 *   OBSERVED / NOT_OBSERVED       — an observation threshold was clearly met / clearly not met.
 *   BORDERLINE_INSUFFICIENT       — close to the threshold: no observation is produced.
 *   NOT_EVALUATED                 — the inputs needed to evaluate it did not exist.
 *   PASSED / FAILED               — a quality gate or condition (not an observation).
 */
export const DECISION_RESULTS = ["OBSERVED", "NOT_OBSERVED", "BORDERLINE_INSUFFICIENT", "NOT_EVALUATED", "PASSED", "FAILED"] as const;
export type DecisionResult = (typeof DECISION_RESULTS)[number];

export interface ThresholdDecision {
  /** Stable id, e.g. "video.lineContrast.forehead.BROW_RAISE". */
  id: string;
  kind: "observation" | "quality_gate";
  /** Human-readable metric name. */
  metric: string;
  /** The measured value the threshold was applied to; null when it could not be measured. */
  value: number | null;
  /** The current threshold; null for decisions that compare against a band only. */
  threshold: number | null;
  comparator: ">=" | "<=";
  /** Values at/beyond `clear` are clearly on the passing side; between `clear` and `fail` is borderline. Null when no band applies. */
  borderline: { clear: number; fail: number } | null;
  result: DecisionResult;
  /** Why this result — especially for NOT_EVALUATED and BORDERLINE_INSUFFICIENT. */
  note: string;
  /** The observation id this decision gates, when there is one. */
  gates: string | null;
}

export interface EvaluatorNote {
  /** A ThresholdDecision id or a generated Observation id this label refers to. */
  target: string;
  label: EvaluatorLabel;
  note: string;
}

export interface RawPhotoMetrics {
  kind: "photo";
  imageWidth: number | null;
  imageHeight: number | null;
  detectionStatus: "detected" | "no_face" | "multiple_faces" | "error";
  faceCount: number | null;
  qualityScore: number | null;
  qualityValid: boolean | null;
  qualityErrors: string[];
  qualityWarnings: string[];
  /** Signed eye-line tilt in degrees (0 = level); null without landmarks. */
  rollDegrees: number | null;
  /** larger/smaller nose-to-eye span (1 = frontal); null without landmarks. */
  yawRatio: number | null;
  /** Nose-to-face-edge span ratio used to decide a 45° view's near side; null without landmarks. */
  nearSideSpanRatio: number | null;
  meanBrightness: number | null;
  faceBoundingBox: { minX: number; minY: number; maxX: number; maxY: number } | null;
  landmarkCount: number;
  /** True when every landmark index the engine relies on is present and finite. */
  requiredLandmarksPresent: boolean;
  measurements: FaceMeasurements | null;
  contour: ContourGeometry | null;
  underEye: UnderEyeMeasurement | null;
  /**
   * RAW static-image line contrast (fraction of the region's mean brightness).
   * NOT used by any observation — a single relaxed photo cannot establish
   * dynamic lines — recorded only so a developer can see how these regions
   * measure on faces with and without visible lines.
   */
  staticLineContrast: { forehead: number | null; glabellar: number | null; lateralEyeRight: number | null; lateralEyeLeft: number | null } | null;
}

export interface RawVideoFrame {
  index: number;
  timeSec: number;
  usable: boolean;
  reasons: string[];
  qualityScore: number | null;
  /** Null for unusable frames (never classified). */
  state: ExpressionState | "AMBIGUOUS" | null;
  movementPct: Record<ActiveExpressionState, number> | null;
  features: ExpressionFeatures | null;
}

export interface StateCandidate {
  /** Frames the classifier accepted as this state. */
  frameIndices: number[];
  /** The usable frame with the largest movement toward this state, even if it did not qualify — shows near misses. */
  bestFrame: number | null;
  bestMovementPct: number | null;
}

export interface RawVideoMetrics {
  kind: "video";
  metadata: VideoMetadata;
  framesSampled: number;
  framesUsable: number;
  frames: RawVideoFrame[];
  baseline: { frames: number[]; stable: boolean; maxSpread: number | null; features: ExpressionFeatures } | null;
  neutralFrameCandidates: number[];
  stateCandidates: Record<ActiveExpressionState, StateCandidate>;
  /** Per-expression evidence as the analysis reported it (status, strength, mean movement, reason). Optional: absent in older exports. */
  expressionEvidence?: {
    expression: ActiveExpressionState;
    status: "observed" | "insufficient_evidence";
    strength: "low" | "moderate" | "high" | null;
    movementPct: number | null;
    neutralFrames: number[];
    expressionFrames: number[];
    reason: string;
  }[];
  linePatterns: {
    kind: LinePatternKind;
    expression: ActiveExpressionState;
    status: "observed" | "insufficient_evidence";
    neutralContrast: number | null;
    expressionContrast: number | null;
    contrastRatio: number | null;
  }[];
  notes: string[];
}

export interface CalibrationSample {
  sampleId: string;
  sourceType: CalibrationSourceType;
  /** Free text: what this media is, e.g. "test-matrix C — front, no obvious forehead lines". No names or identifying details needed. */
  sourceDescription: string;
  /** Which photo slot a photo sample was taken as; null for video. */
  photoRole: PhotoSlot | null;
  /** The expression the developer intended/observed in a video sample; null for photos or unspecified. */
  videoState: ExpressionState | null;
  rawMetrics: RawPhotoMetrics | RawVideoMetrics;
  thresholdDecisions: ThresholdDecision[];
  generatedObservations: Observation<unknown>[];
  evaluatorNotes: EvaluatorNote[];
  calibrationVersion: string;
  createdAt: string;
}
