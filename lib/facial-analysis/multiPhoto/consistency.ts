/**
 * Cross-photo consistency checks.
 *
 * This deliberately does NOT compare frontal-style geometry (face width,
 * eye spacing, etc.) across different views — Step 20 forbids redefining
 * what those metrics mean, and comparing a front photo's face width against
 * a 45°/profile photo's foreshortened version of the same formula would be
 * comparing two different things while pretending they're the same
 * measurement. Instead this compares two things that genuinely should be
 * stable regardless of pose: how large the face appears in frame (a proxy
 * for camera distance/crop) and estimated brightness (a proxy for
 * lighting) — both explicitly named as possible inconsistency causes in
 * the project brief. No scientific confidence score is computed; this is a
 * QA signal, not a measurement.
 */

import type { ConsistencyMetric, ConsistencyResult, PhotoAnalysisRecord } from "./types.ts";

/** Max/min ratio of face-frame-coverage above which we flag inconsistent framing. */
const FRAME_COVERAGE_RATIO_WARNING = 1.5;
/** Max/min absolute difference (0-255 scale) above which we flag inconsistent lighting. */
const BRIGHTNESS_DIFFERENCE_WARNING = 80;

function relativeDifferencePct(values: number[]): number {
  if (values.length < 2) return 0;
  const max = Math.max(...values);
  const min = Math.min(...values);
  if (max === 0) return 0;
  return ((max - min) / max) * 100;
}

export function checkConsistency(records: PhotoAnalysisRecord[]): ConsistencyResult {
  const metrics: ConsistencyMetric[] = [];
  const warnings: string[] = [];

  const withCoverage = records.filter((r) => r.faceFrameCoverage !== null);
  if (withCoverage.length >= 2) {
    const values = withCoverage.map((r) => ({ sourceView: r.slot, value: r.faceFrameCoverage!.width }));
    const nums = values.map((v) => v.value);
    const max = Math.max(...nums);
    const min = Math.min(...nums);
    const ratio = min === 0 ? Infinity : max / min;
    const consistent = ratio <= FRAME_COVERAGE_RATIO_WARNING;
    if (!consistent) {
      warnings.push(
        "Face size in frame varies a lot between photos — they may have been taken at different distances from the camera or with different crops.",
      );
    }
    metrics.push({
      metric: "Face size in frame",
      values,
      consistent,
      maxRelativeDifferencePct: relativeDifferencePct(nums),
    });
  }

  const withBrightness = records.filter((r) => r.meanBrightness !== null);
  if (withBrightness.length >= 2) {
    const values = withBrightness.map((r) => ({ sourceView: r.slot, value: r.meanBrightness! }));
    const nums = values.map((v) => v.value);
    const diff = Math.max(...nums) - Math.min(...nums);
    const consistent = diff <= BRIGHTNESS_DIFFERENCE_WARNING;
    if (!consistent) {
      warnings.push("Lighting appears to vary noticeably between these photos.");
    }
    metrics.push({
      metric: "Estimated brightness",
      values,
      consistent,
      maxRelativeDifferencePct: relativeDifferencePct(nums),
    });
  }

  return {
    consistent: metrics.every((m) => m.consistent),
    warnings,
    metrics,
  };
}
