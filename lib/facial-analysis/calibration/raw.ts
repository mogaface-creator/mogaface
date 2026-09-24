/**
 * Raw metric collection — pure functions that turn what the pipeline already
 * computed into the numbers a calibrator needs to see. Nothing here decides
 * anything; decisions.ts applies the thresholds to these values.
 */

import { boundingBox } from "../geometry.ts";
import { REQUIRED_LANDMARK_INDICES } from "../landmarkMapping.ts";
import { estimateRollDegrees, estimateYawRatio } from "../quality.ts";
import { glabellarRegion, foreheadRegion, lateralEyeRegions, lineBandContrast, localTextureContrast } from "../regions.ts";
import type { GrayImage } from "../regions.ts";
import { LANDMARK } from "../landmarkMapping.ts";
import type { PhotoAnalysisRecord } from "../multiPhoto/types.ts";
import type { LandmarkList } from "../types.ts";
import type { ActiveExpressionState, VideoExpressionAnalysis } from "../video/types.ts";
import type { RawPhotoMetrics, RawVideoMetrics, StateCandidate } from "./types.ts";

const ACTIVE: ActiveExpressionState[] = ["BROW_RAISE", "FROWN", "SMILE", "SQUINT"];

/** Nose-to-face-edge span ratio (larger/smaller). Infinity if one side collapses. Same measure contour.ts uses to pick a near side. */
function nearSideSpanRatio(lm: LandmarkList): number | null {
  const nose = lm[LANDMARK.noseTip];
  const right = lm[LANDMARK.faceRightEdge];
  const left = lm[LANDMARK.faceLeftEdge];
  if (!nose || !right || !left) return null;
  const a = Math.abs(nose.x - right.x);
  const b = Math.abs(left.x - nose.x);
  const smaller = Math.min(a, b);
  return smaller === 0 ? Infinity : Math.max(a, b) / smaller;
}

function staticLineContrast(lm: LandmarkList, gray: GrayImage): RawPhotoMetrics["staticLineContrast"] {
  const forehead = foreheadRegion(lm, gray);
  const glabellar = glabellarRegion(lm, gray);
  const [right, left] = lateralEyeRegions(lm, gray);
  return {
    forehead: forehead ? lineBandContrast(gray, forehead, "horizontal") : null,
    glabellar: glabellar ? lineBandContrast(gray, glabellar, "vertical") : null,
    lateralEyeRight: right ? localTextureContrast(gray, right) : null,
    lateralEyeLeft: left ? localTextureContrast(gray, left) : null,
  };
}

const finite = (v: number | null | undefined): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function collectRawPhotoMetrics(record: PhotoAnalysisRecord, gray: GrayImage | null): RawPhotoMetrics {
  const lm = record.landmarks;
  const detectionStatus: RawPhotoMetrics["detectionStatus"] =
    record.faceCount === null ? "error" : record.faceCount === 0 ? "no_face" : record.faceCount > 1 ? "multiple_faces" : "detected";
  const w = record.imageWidth ?? 1;
  const h = record.imageHeight ?? 1;
  const box = lm ? boundingBox(lm) : null;

  return {
    kind: "photo",
    imageWidth: record.imageWidth,
    imageHeight: record.imageHeight,
    detectionStatus,
    faceCount: record.faceCount,
    qualityScore: record.quality?.qualityScore ?? null,
    qualityValid: record.quality?.valid ?? null,
    qualityErrors: record.quality?.errors ?? record.errors,
    qualityWarnings: record.quality?.warnings ?? record.warnings,
    rollDegrees: lm ? finite(estimateRollDegrees(lm, w, h)) : null,
    yawRatio: lm ? estimateYawRatio(lm) : null,
    nearSideSpanRatio: lm ? nearSideSpanRatio(lm) : null,
    meanBrightness: record.meanBrightness,
    faceBoundingBox: box && Number.isFinite(box.minX) ? { minX: box.minX, minY: box.minY, maxX: box.maxX, maxY: box.maxY } : null,
    landmarkCount: lm?.length ?? 0,
    requiredLandmarksPresent: !!lm && REQUIRED_LANDMARK_INDICES.every((i) => lm[i] && Number.isFinite(lm[i].x) && Number.isFinite(lm[i].y)),
    measurements: record.measurements,
    contour: record.contour ?? null,
    underEye: record.underEye ?? null,
    staticLineContrast: lm && gray ? staticLineContrast(lm, gray) : null,
  };
}

export function collectRawVideoMetrics(video: VideoExpressionAnalysis): RawVideoMetrics {
  const byIndex = new Map(video.classifications.map((c) => [c.index, c]));

  const frames = video.frames.map((f) => {
    const c = byIndex.get(f.index);
    return {
      index: f.index,
      timeSec: f.timeSec,
      usable: f.usable,
      reasons: f.reasons,
      qualityScore: f.quality.qualityScore ?? null,
      state: c?.state ?? null,
      movementPct: c?.movementPct ?? null,
      features: c?.features ?? null,
    };
  });

  const stateCandidates = Object.fromEntries(
    ACTIVE.map((s): [ActiveExpressionState, StateCandidate] => {
      const accepted = video.classifications.filter((c) => c.state === s).map((c) => c.index);
      const best = video.classifications.reduce<{ index: number; pct: number } | null>(
        (acc, c) => (acc === null || c.movementPct[s] > acc.pct ? { index: c.index, pct: c.movementPct[s] } : acc),
        null,
      );
      return [s, { frameIndices: accepted, bestFrame: best?.index ?? null, bestMovementPct: best?.pct ?? null }];
    }),
  ) as Record<ActiveExpressionState, StateCandidate>;

  return {
    kind: "video",
    metadata: video.metadata,
    framesSampled: video.framesSampled,
    framesUsable: video.framesUsable,
    frames,
    baseline: video.baseline
      ? { frames: video.baseline.frames, stable: video.baseline.stable, maxSpread: video.baseline.maxSpread, features: video.baseline.features }
      : null,
    neutralFrameCandidates: video.classifications.filter((c) => c.state === "NEUTRAL").map((c) => c.index),
    stateCandidates,
    linePatterns: video.linePatterns.map((p) => ({
      kind: p.kind,
      expression: p.expression,
      status: p.status,
      neutralContrast: p.neutralContrast,
      expressionContrast: p.expressionContrast,
      contrastRatio: p.contrastRatio,
    })),
    notes: video.notes,
  };
}
