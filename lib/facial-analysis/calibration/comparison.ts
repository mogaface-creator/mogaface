/**
 * Actual vs expected.
 *
 * "Actual" is taken from the threshold decisions the visual layer already
 * makes (decisions.ts) — nothing is recomputed here, so this cannot disagree
 * with the engine. "Expected" is the engineer's own written expectation. The
 * result vocabulary is deliberately cautious: MISS and FALSE_POSITIVE mean
 * "potential" ones against a human expectation, never a scientific error rate.
 *
 * Rules (also in docs/VISUAL_CALIBRATION.md):
 *   expected clearly  · detected → MATCH · not detected or withheld (borderline) → MISS
 *   expected subtle   · detected → MATCH · not detected or withheld → UNCLEAR
 *                       (a subtle feature may legitimately sit under a conservative threshold)
 *   expected absent   · detected → FALSE_POSITIVE · not detected or withheld → MATCH
 *   expected unclear  · always UNCLEAR
 *   could not be evaluated (no video, no baseline, expression not performed…) → UNCLEAR
 *   not recorded      · NOT_RECORDED (skipped, excluded from statistics)
 */

import type { PhotoSlot } from "../multiPhoto/types.ts";
import type { ActiveExpressionState } from "../video/types.ts";
import { EXPRESSIONS, LINE_REGIONS } from "./expectations.ts";
import type { PresenceLevel, QualityLabel, QualityTarget } from "./expectations.ts";
import type { CalibrationSession } from "./session.ts";
import type { CalibrationSample, DecisionResult, RawPhotoMetrics, RawVideoMetrics, ThresholdDecision } from "./types.ts";

export const COMPARISON_RESULTS = ["MATCH", "MISS", "FALSE_POSITIVE", "UNCLEAR", "NOT_RECORDED"] as const;
export type ComparisonResult = (typeof COMPARISON_RESULTS)[number];

/**
 *   detected            — the layer produced the observation
 *   not_detected        — evaluated; clearly no observation
 *   withheld_borderline — close to the threshold: withheld as insufficient evidence
 *   not_evaluated       — the inputs did not exist (say why in `reason`)
 */
export type ActualState = "detected" | "not_detected" | "withheld_borderline" | "not_evaluated";

export interface Actual {
  state: ActualState;
  reason: string;
  /** Threshold-decision ids this was derived from — so the raw values can be inspected. */
  decisionIds: string[];
}

export type ComparisonDomain =
  | "lines.forehead"
  | "lines.glabellar"
  | "lines.lateralEye"
  | "contour"
  | "underEye"
  | `expression.${ActiveExpressionState}`
  | `quality.${QualityTarget}`;

export interface ComparisonRow {
  domain: ComparisonDomain;
  label: string;
  /** The recorded expectation (a presence level or a quality label); null when not recorded. */
  expected: PresenceLevel | QualityLabel | null;
  /** For quality rows the actual is a quality label; for the rest it is an ActualState. */
  actual: Actual;
  actualQuality?: QualityLabel;
  result: ComparisonResult;
  note: string;
  /** True when the actual sits in a borderline band — surfaced prominently in the UI. */
  borderline: boolean;
}

// ---------------------------------------------------------------------------
// Actual state from threshold decisions
// ---------------------------------------------------------------------------

const RESULT_STATE: Partial<Record<DecisionResult, ActualState>> = {
  OBSERVED: "detected",
  NOT_OBSERVED: "not_detected",
  BORDERLINE_INSUFFICIENT: "withheld_borderline",
  NOT_EVALUATED: "not_evaluated",
};

const find = (s: CalibrationSample | null | undefined, id: string): ThresholdDecision | undefined => s?.thresholdDecisions.find((d) => d.id === id);

/** One or more decisions → one state: any OBSERVED wins; else any borderline; else any NOT_OBSERVED; else not evaluated. */
function combine(decisions: (ThresholdDecision | undefined)[], missingReason: string): Actual {
  const present = decisions.filter((d): d is ThresholdDecision => !!d);
  if (present.length === 0) return { state: "not_evaluated", reason: missingReason, decisionIds: [] };
  const states = present.map((d) => RESULT_STATE[d.result] ?? "not_evaluated");
  const state: ActualState = states.includes("detected") ? "detected" : states.includes("withheld_borderline") ? "withheld_borderline" : states.includes("not_detected") ? "not_detected" : "not_evaluated";
  const decisive = present.find((d) => (RESULT_STATE[d.result] ?? "not_evaluated") === state) ?? present[0];
  return { state, reason: decisive.note, decisionIds: present.map((d) => d.id) };
}

const NO_VIDEO = "No video was supplied for this sample.";
const NO_FRONT = "No front photo was supplied for this sample.";

export function actualForDomain(session: CalibrationSession, domain: ComparisonDomain): Actual {
  const video = session.videoSample;
  if (domain.startsWith("lines.")) {
    const region = domain.slice("lines.".length) as (typeof LINE_REGIONS)[number];
    const ids = region === "forehead" ? ["forehead.BROW_RAISE"] : region === "glabellar" ? ["glabellar.FROWN"] : ["lateralEye.SMILE", "lateralEye.SQUINT"];
    return combine(ids.map((i) => find(video, `video.lineContrast.${i}`)), NO_VIDEO);
  }
  if (domain.startsWith("expression.")) return combine([find(video, `video.movement.${domain.slice("expression.".length)}`)], NO_VIDEO);
  if (domain === "underEye") return combine([find(session.photoSamples.front, "photo.visibleUnderEyeDarkness")], NO_FRONT);
  if (domain === "contour") {
    return {
      state: "not_evaluated",
      reason: "Contour observations are relative geometry (angles and ratios); the layer has no detection threshold for a 'visible contour difference', so there is nothing to compare an expectation against. See the multi-view consistency section.",
      decisionIds: [],
    };
  }
  return { state: "not_evaluated", reason: "Not a detection domain.", decisionIds: [] };
}

// ---------------------------------------------------------------------------
// Presence comparison
// ---------------------------------------------------------------------------

export function comparePresence(expected: PresenceLevel | null, actual: Actual): { result: ComparisonResult; note: string } {
  if (expected === null) return { result: "NOT_RECORDED", note: "No expectation recorded." };
  if (expected === "unclear") return { result: "UNCLEAR", note: "The labeller marked this unclear." };
  if (actual.state === "not_evaluated") return { result: "UNCLEAR", note: `Could not be evaluated: ${actual.reason}` };
  const positive = actual.state === "detected";
  const negative = actual.state === "not_detected" || actual.state === "withheld_borderline";
  const withheld = actual.state === "withheld_borderline" ? " (withheld as borderline)" : "";

  if (expected === "clearly") return positive ? { result: "MATCH", note: "Expected clearly present and it was detected." } : { result: "MISS", note: `Potential miss: expected clearly present, not detected${withheld}.` };
  if (expected === "subtle") return positive ? { result: "MATCH", note: "Expected subtle and it was detected." } : { result: "UNCLEAR", note: `Expected subtle; not detected${withheld}. A subtle feature may legitimately be under a conservative threshold, so this is not counted as a miss.` };
  // expected === "absent"
  return negative ? { result: "MATCH", note: `Expected absent and it was not detected${withheld}.` } : { result: "FALSE_POSITIVE", note: "Potential false positive: expected absent, but the layer produced an observation." };
}

// ---------------------------------------------------------------------------
// Quality (actual usability of the input itself)
// ---------------------------------------------------------------------------

export function photoQualityActual(raw: RawPhotoMetrics, decisions: ThresholdDecision[]): QualityLabel {
  if (raw.detectionStatus !== "detected" || raw.qualityValid !== true) return "unusable";
  const gateFailed = decisions.some((d) => d.kind === "quality_gate" && d.result === "FAILED");
  return raw.qualityWarnings.length > 0 || gateFailed ? "borderline" : "usable";
}

export function videoQualityActual(raw: RawVideoMetrics): QualityLabel {
  if (!raw.baseline || raw.framesUsable < 3) return "unusable";
  return raw.framesUsable / Math.max(1, raw.framesSampled) < 0.5 || !raw.baseline.stable ? "borderline" : "usable";
}

export function sampleQualityActual(sample: CalibrationSample): QualityLabel {
  return sample.rawMetrics.kind === "photo" ? photoQualityActual(sample.rawMetrics, sample.thresholdDecisions) : videoQualityActual(sample.rawMetrics);
}

/**
 * Same label → MATCH. Expected unusable but the layer accepted it → potential
 * false positive (bad input got through). Expected usable but the layer
 * rejected it → potential miss. Any borderline mismatch is UNCLEAR.
 */
export function compareQuality(expected: QualityLabel | null, actual: QualityLabel): { result: ComparisonResult; note: string } {
  if (expected === null) return { result: "NOT_RECORDED", note: "No expectation recorded." };
  if (expected === actual) return { result: "MATCH", note: `Expected ${expected}; the layer judged it ${actual}.` };
  if (expected === "unusable" && actual === "usable") return { result: "FALSE_POSITIVE", note: "Potential false positive: expected unusable input, but the layer accepted it as usable." };
  if (expected === "usable" && actual === "unusable") return { result: "MISS", note: "Potential miss: expected usable input, but the layer rejected it." };
  return { result: "UNCLEAR", note: `Expected ${expected}; the layer judged it ${actual} (borderline mismatch).` };
}

// ---------------------------------------------------------------------------
// Whole session
// ---------------------------------------------------------------------------

const DOMAIN_LABEL: Record<string, string> = {
  "lines.forehead": "Forehead lines",
  "lines.glabellar": "Glabellar lines",
  "lines.lateralEye": "Lateral-eye lines",
  contour: "Facial contour",
  underEye: "Under-eye (dark-looking appearance)",
  "expression.BROW_RAISE": "Brow raise",
  "expression.FROWN": "Frown",
  "expression.SMILE": "Smile",
  "expression.SQUINT": "Squint",
};
const VIEW_LABEL: Record<string, string> = { front: "Front", leftFortyFive: "Left 45°", rightFortyFive: "Right 45°", leftProfile: "Left profile", rightProfile: "Right profile", video: "Video" };

export function compareSession(session: CalibrationSession): ComparisonRow[] {
  const rows: ComparisonRow[] = [];
  const e = session.expectations;

  const presenceRows: [ComparisonDomain, PresenceLevel | null][] = [
    ["lines.forehead", e.lines.forehead],
    ["lines.glabellar", e.lines.glabellar],
    ["lines.lateralEye", e.lines.lateralEye],
    ["contour", e.contour],
    ["underEye", e.underEye],
    ...EXPRESSIONS.map((x): [ComparisonDomain, PresenceLevel | null] => [`expression.${x}`, e.expression[x]]),
  ];
  for (const [domain, expected] of presenceRows) {
    const actual = actualForDomain(session, domain);
    const { result, note } = comparePresence(expected, actual);
    rows.push({ domain, label: DOMAIN_LABEL[domain], expected, actual, result, note, borderline: actual.state === "withheld_borderline" });
  }

  const qualityTargets: [QualityTarget, CalibrationSample | null][] = [
    ...(["front", "leftFortyFive", "rightFortyFive", "leftProfile", "rightProfile"] as PhotoSlot[]).map((s): [QualityTarget, CalibrationSample | null] => [s, session.photoSamples[s] ?? null]),
    ["video", session.videoSample],
  ];
  for (const [target, sample] of qualityTargets) {
    if (!sample) continue;
    const actualQuality = sampleQualityActual(sample);
    const { result, note } = compareQuality(e.quality[target] ?? null, actualQuality);
    rows.push({
      domain: `quality.${target}`,
      label: `Input quality — ${VIEW_LABEL[target]}`,
      expected: e.quality[target] ?? null,
      actual: { state: "not_evaluated", reason: `The layer judged the input ${actualQuality}.`, decisionIds: [] },
      actualQuality,
      result,
      note,
      borderline: actualQuality === "borderline",
    });
  }
  return rows;
}

/** "Potential miss" / "Potential false positive" wording — never "error" or "accuracy". */
export function potentialWording(result: ComparisonResult): string | null {
  return result === "MISS" ? "Potential miss" : result === "FALSE_POSITIVE" ? "Potential false positive" : null;
}
