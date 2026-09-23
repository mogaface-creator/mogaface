/**
 * Core types for the MogaFace facial-analysis engine.
 * This module has no React or browser dependency — pure data shapes only.
 */

/** A single MediaPipe landmark, normalized to [0, 1] against image width/height. */
export interface Point2D {
  x: number;
  y: number;
}

/** Full landmark including MediaPipe's relative depth (z), kept for future use. */
export interface Landmark3D extends Point2D {
  z: number;
  /**
   * MediaPipe's per-point visibility likelihood, when the model populates it.
   * Optional because this field's reliability for FaceLandmarker specifically
   * (as opposed to PoseLandmarker, where it is well-established) has not been
   * verified against real photos in this environment — treat it as an
   * auxiliary signal, never a hard gate.
   */
  visibility?: number;
}

/** Raw landmark list as returned by the FaceLandmarker (478 points, index-addressed). */
export type LandmarkList = Landmark3D[];

export interface PhotoQualityResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  /** 0-100, present only when derived from measurable criteria (see quality.ts). */
  qualityScore?: number;
}

export interface FaceMeasurements {
  face: {
    width: number;
    height: number;
    widthHeightRatio: number;
  };
  eyes: {
    leftEyeWidth: number;
    rightEyeWidth: number;
    interocularDistance: number;
    eyeWidthDifference: number;
    eyeWidthDifferencePct: number;
  };
  nose: {
    width: number;
    height: number | null;
    widthToFaceWidthRatio: number;
  };
  mouth: {
    width: number;
    widthToFaceWidthRatio: number;
  };
  jaw: {
    width: number;
    chinHeight: number | null;
    lowerFaceHeight: number;
  };
  thirds: {
    upper: number;
    middle: number;
    lower: number;
  };
}

export interface SymmetryMetric {
  metric: string;
  leftValue: number;
  rightValue: number;
  absoluteDifference: number;
  /** absoluteDifference normalized against face width, so it is scale-independent. */
  normalizedDifference: number;
  /** 0-100, 100 = perfectly symmetric on this metric. */
  symmetryIndex: number;
}

export interface SymmetryResult {
  metrics: SymmetryMetric[];
  /** Mean of all metrics' symmetryIndex. */
  overallSymmetryIndex: number;
}

export interface ProportionMetric {
  metric: string;
  value: number;
  /** Human-readable description of what the ratio compares, no ideal-value claim. */
  description: string;
}

export interface ProportionResult {
  metrics: ProportionMetric[];
}

export interface FacialAnalysisResult {
  analysisVersion: string;
  timestamp: string;
  imageMetadata: {
    width: number;
    height: number;
  };
  quality: PhotoQualityResult;
  measurements: FaceMeasurements;
  symmetry: SymmetryResult;
  proportions: ProportionResult;
}
