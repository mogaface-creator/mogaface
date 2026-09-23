/**
 * Geometric symmetry engine.
 *
 * Every metric compares a left-side measurement against its right-side
 * counterpart, relative to a midline estimated from three midline landmarks
 * (forehead top, nose tip, chin). This is purely a measure of geometric
 * mirror-symmetry in the photographed pose — it does not imply, and this
 * module never claims, that more symmetry is "better" or "more attractive".
 *
 * symmetryIndex = 100 - normalizedDifference, clamped to [0, 100].
 * A value of 100 means the two sides matched exactly on that metric in this
 * photo; a lower value means a larger relative difference was measured.
 */

import { LANDMARK } from "./landmarkMapping.ts";
import { distance, normalizedDifference } from "./geometry.ts";
import type { FaceMeasurements, LandmarkList, SymmetryMetric, SymmetryResult } from "./types.ts";

function at(landmarks: LandmarkList, index: number) {
  const p = landmarks[index];
  if (!p) {
    throw new Error(`Landmark index ${index} missing from detection result (expected 478 points).`);
  }
  return p;
}

function toMetric(name: string, leftValue: number, rightValue: number, reference: number): SymmetryMetric {
  const absoluteDifference = Math.abs(leftValue - rightValue);
  const normalized = normalizedDifference(leftValue, rightValue, reference) ?? 0;
  const symmetryIndex = Math.min(100, Math.max(0, 100 - normalized));
  return {
    metric: name,
    leftValue,
    rightValue,
    absoluteDifference,
    normalizedDifference: normalized,
    symmetryIndex,
  };
}

export function calculateSymmetry(landmarks: LandmarkList, measurements: FaceMeasurements): SymmetryResult {
  const faceWidth = measurements.face.width;
  const faceHeight = measurements.face.height;

  const foreheadTop = at(landmarks, LANDMARK.foreheadTop);
  const noseTip = at(landmarks, LANDMARK.noseTip);
  const chin = at(landmarks, LANDMARK.chin);
  const midlineX = (foreheadTop.x + noseTip.x + chin.x) / 3;

  const leftEyeOuter = at(landmarks, LANDMARK.leftEyeOuter);
  const rightEyeOuter = at(landmarks, LANDMARK.rightEyeOuter);
  const leftEyebrowOuter = at(landmarks, LANDMARK.leftEyebrowOuter);
  const rightEyebrowOuter = at(landmarks, LANDMARK.rightEyebrowOuter);

  const metrics: SymmetryMetric[] = [
    toMetric("Eye width symmetry", measurements.eyes.leftEyeWidth, measurements.eyes.rightEyeWidth, faceWidth),
    toMetric("Eye vertical position symmetry", leftEyeOuter.y, rightEyeOuter.y, faceHeight),
    toMetric(
      "Eyebrow symmetry",
      Math.abs(leftEyebrowOuter.y - leftEyeOuter.y),
      Math.abs(rightEyebrowOuter.y - rightEyeOuter.y),
      faceHeight,
    ),
    toMetric(
      "Nose alignment",
      distance({ x: midlineX, y: noseTip.y }, at(landmarks, LANDMARK.noseLeftAla)),
      distance({ x: midlineX, y: noseTip.y }, at(landmarks, LANDMARK.noseRightAla)),
      faceWidth,
    ),
    toMetric(
      "Mouth alignment",
      distance({ x: midlineX, y: at(landmarks, LANDMARK.mouthLeft).y }, at(landmarks, LANDMARK.mouthLeft)),
      distance({ x: midlineX, y: at(landmarks, LANDMARK.mouthRight).y }, at(landmarks, LANDMARK.mouthRight)),
      faceWidth,
    ),
    toMetric(
      "Lower-face symmetry",
      distance({ x: midlineX, y: at(landmarks, LANDMARK.leftJaw).y }, at(landmarks, LANDMARK.leftJaw)),
      distance({ x: midlineX, y: at(landmarks, LANDMARK.rightJaw).y }, at(landmarks, LANDMARK.rightJaw)),
      faceWidth,
    ),
  ];

  const overallSymmetryIndex =
    metrics.reduce((sum, m) => sum + m.symmetryIndex, 0) / (metrics.length || 1);

  return { metrics, overallSymmetryIndex };
}
