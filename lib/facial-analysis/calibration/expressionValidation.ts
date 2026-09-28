/**
 * Confusion-matrix counts for the `expression` calibration category ONLY —
 * expression movement (brow raise, frown, smile, squint) and the three
 * facial line-pattern observations they support. Contour and under-eye are
 * deliberately out of scope for this module (see the calibration gap audit
 * and docs/VISUAL_CALIBRATION.md) — extending it to those categories is a
 * separate, later task.
 *
 * Nothing here is a scientific accuracy metric: "expected" is one
 * developer's visual opinion (see expectations.ts), and the counts are
 * derived entirely from compareSession's existing MATCH/MISS/FALSE_POSITIVE
 * vocabulary — nothing is recomputed or re-judged here. An empty dataset
 * produces all-zero counts and a null agreement rate, never a misleading 0%
 * or 100%.
 */

import { compareSession } from "./comparison.ts";
import type { ComparisonDomain } from "./comparison.ts";
import type { CalibrationSession } from "./session.ts";

/** The comparison domains that belong to the `expression` calibration category (status.ts). Nothing else is in scope here. */
export const EXPRESSION_DOMAINS = [
  "expression.BROW_RAISE",
  "expression.FROWN",
  "expression.SMILE",
  "expression.SQUINT",
  "lines.forehead",
  "lines.glabellar",
  "lines.lateralEye",
] as const satisfies readonly ComparisonDomain[];
export type ExpressionComparisonDomain = (typeof EXPRESSION_DOMAINS)[number];

export interface ConfusionCounts {
  truePositives: number;
  falsePositives: number;
  trueNegatives: number;
  falseNegatives: number;
  /** (TP + TN) / (TP + TN + FP + FN). Null when the denominator is 0 — an empty or all-subtle/unclear dataset is UNVALIDATED, not "100% agreement". */
  agreementRate: number | null;
}

const EMPTY_COUNTS: ConfusionCounts = { truePositives: 0, falsePositives: 0, trueNegatives: 0, falseNegatives: 0, agreementRate: null };

/**
 * TP: expected "clearly", detected (MATCH). FN: expected "clearly", not
 * detected (MISS). TN: expected "absent", not detected (MATCH). FP: expected
 * "absent", detected (FALSE_POSITIVE). "subtle", "unclear", not-evaluated and
 * not-recorded rows are excluded from the matrix entirely (matching
 * report.ts's existing aggregate rate logic) — they are not evidence either way.
 */
export function confusionCountsForDomain(sessions: CalibrationSession[], domain: ExpressionComparisonDomain): ConfusionCounts {
  const rows = sessions.flatMap((s) => compareSession(s).filter((r) => r.domain === domain));
  if (rows.length === 0) return { ...EMPTY_COUNTS };

  const truePositives = rows.filter((r) => r.expected === "clearly" && r.result === "MATCH").length;
  const falseNegatives = rows.filter((r) => r.expected === "clearly" && r.result === "MISS").length;
  const trueNegatives = rows.filter((r) => r.expected === "absent" && r.result === "MATCH").length;
  const falsePositives = rows.filter((r) => r.expected === "absent" && r.result === "FALSE_POSITIVE").length;
  const denominator = truePositives + trueNegatives + falsePositives + falseNegatives;

  return {
    truePositives,
    falsePositives,
    trueNegatives,
    falseNegatives,
    agreementRate: denominator > 0 ? (truePositives + trueNegatives) / denominator : null,
  };
}

/** Per-condition breakdown across every expression/line-pattern domain — never a single blended number (see docs/VISUAL_CALIBRATION.md §9's "report per-condition results"). */
export function confusionCountsByDomain(sessions: CalibrationSession[]): Record<ExpressionComparisonDomain, ConfusionCounts> {
  return Object.fromEntries(EXPRESSION_DOMAINS.map((domain) => [domain, confusionCountsForDomain(sessions, domain)])) as Record<ExpressionComparisonDomain, ConfusionCounts>;
}
