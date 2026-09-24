/**
 * Calibration status — the single switch that decides whether treatment
 * opportunities that depend on the visual observation layer may be shown to
 * consumers.
 *
 * "Calibrated" here means ENGINEERING calibration: the thresholds were
 * checked against a set of real photos/videos with recorded evaluator
 * labels (see docs/VISUAL_CALIBRATION.md). It never means clinical
 * validation, and setting it to true does not make any output a diagnosis
 * or a recommendation.
 *
 * Leave it false until the calibration workflow has actually been completed
 * and documented. While false: observations are still produced and shown in
 * development, and the engine still evaluates them in tests — but every
 * opportunity that cites them is marked `consumerReady: false`.
 */
export const VISUAL_OBSERVATIONS_CALIBRATED: boolean = false;

/** Version of the calibration record format and threshold registry. Bump when either changes. */
export const CALIBRATION_VERSION = "0.1.0";

/**
 * Observation-id prefixes produced by the visual layer whose interpretation
 * rests on uncalibrated thresholds or unvalidated pixel measures.
 */
export const UNCALIBRATED_VISUAL_OBSERVATION_PREFIXES: readonly string[] = [
  "expression.", // video movement + line-pattern observations
  "facialStructure.contour.", // cheek/jaw outline geometry
  "eyeArea.underEye", // under-eye brightness ratios
  "eyeArea.visibleUnderEye", // visible dark-looking under-eye appearance
];

export function isUncalibratedVisualObservation(observationId: string): boolean {
  return UNCALIBRATED_VISUAL_OBSERVATION_PREFIXES.some((p) => observationId.startsWith(p));
}

/**
 * True when nothing in `observationIds` rests on uncalibrated visual
 * evidence — or when the visual layer has been marked calibrated. The flag
 * is a parameter only so tests can exercise both states.
 */
export function isConsumerReady(observationIds: readonly string[], calibrated: boolean = VISUAL_OBSERVATIONS_CALIBRATED): boolean {
  return calibrated || !observationIds.some(isUncalibratedVisualObservation);
}
