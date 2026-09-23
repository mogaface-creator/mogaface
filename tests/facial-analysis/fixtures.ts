import { LANDMARK } from "../../lib/facial-analysis/landmarkMapping.ts";
import type { LandmarkList } from "../../lib/facial-analysis/types.ts";

/** Builds a synthetic 478-point landmark list with a roughly symmetric frontal face. */
export function buildSymmetricFace(): LandmarkList {
  const lm: LandmarkList = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
  const set = (index: number, x: number, y: number) => {
    lm[index] = { x, y, z: 0 };
  };

  set(LANDMARK.foreheadTop, 0.5, 0.15);
  set(LANDMARK.glabella, 0.5, 0.38);
  set(LANDMARK.noseBase, 0.5, 0.6);
  set(LANDMARK.noseTip, 0.5, 0.55);
  set(LANDMARK.upperLip, 0.5, 0.68);
  set(LANDMARK.lowerLip, 0.5, 0.72);
  set(LANDMARK.chin, 0.5, 0.85);

  set(LANDMARK.rightEyeOuter, 0.32, 0.4);
  set(LANDMARK.rightEyeInner, 0.45, 0.4);
  set(LANDMARK.leftEyeInner, 0.55, 0.4);
  set(LANDMARK.leftEyeOuter, 0.68, 0.4);

  set(LANDMARK.rightEyebrowOuter, 0.3, 0.35);
  set(LANDMARK.rightEyebrowInner, 0.45, 0.34);
  set(LANDMARK.leftEyebrowInner, 0.55, 0.34);
  set(LANDMARK.leftEyebrowOuter, 0.7, 0.35);

  set(LANDMARK.noseRightAla, 0.45, 0.6);
  set(LANDMARK.noseLeftAla, 0.55, 0.6);

  set(LANDMARK.mouthRight, 0.4, 0.7);
  set(LANDMARK.mouthLeft, 0.6, 0.7);

  set(LANDMARK.rightJaw, 0.3, 0.75);
  set(LANDMARK.leftJaw, 0.7, 0.75);

  set(LANDMARK.faceRightEdge, 0.25, 0.5);
  set(LANDMARK.faceLeftEdge, 0.75, 0.5);

  return lm;
}

/** Same face, but with the right eye made narrower to produce a real asymmetry. */
export function buildAsymmetricFace(): LandmarkList {
  const lm = buildSymmetricFace();
  lm[LANDMARK.rightEyeOuter] = { x: 0.4, y: 0.4, z: 0 }; // eye narrowed
  return lm;
}
