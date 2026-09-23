/**
 * The observation layer's own version identifiers.
 *
 * These are distinct from, and independent of, the engine versions they
 * wrap (`ANALYSIS_VERSION` in lib/facial-analysis/analysis.ts and
 * `MULTI_PHOTO_ANALYSIS_VERSION` in lib/facial-analysis/multiPhoto/types.ts)
 * — a MogaFaceAnalysis records all of them (see MogaFaceAnalysisVersions in
 * types.ts) so a stored result is never ambiguous about which formulas,
 * which combination rules, and which observation-mapping logic produced it.
 */

import { ANALYSIS_VERSION } from "../facial-analysis/analysis.ts";

/**
 * The version of the documented methodology in FACIAL_ANALYSIS_METHODOLOGY.md.
 * Today this mirrors the single-photo engine's ANALYSIS_VERSION exactly,
 * since that document describes exactly what that engine computes — it is
 * exported under its own name because the observation layer references it
 * as "the methodology", not "the engine version", and the two could
 * diverge later (e.g. if the doc gains multi-photo methodology sections
 * versioned on their own).
 */
export const FACIAL_ANALYSIS_METHODOLOGY_VERSION = ANALYSIS_VERSION;

/**
 * Versions the mapping/classification logic in lib/observation/ itself —
 * how raw measurements and questionnaire answers become Observations,
 * which domains exist, which confidence states apply. This can change
 * independently of the underlying measurement formulas or combination
 * rules.
 */
export const OBSERVATION_ENGINE_VERSION = "0.1.0";
