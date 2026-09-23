/**
 * Combination rules — which per-photo measurements become the assessment's
 * combined result, and from which view.
 *
 * Rules (Step 11 of the project brief):
 *   - Front is the primary (currently only) source for frontal proportions
 *     and symmetry. There is exactly one front photo, so "primary source"
 *     just means "the source" here — no averaging happens.
 *   - 45° measurements are computed and stored per-photo (see
 *     coordinator.ts) but are never combined — see viewCapabilities.ts for
 *     why (foreshortening).
 *   - Profile-specific geometry is not implemented yet, so those entries
 *     are always "Not available" placeholders that make the intended
 *     architecture visible without fabricating a value.
 *   - Nothing here is ever averaged across views. If a metric can't be
 *     attributed to a single trustworthy source, its value is null.
 */

import type { CombinedMeasurement, CombinedMeasurements, PhotoAnalysisRecord } from "./types.ts";

const FRONT_REASON = "The front photo is the primary source for frontal proportions.";
const NO_FRONT_REASON = "No complete, valid front photo is available yet — frontal proportions require one.";
const PROFILE_NOT_IMPLEMENTED_REASON =
  "Profile-specific geometry is not implemented in this step — see viewCapabilities.ts and FACIAL_ANALYSIS_METHODOLOGY.md.";

export function combineMeasurements(records: PhotoAnalysisRecord[]): CombinedMeasurements {
  const front = records.find((r) => r.slot === "front");
  const frontReady = Boolean(front && front.status === "complete" && front.measurements && front.symmetry && front.proportions);

  const metrics: CombinedMeasurement[] = [];

  if (frontReady && front) {
    metrics.push({
      metric: "Face width/height ratio",
      value: front.measurements!.face.widthHeightRatio,
      sourceView: "front",
      reason: FRONT_REASON,
    });
    for (const p of front.proportions!.metrics) {
      metrics.push({ metric: p.metric, value: p.value, sourceView: "front", reason: FRONT_REASON });
    }
    metrics.push({
      metric: "Overall symmetry index",
      value: front.symmetry!.overallSymmetryIndex,
      sourceView: "front",
      reason: `${FRONT_REASON} Symmetry specifically needs a frontal, level view to be meaningful.`,
    });
  } else {
    metrics.push({ metric: "Frontal proportions", value: null, sourceView: null, reason: NO_FRONT_REASON });
    metrics.push({ metric: "Overall symmetry index", value: null, sourceView: null, reason: NO_FRONT_REASON });
  }

  for (const metric of ["Nose projection (profile)", "Chin projection (profile)", "Facial convexity (profile)"]) {
    metrics.push({ metric, value: null, sourceView: null, reason: PROFILE_NOT_IMPLEMENTED_REASON });
  }

  return { metrics };
}
