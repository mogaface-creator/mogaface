import { LANDMARK } from "./landmarkMapping.ts";
import { distance, horizontalDistance, verticalDistance, ratio, percentageDifference } from "./geometry.ts";
import { normalizeToFaceWidth } from "./normalization.ts";
import type { FaceMeasurements, LandmarkList } from "./types.ts";

function at(landmarks: LandmarkList, index: number) {
  const p = landmarks[index];
  if (!p) {
    throw new Error(`Landmark index ${index} missing from detection result (expected 478 points).`);
  }
  return p;
}

/** Computes all structured facial measurements from a raw landmark list. */
export function calculateMeasurements(landmarks: LandmarkList): FaceMeasurements {
  const faceWidth = horizontalDistance(at(landmarks, LANDMARK.faceRightEdge), at(landmarks, LANDMARK.faceLeftEdge));
  const faceHeight = verticalDistance(at(landmarks, LANDMARK.foreheadTop), at(landmarks, LANDMARK.chin));

  const leftEyeWidth = distance(at(landmarks, LANDMARK.leftEyeInner), at(landmarks, LANDMARK.leftEyeOuter));
  const rightEyeWidth = distance(at(landmarks, LANDMARK.rightEyeInner), at(landmarks, LANDMARK.rightEyeOuter));
  const interocularDistance = distance(at(landmarks, LANDMARK.rightEyeInner), at(landmarks, LANDMARK.leftEyeInner));
  const eyeWidthDifference = Math.abs(leftEyeWidth - rightEyeWidth);
  const eyeWidthDifferencePct = percentageDifference(leftEyeWidth, rightEyeWidth) ?? 0;

  const noseWidth = distance(at(landmarks, LANDMARK.noseRightAla), at(landmarks, LANDMARK.noseLeftAla));
  const noseHeight = verticalDistance(at(landmarks, LANDMARK.glabella), at(landmarks, LANDMARK.noseBase));

  const mouthWidth = distance(at(landmarks, LANDMARK.mouthRight), at(landmarks, LANDMARK.mouthLeft));

  const jawWidth = distance(at(landmarks, LANDMARK.rightJaw), at(landmarks, LANDMARK.leftJaw));
  const chinHeight = verticalDistance(at(landmarks, LANDMARK.lowerLip), at(landmarks, LANDMARK.chin));
  const lowerFaceHeight = verticalDistance(at(landmarks, LANDMARK.noseBase), at(landmarks, LANDMARK.chin));

  const upperThird = verticalDistance(at(landmarks, LANDMARK.foreheadTop), at(landmarks, LANDMARK.glabella));
  const middleThird = verticalDistance(at(landmarks, LANDMARK.glabella), at(landmarks, LANDMARK.noseBase));
  const lowerThird = verticalDistance(at(landmarks, LANDMARK.noseBase), at(landmarks, LANDMARK.chin));

  return {
    face: {
      width: faceWidth,
      height: faceHeight,
      widthHeightRatio: ratio(faceWidth, faceHeight) ?? 0,
    },
    eyes: {
      leftEyeWidth,
      rightEyeWidth,
      interocularDistance,
      eyeWidthDifference,
      eyeWidthDifferencePct,
    },
    nose: {
      width: noseWidth,
      height: noseHeight > 0 ? noseHeight : null,
      widthToFaceWidthRatio: normalizeToFaceWidth(noseWidth, faceWidth) ?? 0,
    },
    mouth: {
      width: mouthWidth,
      widthToFaceWidthRatio: normalizeToFaceWidth(mouthWidth, faceWidth) ?? 0,
    },
    jaw: {
      width: jawWidth,
      chinHeight: chinHeight > 0 ? chinHeight : null,
      lowerFaceHeight,
    },
    thirds: {
      upper: upperThird,
      middle: middleThird,
      lower: lowerThird,
    },
  };
}
