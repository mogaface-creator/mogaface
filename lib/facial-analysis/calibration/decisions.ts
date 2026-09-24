/**
 * Threshold decisions — for every threshold-based call the visual layer
 * makes, the metric, the value it saw, the threshold, and the result. This
 * is what lets a developer see exactly WHY something was (or was not)
 * observed. Recomputed from raw metrics using the SAME constants and band
 * logic as the layer itself, so it cannot disagree with it.
 */

import { classifyAgainstBand } from "../bands.ts";
import { TURNED_SPAN_RATIO } from "../contour.ts";
import { MAX_BRIGHTNESS, MAX_ROLL_DEGREES, MAX_YAW_RATIO, MIN_BRIGHTNESS, MIN_FACE_WIDTH_WARNING, MIN_RESOLUTION_WARNING } from "../quality.ts";
import { UNDER_EYE_DARKER_RATIO, UNDER_EYE_DARKNESS_BAND, classifyUnderEyeRatio } from "../underEye.ts";
import {
  BASELINE_STABILITY,
  MOVEMENT_BORDERLINE_FRACTION,
  MOVEMENT_THRESHOLD_PCT,
  NEUTRAL_FRACTION,
} from "../video/expressions.ts";
import { CONSISTENT_CV, HIGH_STRENGTH_MIN_FRAMES, LINE_CONTRAST_BAND, LINE_CONTRAST_FLOOR, LINE_CONTRAST_RATIO_THRESHOLD } from "../video/observe.ts";
import type { BandResult } from "../bands.ts";
import type { ActiveExpressionState } from "../video/types.ts";
import type { DecisionResult, RawPhotoMetrics, RawVideoMetrics, ThresholdDecision } from "./types.ts";

const fromBand = (b: BandResult): DecisionResult => (b === "PASSES" ? "OBSERVED" : b === "BORDERLINE" ? "BORDERLINE_INSUFFICIENT" : "NOT_OBSERVED");

function gate(id: string, metric: string, value: number | null, threshold: number, comparator: ">=" | "<=", note: string): ThresholdDecision {
  const ok = value === null ? null : comparator === ">=" ? value >= threshold : value <= threshold;
  return {
    id,
    kind: "quality_gate",
    metric,
    value,
    threshold,
    comparator,
    borderline: null,
    result: ok === null ? "NOT_EVALUATED" : ok ? "PASSED" : "FAILED",
    note: value === null ? "Could not be measured." : note,
    gates: null,
  };
}

/** Decisions for one photo. `role` is the slot the developer declared for it. */
export function photoThresholdDecisions(raw: RawPhotoMetrics, role: string): ThresholdDecision[] {
  const out: ThresholdDecision[] = [];
  const front = role === "front";
  const threeQuarter = role === "leftFortyFive" || role === "rightFortyFive";

  const minSide = raw.imageWidth !== null && raw.imageHeight !== null ? Math.min(raw.imageWidth, raw.imageHeight) : null;
  out.push(gate("photo.resolution", "Short side of the image (px)", minSide, MIN_RESOLUTION_WARNING, ">=", "Below this the photo warns; below the hard floor it is rejected."));
  out.push(gate("photo.faceWidth", "Face width as a fraction of the frame", raw.faceBoundingBox ? raw.faceBoundingBox.maxX - raw.faceBoundingBox.minX : null, MIN_FACE_WIDTH_WARNING, ">=", "Below this the face is small in the frame."));
  out.push(gate("photo.brightnessMin", "Mean brightness (0-255)", raw.meanBrightness, MIN_BRIGHTNESS, ">=", "Below this the photo is too dark."));
  out.push(gate("photo.brightnessMax", "Mean brightness (0-255)", raw.meanBrightness, MAX_BRIGHTNESS, "<=", "Above this the photo is overexposed."));

  if (front) {
    out.push(gate("photo.roll", "Tilt of the eye line (degrees, absolute)", raw.rollDegrees === null ? null : Math.abs(raw.rollDegrees), MAX_ROLL_DEGREES, "<=", "Front photos above this are warned as tilted."));
    out.push(gate("photo.yaw", "Nose-to-eye span ratio (1 = frontal)", raw.yawRatio, MAX_YAW_RATIO, "<=", "Front photos above this are warned as turned."));
  }
  if (threeQuarter) {
    out.push({
      ...gate("photo.turned45", "Nose-to-face-edge span ratio (turned enough for a 45° view)", raw.nearSideSpanRatio, TURNED_SPAN_RATIO, ">=", "At or above this a 45° photo reports its near-side contour; below it (looks frontal) it contributes no contour observations."),
      gates: "facialStructure.contour.*",
    });
  }

  // Under-eye: per eye, then combined — mirrors photoDomains/underEye.ts exactly.
  const ue = raw.underEye;
  for (const side of ["right", "left"] as const) {
    const ratio = ue?.[side]?.luminanceRatio ?? null;
    out.push({
      id: `photo.underEyeRatio.${side}`,
      kind: "observation",
      metric: `Under-eye brightness ÷ adjacent cheek (${side} eye)`,
      value: ratio,
      threshold: UNDER_EYE_DARKER_RATIO,
      comparator: "<=",
      borderline: UNDER_EYE_DARKNESS_BAND,
      result: ratio === null ? "NOT_EVALUATED" : fromBand(classifyUnderEyeRatio(ratio)),
      note: ratio === null ? "This eye's regions could not be measured (no face, or regions fell outside the image)." : "Below 1 = the under-eye strip looks darker than the cheek in this photo (says nothing about why).",
      gates: "eyeArea.visibleUnderEyeDarkness",
    });
  }
  const sides = (["right", "left"] as const).map((s) => out.find((d) => d.id === `photo.underEyeRatio.${s}`)!);
  const combined: DecisionResult = sides.some((d) => d.result === "NOT_EVALUATED")
    ? "NOT_EVALUATED"
    : sides.some((d) => d.result === "NOT_OBSERVED")
      ? "NOT_OBSERVED"
      : sides.some((d) => d.result === "BORDERLINE_INSUFFICIENT")
        ? "BORDERLINE_INSUFFICIENT"
        : "OBSERVED";
  out.push({
    id: "photo.visibleUnderEyeDarkness",
    kind: "observation",
    metric: "Visible dark-looking under-eye appearance (both eyes)",
    value: ue?.right && ue?.left ? Math.max(ue.right.luminanceRatio, ue.left.luminanceRatio) : null,
    threshold: UNDER_EYE_DARKER_RATIO,
    comparator: "<=",
    borderline: UNDER_EYE_DARKNESS_BAND,
    result: combined,
    note: "Both eyes must clearly pass; the value shown is the LESS dark eye (the one that decides).",
    gates: "eyeArea.visibleUnderEyeDarkness",
  });
  return out;
}

const STATE_OBSERVATION: Record<ActiveExpressionState, string> = {
  BROW_RAISE: "expression.browRaise.foreheadRegionMovementPct",
  FROWN: "expression.frown.glabellarRegionMovementPct",
  SMILE: "expression.smile.mouthAreaMovementPct",
  SQUINT: "expression.squint.eyeAreaMovementPct",
};

const PATTERN_OBSERVATION = {
  forehead: "expression.visibleForeheadLinePattern",
  glabellar: "expression.visibleGlabellarLinePattern",
  lateralEye: "expression.visibleLateralEyeLinePattern",
} as const;

export function videoThresholdDecisions(raw: RawVideoMetrics): ThresholdDecision[] {
  const out: ThresholdDecision[] = [];

  out.push(
    raw.baseline
      ? gate("video.baselineStability", "Neutral-baseline spread ((max−min)/median, worst feature)", raw.baseline.maxSpread, BASELINE_STABILITY, "<=", "The opening frames must be a steady, relaxed face.")
      : { ...gate("video.baselineStability", "Neutral-baseline spread", null, BASELINE_STABILITY, "<=", ""), result: "FAILED", note: `No baseline could be established. ${raw.notes[0] ?? ""}`.trim() },
  );

  for (const state of Object.keys(MOVEMENT_THRESHOLD_PCT) as ActiveExpressionState[]) {
    const thr = MOVEMENT_THRESHOLD_PCT[state];
    const cand = raw.stateCandidates[state];
    const band = { clear: thr * (1 + MOVEMENT_BORDERLINE_FRACTION), fail: thr * NEUTRAL_FRACTION };
    let result: DecisionResult;
    let note: string;
    if (!raw.baseline) {
      result = "NOT_EVALUATED";
      note = "No neutral baseline, so no frame could be compared.";
    } else if (cand.frameIndices.length > 0) {
      result = "OBSERVED";
      note = `Frames ${cand.frameIndices.join(", ")} were classified as ${state}.`;
    } else if (cand.bestMovementPct !== null && cand.bestMovementPct >= band.fail && cand.bestMovementPct < band.clear) {
      result = "BORDERLINE_INSUFFICIENT";
      note = `Best frame (${cand.bestFrame}) is between the ambiguity floor and the clear threshold; not used as evidence.`;
    } else if (cand.bestMovementPct !== null && cand.bestMovementPct >= band.clear) {
      result = "NOT_OBSERVED";
      note = `Best frame (${cand.bestFrame}) passed the threshold but competed with another expression, so it was ambiguous.`;
    } else {
      result = "NOT_OBSERVED";
      note = "No frame moved noticeably toward this expression.";
    }
    out.push({
      id: `video.movement.${state}`,
      kind: "observation",
      metric: `${state} movement of the best frame (% vs neutral)`,
      value: cand.bestMovementPct,
      threshold: thr,
      comparator: ">=",
      borderline: band,
      result,
      note,
      gates: STATE_OBSERVATION[state],
    });

    // Consistency + frame count (drive evidence strength, not the observation itself).
    if (cand.frameIndices.length > 0) {
      const pcts = cand.frameIndices.map((i) => raw.frames.find((f) => f.index === i)?.movementPct?.[state]).filter((v): v is number => typeof v === "number");
      const avg = pcts.reduce((a, b) => a + b, 0) / pcts.length;
      const cv = avg === 0 ? null : Math.sqrt(pcts.reduce((a, p) => a + (p - avg) ** 2, 0) / pcts.length) / Math.abs(avg);
      out.push(gate(`video.consistency.${state}`, `${state} movement variation across frames (CV)`, cv, CONSISTENT_CV, "<=", "Needed (with enough frames) for high evidence strength."));
      out.push(gate(`video.frames.${state}`, `${state} frames accepted`, cand.frameIndices.length, HIGH_STRENGTH_MIN_FRAMES, ">=", "Needed for high evidence strength."));
    }
  }

  for (const p of raw.linePatterns) {
    const observation = PATTERN_OBSERVATION[p.kind];
    let result: DecisionResult;
    let note: string;
    if (p.contrastRatio === null) {
      result = "NOT_EVALUATED";
      note = "No usable pixel data or expression frames for this comparison.";
    } else if (p.status === "observed") {
      result = "OBSERVED";
      note = "Clearly above the threshold (and the brightness floor).";
    } else {
      const band = classifyAgainstBand(p.contrastRatio, LINE_CONTRAST_BAND, "atLeast");
      result = band === "BORDERLINE" ? "BORDERLINE_INSUFFICIENT" : "NOT_OBSERVED";
      note = band === "PASSES" ? "Ratio passed but expression-frame contrast was under the brightness floor." : band === "BORDERLINE" ? "Close to the threshold; not used as evidence." : "Expression frames were not clearly more line-banded than neutral.";
    }
    out.push({
      id: `video.lineContrast.${p.kind}.${p.expression}`,
      kind: "observation",
      metric: `${p.kind} line contrast: ${p.expression} ÷ neutral`,
      value: p.contrastRatio,
      threshold: LINE_CONTRAST_RATIO_THRESHOLD,
      comparator: ">=",
      borderline: LINE_CONTRAST_BAND,
      result,
      note: `${note} (neutral ${p.neutralContrast?.toFixed(4) ?? "—"}, expression ${p.expressionContrast?.toFixed(4) ?? "—"}; floor ${LINE_CONTRAST_FLOOR})`,
      gates: observation,
    });
  }
  return out;
}

