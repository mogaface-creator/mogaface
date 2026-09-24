/**
 * Video expression-analysis data model.
 *
 * This layer DESCRIBES what moved between a neutral frame and an expression
 * frame of the user's own video. It does not diagnose, score, or recommend:
 * "the brow-to-eye distance grew 21% versus neutral" is the whole claim.
 * What that might mean for a treatment conversation belongs to the Treatment
 * Opportunity Engine, never here. See docs/VISUAL_OBSERVATION_LAYER.md.
 *
 * Framework-free: nothing in this folder except capture.ts touches the DOM.
 */

import type { GrayImage } from "../regions.ts";
import type { LandmarkList, PhotoQualityResult } from "../types.ts";

/** Bump when frame selection, expression thresholds, or the movement/texture formulas change. */
export const VIDEO_ANALYSIS_VERSION = "0.1.0";

export const EXPRESSION_STATES = ["NEUTRAL", "BROW_RAISE", "FROWN", "SMILE", "SQUINT"] as const;
export type ExpressionState = (typeof EXPRESSION_STATES)[number];
/** The states compared against neutral (NEUTRAL is the baseline itself). */
export type ActiveExpressionState = Exclude<ExpressionState, "NEUTRAL">;

/** Region whose geometry a state's movement metric describes. */
export type ExpressionRegion = "FOREHEAD" | "GLABELLA" | "EYE_AREA" | "MOUTH_AREA";

/** Whether evidence came from one still frame or from comparing frames within a video. */
export type EvidenceMode = "STATIC_IMAGE_EVIDENCE" | "DYNAMIC_VIDEO_EVIDENCE";

/**
 * Evidence completeness — never a medical or statistical confidence.
 *   low      — only one usable frame on one side of the comparison (e.g. a single neutral frame,
 *              so the baseline's stability cannot be checked).
 *   moderate — a stable neutral baseline plus at least one expression frame.
 *   high     — a stable baseline plus at least three good-quality expression frames whose movement is consistent.
 */
export type EvidenceStrength = "low" | "moderate" | "high";

export interface VideoMetadata {
  durationSec: number;
  width: number;
  height: number;
  sizeBytes: number;
  mimeType: string;
}

/** One sampled frame, already run through face detection by the caller. */
export interface VideoFrameSample {
  /** Position in the sampled sequence; provenance ids are `video_frame_<index>`. */
  index: number;
  timeSec: number;
  imageWidth: number;
  imageHeight: number;
  faceCount: number;
  /** Landmarks of the (single) face, or null when none/several were found. */
  landmarks: LandmarkList | null;
  meanBrightness?: number;
  /** Luminance copy of the frame, for region-texture measures. Optional. */
  gray?: GrayImage | null;
}

export interface FrameAssessment {
  index: number;
  timeSec: number;
  usable: boolean;
  /** Why an unusable frame was rejected (empty when usable). */
  reasons: string[];
  quality: PhotoQualityResult;
}

/**
 * Landmark-derived expression features, all in pixel space and divided by
 * the frame's own interocular distance, so they are comparable between
 * frames of the same video without any absolute unit.
 */
export interface ExpressionFeatures {
  /** Mean vertical distance from each mid-brow point down to its upper eyelid. */
  browToEye: number;
  /** Horizontal distance between the two inner-brow points. */
  innerBrowSeparation: number;
  /** Mean vertical distance from each inner-brow point down to its inner eye corner. */
  innerBrowToEyeCorner: number;
  /** Mean eye opening (lid gap) divided by that eye's width. */
  eyeOpening: number;
  mouthWidth: number;
}

export interface NeutralBaseline {
  /** Frame indices the baseline was built from. */
  frames: number[];
  /** Median feature values across those frames. */
  features: ExpressionFeatures;
  /** False when the frames disagreed too much to call a resting face (or only one frame existed to check). */
  stable: boolean;
  /** Largest relative spread ((max−min)/median) of any feature across the baseline frames; null with a single frame. */
  maxSpread: number | null;
}

export interface FrameExpression {
  index: number;
  /** The raw features this classification came from (kept so a calibrator can see them). */
  features: ExpressionFeatures;
  state: ExpressionState | "AMBIGUOUS";
  /** Per-state movement as a percentage vs neutral (positive = the state's expected direction). */
  movementPct: Record<ActiveExpressionState, number>;
}

/** The example shape from the brief: measurable movement evidence for one expression. */
export interface ExpressionEvidence {
  type: "dynamic_expression_observation";
  expression: ActiveExpressionState;
  region: ExpressionRegion;
  status: "observed" | "insufficient_evidence";
  /** Provenance: sampled-frame indices. */
  evidence: {
    neutralFrames: number[];
    expressionFrames: number[];
    /** Human-readable name of the movement metric, e.g. "brow-to-eye distance vs neutral". */
    movementMetric: string;
    /** Mean movement across expression frames, in percent (null when insufficient). */
    movementPct: number | null;
  };
  strength: EvidenceStrength | null;
  /** Why the status is what it is — always filled, especially for insufficient_evidence. */
  reason: string;
}

export type LinePatternKind = "forehead" | "glabellar" | "lateralEye";

/**
 * Whether lines in a region became more apparent in expression frames than
 * in neutral frames of the same video (a within-video comparison, so static
 * lighting and skin tone largely cancel). Thresholds are UNCALIBRATED.
 */
export interface LinePatternEvidence {
  kind: LinePatternKind;
  mode: "DYNAMIC_VIDEO_EVIDENCE";
  expression: ActiveExpressionState;
  status: "observed" | "insufficient_evidence";
  neutralFrames: number[];
  expressionFrames: number[];
  /** Mean region contrast in expression frames / in neutral frames (the neutral value is floored — see observe.ts). */
  contrastRatio: number | null;
  /** The raw mean contrasts behind the ratio, as a fraction of each region's mean brightness. */
  neutralContrast: number | null;
  expressionContrast: number | null;
  reason: string;
}

export interface VideoExpressionAnalysis {
  videoAnalysisVersion: typeof VIDEO_ANALYSIS_VERSION;
  metadata: VideoMetadata;
  framesSampled: number;
  framesUsable: number;
  frames: FrameAssessment[];
  baseline: NeutralBaseline | null;
  classifications: FrameExpression[];
  expressions: ExpressionEvidence[];
  linePatterns: LinePatternEvidence[];
  /** "analyzed" once a baseline exists; otherwise "insufficient_evidence". */
  status: "analyzed" | "insufficient_evidence";
  notes: string[];
}
