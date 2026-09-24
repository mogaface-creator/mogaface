/**
 * Threshold bands — the one place "close to the threshold" is defined.
 *
 * A measurement that lands right next to its threshold is the least
 * trustworthy kind: a slightly different photo would flip the answer. So
 * every threshold-based observation has a BORDERLINE band around the
 * threshold, and a borderline value produces NO observation (it is reported
 * as insufficient evidence), never a coin-flip one. The band widths are
 * conservative margins, themselves uncalibrated — see docs/VISUAL_CALIBRATION.md.
 * They do not move the thresholds.
 */

export type BandResult = "PASSES" | "BORDERLINE" | "FAILS";

export interface Band {
  /** Value at (or beyond) which the threshold is clearly met. */
  clear: number;
  /** Value at (or beyond) which the threshold is clearly NOT met. Between `clear` and `fail` is borderline. */
  fail: number;
}

/**
 * `atLeast`: the observation needs value ≥ threshold (movement, contrast).
 * `atMost`: it needs value ≤ threshold (a brightness ratio below 1 = darker).
 * `marginFraction` is the borderline half-width as a fraction of the threshold.
 */
export function thresholdBand(threshold: number, marginFraction: number, direction: "atLeast" | "atMost"): Band {
  const up = threshold * (1 + marginFraction);
  const down = threshold * (1 - marginFraction);
  return direction === "atLeast" ? { clear: up, fail: down } : { clear: down, fail: up };
}

/** Non-finite values fail: a NaN must never pass a threshold. */
export function classifyAgainstBand(value: number, band: Band, direction: "atLeast" | "atMost"): BandResult {
  if (!Number.isFinite(value)) return "FAILS";
  if (direction === "atLeast") return value >= band.clear ? "PASSES" : value >= band.fail ? "BORDERLINE" : "FAILS";
  return value <= band.clear ? "PASSES" : value <= band.fail ? "BORDERLINE" : "FAILS";
}
