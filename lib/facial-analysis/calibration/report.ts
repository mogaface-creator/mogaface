/**
 * Reporting for calibration sessions: input-quality explanations, borderline
 * decisions with their margins, multi-view consistency, a per-session summary,
 * and an aggregate ENGINEERING CALIBRATION STATISTIC.
 *
 * None of this is accuracy, sensitivity or specificity in a clinical or
 * scientific sense: the "expected" side is a developer's visual opinion, the
 * samples are few, and nothing here has been validated. Rates are withheld
 * until a minimum number of clearly labelled samples exists.
 */

import { BRIGHTNESS_DIFFERENCE_WARNING, FRAME_COVERAGE_RATIO_WARNING } from "../multiPhoto/consistency.ts";
import { CONTOUR_VIEW_DISAGREEMENT_DEG, contourViewsDisagree } from "../../treatment-opportunities/evidence.ts";
import type { Observation } from "../../observation/types.ts";
import { baselineCoverage } from "./session.ts";
import type { CalibrationSession } from "./session.ts";
import { compareSession, potentialWording, sampleQualityActual } from "./comparison.ts";
import type { ComparisonDomain, ComparisonRow } from "./comparison.ts";
import type { QualityLabel } from "./expectations.ts";
import type { CalibrationSample, RawPhotoMetrics, RawVideoMetrics, ThresholdDecision } from "./types.ts";

/** Minimum clearly-labelled, evaluable samples in a category before a rate is shown. An engineering choice, not a statistical guarantee. */
export const MIN_LABELLED_FOR_RATE = 10;

export const STATISTIC_LABEL = "ENGINEERING CALIBRATION STATISTIC";
export const STATISTIC_DISCLAIMER =
  "Counts and rates below compare the layer against a developer's own visual expectations on a small number of samples. They are not accuracy, not sensitivity or specificity, and not clinical validation.";

// ---------------------------------------------------------------------------
// Photo quality
// ---------------------------------------------------------------------------

export interface PhotoQualityReport {
  status: QualityLabel;
  faceDetected: boolean;
  faceCount: number | null;
  landmarkStatus: "complete" | "incomplete" | "not_detected";
  qualityScore: number | null;
  rollDegrees: number | null;
  yawRatio: number | null;
  brightness: number | null;
  /** Face width as a fraction of the frame width. */
  faceSize: number | null;
  /** Human reasons — failed samples are never hidden. */
  reasons: string[];
  warnings: string[];
}

const FAILED_GATE_REASON: Record<string, string> = {
  "photo.resolution": "Resolution below the recommended minimum.",
  "photo.faceWidth": "Face too small in frame.",
  "photo.brightnessMin": "Image too dark.",
  "photo.brightnessMax": "Image too bright (overexposed).",
  "photo.roll": "Head tilt outside the expected range.",
  "photo.yaw": "Head rotation outside the expected range.",
  "photo.turned45": "This does not look turned enough to be a 45° view.",
};

export function photoQualityReport(sample: CalibrationSample): PhotoQualityReport {
  const raw = sample.rawMetrics as RawPhotoMetrics;
  const reasons: string[] = [];
  if (raw.detectionStatus === "no_face") reasons.push("Face not detected.");
  else if (raw.detectionStatus === "multiple_faces") reasons.push("More than one face detected.");
  else if (raw.detectionStatus === "error") reasons.push("The image could not be analysed.");
  for (const d of sample.thresholdDecisions) if (d.kind === "quality_gate" && d.result === "FAILED" && FAILED_GATE_REASON[d.id]) reasons.push(FAILED_GATE_REASON[d.id]);

  return {
    status: sampleQualityActual(sample),
    faceDetected: raw.detectionStatus === "detected",
    faceCount: raw.faceCount,
    landmarkStatus: raw.landmarkCount === 0 ? "not_detected" : raw.requiredLandmarksPresent ? "complete" : "incomplete",
    qualityScore: raw.qualityScore,
    rollDegrees: raw.rollDegrees,
    yawRatio: raw.yawRatio,
    brightness: raw.meanBrightness,
    faceSize: raw.faceBoundingBox ? raw.faceBoundingBox.maxX - raw.faceBoundingBox.minX : null,
    reasons: [...new Set(reasons)],
    warnings: [...new Set([...raw.qualityErrors, ...raw.qualityWarnings])],
  };
}

// ---------------------------------------------------------------------------
// Video frame counts
// ---------------------------------------------------------------------------

export interface VideoFrameCounts {
  sampled: number;
  usable: number;
  rejected: number;
  neutral: number;
  expression: number;
  ambiguous: number;
}

export function videoFrameCounts(raw: RawVideoMetrics): VideoFrameCounts {
  const states = raw.frames.map((f) => f.state);
  return {
    sampled: raw.framesSampled,
    usable: raw.framesUsable,
    rejected: raw.frames.filter((f) => !f.usable).length,
    neutral: states.filter((s) => s === "NEUTRAL").length,
    expression: states.filter((s) => s !== null && s !== "NEUTRAL" && s !== "AMBIGUOUS").length,
    ambiguous: states.filter((s) => s === "AMBIGUOUS").length,
  };
}

// ---------------------------------------------------------------------------
// Borderline / margins
// ---------------------------------------------------------------------------

export type MarginStatus = "BORDERLINE / WITHHELD" | "CLEAR PASS" | "CLEAR FAIL" | "NOT EVALUATED" | "PASSED" | "FAILED";

export interface MarginReport {
  id: string;
  metric: string;
  value: number | null;
  threshold: number | null;
  comparator: string;
  /** value − threshold (signed). */
  margin: number | null;
  /** margin as a percentage of the threshold. */
  marginPct: number | null;
  band: { clear: number; fail: number } | null;
  status: MarginStatus;
  /** The decision as the engine made it. */
  decision: string;
  reason: string;
  gates: string | null;
}

export function marginReport(d: ThresholdDecision): MarginReport {
  const margin = d.value !== null && d.threshold !== null ? d.value - d.threshold : null;
  const status: MarginStatus =
    d.result === "BORDERLINE_INSUFFICIENT" ? "BORDERLINE / WITHHELD" : d.result === "NOT_EVALUATED" ? "NOT EVALUATED" : d.result === "PASSED" ? "PASSED" : d.result === "FAILED" ? "FAILED" : d.result === "OBSERVED" ? "CLEAR PASS" : "CLEAR FAIL";
  return {
    id: d.id,
    metric: d.metric,
    value: d.value,
    threshold: d.threshold,
    comparator: d.comparator,
    margin,
    marginPct: margin !== null && d.threshold ? (margin / Math.abs(d.threshold)) * 100 : null,
    band: d.borderline,
    status,
    decision: d.result,
    reason: d.note,
    gates: d.gates,
  };
}

function allSamples(s: CalibrationSession): { label: string; sample: CalibrationSample }[] {
  return [
    ...Object.entries(s.photoSamples).map(([slot, sample]) => ({ label: slot, sample: sample! })),
    ...(s.videoSample ? [{ label: "video", sample: s.videoSample }] : []),
  ];
}

/** Every observation-type decision with its margin, borderline ones first. */
export function sessionMargins(s: CalibrationSession): (MarginReport & { source: string })[] {
  const out = allSamples(s).flatMap(({ label, sample }) => sample.thresholdDecisions.filter((d) => d.kind === "observation").map((d) => ({ ...marginReport(d), source: label })));
  return out.sort((a, b) => Number(b.status === "BORDERLINE / WITHHELD") - Number(a.status === "BORDERLINE / WITHHELD"));
}

export const borderlineDecisions = (s: CalibrationSession) => sessionMargins(s).filter((m) => m.status === "BORDERLINE / WITHHELD");

// ---------------------------------------------------------------------------
// Multi-view consistency (priority 7)
// ---------------------------------------------------------------------------

export interface ConsistencyReport {
  contour: { metric: string; values: { view: string; value: number }[]; spread: number | null }[];
  /** Left vs right 45° outline angles beyond the engine's disagreement guard — the same check the treatment engine applies. */
  contourViewsDisagree: boolean;
  disagreementThresholdDeg: number;
  brightnessSpread: number | null;
  brightnessFlagged: boolean;
  faceSizeRatio: number | null;
  faceSizeFlagged: boolean;
  notes: string[];
}

export function multiViewConsistency(s: CalibrationSession): ConsistencyReport {
  const observations: Observation<unknown>[] = Object.values(s.photoSamples).flatMap((x) => x?.generatedObservations ?? []);
  const groups = new Map<string, { view: string; value: number }[]>();
  for (const o of observations) {
    const m = /^facialStructure\.contour\.(cheekContourAngle|jawContourAngle)\.(\w+)\.(\w+)$/.exec(o.id);
    if (m && typeof o.value === "number") groups.set(m[1], [...(groups.get(m[1]) ?? []), { view: `${m[2]} (${m[3]})`, value: o.value }]);
  }
  const contour = [...groups.entries()].map(([metric, values]) => ({ metric, values, spread: values.length > 1 ? Math.max(...values.map((v) => v.value)) - Math.min(...values.map((v) => v.value)) : null }));

  const photos = Object.values(s.photoSamples).map((x) => x!.rawMetrics as RawPhotoMetrics);
  const bright = photos.map((p) => p.meanBrightness).filter((v): v is number => v !== null);
  const widths = photos.map((p) => (p.faceBoundingBox ? p.faceBoundingBox.maxX - p.faceBoundingBox.minX : null)).filter((v): v is number => v !== null && v > 0);
  const brightnessSpread = bright.length > 1 ? Math.max(...bright) - Math.min(...bright) : null;
  const faceSizeRatio = widths.length > 1 ? Math.max(...widths) / Math.min(...widths) : null;

  const disagree = contourViewsDisagree(observations);
  const notes: string[] = [];
  if (disagree) notes.push(`Left and right 45° outline angles differ by more than ${CONTOUR_VIEW_DISAGREEMENT_DEG}°: the treatment engine would set this contour evidence aside.`);
  if (brightnessSpread !== null && brightnessSpread > BRIGHTNESS_DIFFERENCE_WARNING) notes.push("Lighting differs a lot between photos.");
  if (faceSizeRatio !== null && faceSizeRatio > FRAME_COVERAGE_RATIO_WARNING) notes.push("The face is a very different size in frame between photos.");
  if (contour.length === 0) notes.push("No contour observations: needs a usable front photo and at least one usable 45° photo.");

  return {
    contour,
    contourViewsDisagree: disagree,
    disagreementThresholdDeg: CONTOUR_VIEW_DISAGREEMENT_DEG,
    brightnessSpread,
    brightnessFlagged: brightnessSpread !== null && brightnessSpread > BRIGHTNESS_DIFFERENCE_WARNING,
    faceSizeRatio,
    faceSizeFlagged: faceSizeRatio !== null && faceSizeRatio > FRAME_COVERAGE_RATIO_WARNING,
    notes,
  };
}

// ---------------------------------------------------------------------------
// Session summary
// ---------------------------------------------------------------------------

export interface SessionReport {
  sessionId: string;
  photos: { submitted: number; processed: number; missingRequired: string[] };
  photoQuality: Record<QualityLabel, number>;
  video: { supplied: boolean; frames: VideoFrameCounts | null; quality: QualityLabel | null };
  rows: ComparisonRow[];
  totals: { matches: number; potentialMisses: number; potentialFalsePositives: number; unclear: number; notRecorded: number };
  /** One cautious sentence per recorded expectation, e.g. "Forehead lines: expected clearly present · not detected — Potential miss". */
  lines: string[];
  consistency: ConsistencyReport;
  borderlineCount: number;
}

const wording = (e: string | null) => (e === "clearly" ? "clearly present" : e === "subtle" ? "subtle" : e === "absent" ? "absent" : e === "unclear" ? "unclear" : (e ?? "not recorded"));
const ACTUAL_WORDING = { detected: "detected", not_detected: "not detected", withheld_borderline: "withheld (borderline)", not_evaluated: "could not be evaluated" } as const;

export function buildSessionReport(s: CalibrationSession): SessionReport {
  const rows = compareSession(s);
  const cov = baselineCoverage(s);
  const photos = Object.values(s.photoSamples).map((x) => x!);
  const quality: Record<QualityLabel, number> = { usable: 0, borderline: 0, unusable: 0 };
  for (const p of photos) quality[sampleQualityActual(p)]++;

  const rawVideo = s.videoSample?.rawMetrics.kind === "video" ? s.videoSample.rawMetrics : null;
  const totals = {
    matches: rows.filter((r) => r.result === "MATCH").length,
    potentialMisses: rows.filter((r) => r.result === "MISS").length,
    potentialFalsePositives: rows.filter((r) => r.result === "FALSE_POSITIVE").length,
    unclear: rows.filter((r) => r.result === "UNCLEAR").length,
    notRecorded: rows.filter((r) => r.result === "NOT_RECORDED").length,
  };

  const lines = rows
    .filter((r) => r.result !== "NOT_RECORDED")
    .map((r) => {
      const actual = r.actualQuality ?? ACTUAL_WORDING[r.actual.state];
      const flag = potentialWording(r.result);
      return `${r.label}: expected ${wording(r.expected)} · ${actual}${flag ? ` — ${flag}` : r.result === "UNCLEAR" ? " — unclear" : r.result === "MATCH" ? " — match" : ""}`;
    });

  return {
    sessionId: s.sessionId,
    photos: {
      submitted: cov.submitted,
      processed: photos.filter((p) => p.rawMetrics.kind === "photo" && p.rawMetrics.detectionStatus === "detected").length,
      missingRequired: cov.missingRequired,
    },
    photoQuality: quality,
    video: { supplied: !!s.videoSample, frames: rawVideo ? videoFrameCounts(rawVideo) : null, quality: s.videoSample ? sampleQualityActual(s.videoSample) : null },
    rows,
    totals,
    lines,
    consistency: multiViewConsistency(s),
    borderlineCount: borderlineDecisions(s).length,
  };
}

// ---------------------------------------------------------------------------
// Aggregate across sessions
// ---------------------------------------------------------------------------

export interface DomainAggregate {
  domain: ComparisonDomain;
  label: string;
  samplesWithExpectation: number;
  expectedPositive: number;
  detectedPositive: number;
  potentialMisses: number;
  expectedAbsent: number;
  potentialFalsePositives: number;
  unclear: number;
  /** Detected ÷ evaluable expected-clearly samples. Null until MIN_LABELLED_FOR_RATE such samples exist. */
  detectionRate: number | null;
  /** Detected ÷ evaluable expected-absent samples. Null until MIN_LABELLED_FOR_RATE such samples exist. */
  falsePositiveRate: number | null;
}

export interface AggregateReport {
  label: typeof STATISTIC_LABEL;
  disclaimer: string;
  samplesEvaluated: number;
  minLabelledForRate: number;
  domains: DomainAggregate[];
}

export function aggregateSessions(sessions: CalibrationSession[]): AggregateReport {
  const byDomain = new Map<ComparisonDomain, { label: string; rows: ComparisonRow[] }>();
  for (const s of sessions) {
    for (const r of compareSession(s)) {
      const entry = byDomain.get(r.domain) ?? { label: r.label.replace(/ — .*$/, ""), rows: [] };
      entry.rows.push(r);
      byDomain.set(r.domain, entry);
    }
  }

  const domains: DomainAggregate[] = [...byDomain.entries()]
    .filter(([domain]) => !domain.startsWith("quality."))
    .map(([domain, { label, rows }]) => {
      const recorded = rows.filter((r) => r.result !== "NOT_RECORDED");
      const evaluable = (r: ComparisonRow) => r.actual.state !== "not_evaluated";
      const positives = recorded.filter((r) => r.expected === "clearly");
      const absents = recorded.filter((r) => r.expected === "absent");
      const evalPos = positives.filter(evaluable);
      const evalAbs = absents.filter(evaluable);
      const detectedPositive = evalPos.filter((r) => r.actual.state === "detected").length;
      const falsePos = evalAbs.filter((r) => r.actual.state === "detected").length;
      return {
        domain,
        label,
        samplesWithExpectation: recorded.length,
        expectedPositive: positives.length,
        detectedPositive,
        potentialMisses: recorded.filter((r) => r.result === "MISS").length,
        expectedAbsent: absents.length,
        potentialFalsePositives: recorded.filter((r) => r.result === "FALSE_POSITIVE").length,
        unclear: recorded.filter((r) => r.result === "UNCLEAR").length,
        detectionRate: evalPos.length >= MIN_LABELLED_FOR_RATE ? detectedPositive / evalPos.length : null,
        falsePositiveRate: evalAbs.length >= MIN_LABELLED_FOR_RATE ? falsePos / evalAbs.length : null,
      };
    });

  return { label: STATISTIC_LABEL, disclaimer: STATISTIC_DISCLAIMER, samplesEvaluated: sessions.length, minLabelledForRate: MIN_LABELLED_FOR_RATE, domains };
}
