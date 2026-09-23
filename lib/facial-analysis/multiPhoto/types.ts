/**
 * Multi-photo facial-analysis data model.
 *
 * This layer sits ON TOP of the existing single-photo engine
 * (measurements.ts / symmetry.ts / proportions.ts / quality.ts) — it does
 * not redefine any of those formulas (see Step 20 in the project brief).
 * It coordinates running that engine once per standardized photo, then
 * combines and cross-checks the results.
 *
 * PhotoSlot mirrors lib/assessment/types.ts's PhotoSlot literal-for-literal
 * rather than importing it: lib/facial-analysis/ is meant to stay a
 * standalone, reusable engine with no dependency on the assessment feature,
 * so the two are kept structurally compatible (identical string unions,
 * TypeScript treats them as interchangeable) instead of coupled by an
 * import. If lib/assessment/types.ts's PhotoSlot values ever change, this
 * union must be updated to match.
 */

import type {
  FaceMeasurements,
  LandmarkList,
  PhotoQualityResult,
  ProportionResult,
  SymmetryResult,
} from "../types.ts";

export type PhotoSlot = "front" | "leftFortyFive" | "rightFortyFive" | "leftProfile" | "rightProfile";

/**
 * The three pose categories this app distinguishes. Front is the only one
 * with a calibrated orientation check today (quality.ts's roll/yaw
 * heuristics) — see viewValidation.ts for what "threeQuarter"/"profile"
 * checks actually do and don't verify.
 */
export type ViewCategory = "front" | "threeQuarter" | "profile";

export function viewCategoryForSlot(slot: PhotoSlot): ViewCategory {
  switch (slot) {
    case "front":
      return "front";
    case "leftFortyFive":
    case "rightFortyFive":
      return "threeQuarter";
    case "leftProfile":
    case "rightProfile":
      return "profile";
  }
}

export type PhotoProcessingStatus =
  | "idle"
  | "loading"
  | "validating"
  | "detecting"
  | "landmarking"
  | "analyzing"
  | "complete"
  | "error"
  | "blocked";

export interface ViewValidation {
  /** False only when something looks clearly wrong for the claimed view (e.g. no eyes at all in a front photo). */
  plausible: boolean;
  warnings: string[];
  /** Documented limitations of this check — always present, never silently omitted. */
  notes: string[];
}

/**
 * Full record for one photo slot, covering both the pipeline's live status
 * (Step 2) and its eventual results (Step 7/10). A record always exists
 * once a file has been selected for a slot, even before processing starts.
 */
export interface PhotoAnalysisRecord {
  slot: PhotoSlot;
  status: PhotoProcessingStatus;
  fileName: string;
  sizeBytes: number;

  imageWidth: number | null;
  imageHeight: number | null;
  faceCount: number | null;
  /** Face bounding-box coverage of the frame, 0-1 — used by the consistency check, not shown as a "measurement". */
  faceFrameCoverage: { width: number; height: number } | null;
  meanBrightness: number | null;

  quality: PhotoQualityResult | null;
  viewValidation: ViewValidation | null;

  landmarks: LandmarkList | null;
  measurements: FaceMeasurements | null;
  symmetry: SymmetryResult | null;
  proportions: ProportionResult | null;

  errors: string[];
  warnings: string[];
  processingTimeMs: number | null;
}

export function createIdleRecord(slot: PhotoSlot, file: File): PhotoAnalysisRecord {
  return {
    slot,
    status: "idle",
    fileName: file.name,
    sizeBytes: file.size,
    imageWidth: null,
    imageHeight: null,
    faceCount: null,
    faceFrameCoverage: null,
    meanBrightness: null,
    quality: null,
    viewValidation: null,
    landmarks: null,
    measurements: null,
    symmetry: null,
    proportions: null,
    errors: [],
    warnings: [],
    processingTimeMs: null,
  };
}

export interface CombinedMeasurement {
  metric: string;
  /** null means "Not available" — never a silently averaged/guessed number. */
  value: number | null;
  sourceView: PhotoSlot | null;
  reason: string;
}

export interface CombinedMeasurements {
  metrics: CombinedMeasurement[];
}

export interface ConsistencyMetric {
  metric: string;
  values: { sourceView: PhotoSlot; value: number }[];
  consistent: boolean;
  maxRelativeDifferencePct: number | null;
}

export interface ConsistencyResult {
  consistent: boolean;
  warnings: string[];
  metrics: ConsistencyMetric[];
}

export const MULTI_PHOTO_ANALYSIS_VERSION = "0.1.0";

/**
 * Top-level multi-photo result. Deliberately separate from
 * FacialAnalysisResult (lib/facial-analysis/analysis.ts), which remains the
 * single-photo /analyze route's result type and is untouched by this file.
 * multiPhotoAnalysisVersion tracks this combination layer's own rules
 * (independent of analysisVersion, which tracks the underlying formulas).
 */
export interface MultiPhotoFacialAnalysis {
  multiPhotoAnalysisVersion: typeof MULTI_PHOTO_ANALYSIS_VERSION;
  assessmentId: string;
  createdAt: string;
  photos: PhotoAnalysisRecord[];
  consistency: ConsistencyResult;
  combinedMeasurements: CombinedMeasurements;
}
