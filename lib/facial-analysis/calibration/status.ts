/**
 * Calibration status — the single switch(es) that decide whether treatment
 * opportunities that depend on the visual observation layer may be shown to
 * consumers.
 *
 * "Calibrated" here means ENGINEERING calibration: the thresholds were
 * checked against a set of real photos/videos with recorded evaluator
 * labels (see docs/VISUAL_CALIBRATION.md). It never means clinical
 * validation, and setting a category to true does not make any output a
 * diagnosis or a recommendation.
 *
 * Calibration state is scoped PER CATEGORY, not a single global boolean: the
 * calibration audit (docs/VISUAL_CALIBRATION.md) established that the first
 * real-data milestone targets `expression` alone, while `facialStructure.contour`
 * and `eyeArea.underEye` must stay gated independently of it — collecting
 * real samples and sign-off evidence for one category must never make a
 * different category's observations look consumer-ready.
 *
 * Every category is `false` today. While false: observations are still
 * produced and shown in development, and the engine still evaluates them in
 * tests — but every opportunity that cites them is marked `consumerReady: false`.
 * Changing a category to `true` is a real-data engineering decision made and
 * recorded per docs/VISUAL_CALIBRATION.md's sign-off criteria — never a code
 * refactor, and never inferred from another category's state.
 */

/** One entry per family of uncalibrated visual observations. See PREFIX_CATEGORY for which observation-id prefixes belong to each. */
export const CALIBRATION_CATEGORIES = ["expression", "facialStructure.contour", "eyeArea.underEye"] as const;
export type CalibrationCategory = (typeof CALIBRATION_CATEGORIES)[number];

/**
 * Per-category calibration state. Every value is `false`: no real-data
 * calibration has been performed for ANY category — see
 * docs/VISUAL_CALIBRATION.md's sign-off criteria. A value here changes only
 * as a dated, reviewed decision recorded in that document's change log,
 * never silently and never as a side effect of another category's work.
 */
export const CALIBRATION_STATE: Record<CalibrationCategory, boolean> = {
  expression: false,
  "facialStructure.contour": false,
  "eyeArea.underEye": false,
};

/**
 * Maps each uncalibrated observation-id prefix to the calibration category
 * that governs it. `eyeArea.underEye*` and `eyeArea.visibleUnderEye*` are two
 * prefixes for the same measurement family (a brightness ratio and the
 * boolean derived from it), so they share one category.
 */
const PREFIX_CATEGORY: Record<string, CalibrationCategory> = {
  "expression.": "expression",
  "facialStructure.contour.": "facialStructure.contour",
  "eyeArea.underEye": "eyeArea.underEye",
  "eyeArea.visibleUnderEye": "eyeArea.underEye",
};

/** Version of the calibration record format and threshold registry. Bump when either changes. */
export const CALIBRATION_VERSION = "0.1.0";

/**
 * Every observation-id prefix gated by SOME calibration category. Kept as a
 * flat list (rather than only exposing PREFIX_CATEGORY) because existing
 * code and tests enumerate it directly; it is derived from PREFIX_CATEGORY,
 * not maintained separately.
 */
export const UNCALIBRATED_VISUAL_OBSERVATION_PREFIXES: readonly string[] = Object.keys(PREFIX_CATEGORY);

/**
 * Backward-compatible alias: true only if EVERY calibration category were
 * true, i.e. "all currently gated visual prefixes calibrated" — never a
 * separate, independently-settable flag. Existing call sites and tests that
 * check this constant directly keep working unchanged; new code that needs
 * to reason about a SPECIFIC category should use CALIBRATION_STATE /
 * isCategoryCalibrated instead, since this alias cannot distinguish "nothing
 * is calibrated" from "only some categories are calibrated".
 */
export const VISUAL_OBSERVATIONS_CALIBRATED: boolean = Object.values(CALIBRATION_STATE).every(Boolean);

/** The calibration category that governs `observationId`, or null if it isn't gated by calibration at all. */
export function categoryOfObservation(observationId: string): CalibrationCategory | null {
  const prefix = Object.keys(PREFIX_CATEGORY).find((p) => observationId.startsWith(p));
  return prefix ? PREFIX_CATEGORY[prefix] : null;
}

export function isCategoryCalibrated(category: CalibrationCategory): boolean {
  return CALIBRATION_STATE[category];
}

export function isUncalibratedVisualObservation(observationId: string): boolean {
  return categoryOfObservation(observationId) !== null;
}

/**
 * True when nothing in `observationIds` rests on a not-yet-calibrated visual
 * category — checked PER OBSERVATION against its OWN category's state, so
 * one category becoming calibrated in the future can never make a different
 * category's observations look consumer-ready.
 *
 * `calibratedOverride`, when explicitly passed (tests and the development
 * demo only — see callers' own doc comments), replaces every category's
 * state at once for this call: `true` treats every id as calibrated, `false`
 * treats every gated id as uncalibrated, matching the single-flag override
 * behaviour every existing caller already relies on. Omit it (the default,
 * and what every real request path already passes) to get the real,
 * per-category answer.
 */
export function isConsumerReady(observationIds: readonly string[], calibratedOverride?: boolean): boolean {
  return observationIds.every((id) => {
    if (calibratedOverride !== undefined) return calibratedOverride || !isUncalibratedVisualObservation(id);
    const category = categoryOfObservation(id);
    return category === null || isCategoryCalibrated(category);
  });
}
