/**
 * Type-only placeholders for future phases (see ARCHITECTURE.md and Phases
 * 22-26 of the project brief). Nothing here is implemented or wired into
 * the app — no OpenAI, no Supabase, no payments. These interfaces exist so
 * the eventual integration has a stable shape to target: the analysis
 * engine produces `FacialAnalysisResult`, and everything below consumes
 * that structured data — it is never responsible for calculating geometry
 * itself, and it never overrides a measurement.
 */

import type { FacialAnalysisResult } from "./types.ts";

/** Phase 22: AI interpretation layer. Turns verified measurements into prose. */
export interface AiInterpretationRequest {
  analysis: FacialAnalysisResult;
  /** e.g. "en" — the AI report layer would localize explanations, not measurements. */
  locale: string;
}

export interface AiInterpretationResult {
  analysisVersion: string;
  /** Plain-language explanation of what was measured — no attractiveness claims. */
  summary: string;
  /** Non-medical, non-prescriptive suggestions tied to specific measurements. */
  recommendations: { relatedMetric: string; suggestion: string }[];
}

/** Phase 22: AI visualization — a future rendered preview, never a diagnosis. */
export interface AiVisualizationRequest {
  analysis: FacialAnalysisResult;
  style: "neutral";
}

export interface AiVisualizationResult {
  imageUrl: string;
  disclaimer: string;
}

/**
 * Phase 23: future reference-population dataset, for percentile/context
 * comparisons. No values are populated anywhere in this codebase — a real
 * dataset would need documented provenance, consent, and methodology before
 * any percentile could be shown to a user.
 */
export interface ReferenceDataset {
  datasetSource: string;
  datasetVersion: string;
  sampleSize: number;
  /** e.g. "Interocular distance / face width" — must match a ProportionMetric.metric. */
  measurementDistributions: {
    metric: string;
    mean: number;
    standardDeviation: number;
    percentiles: Record<string, number>;
    confidenceInterval95: [number, number];
  }[];
  demographicMetadata?: Record<string, string>;
}
