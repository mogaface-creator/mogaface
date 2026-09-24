/**
 * Facial contour geometry — RELATIVE geometry of the face-oval outline
 * between ear level and chin, from the landmarks of one photo.
 *
 * These are angles and ratios, not volumes: no absolute size, no comparison
 * to an ideal, and no statement that any value means too little or too much
 * of anything. They describe the shape of the outline in that photo at that
 * head pose. The Treatment Opportunity Engine may read them together with a
 * user's stated goal; this module never interprets them.
 *
 * Angles are computed in pixel space (landmarks × image size) so a non-square
 * photo does not distort them.
 */

import { LANDMARK } from "./landmarkMapping.ts";
import { angle, ratio } from "./geometry.ts";
import type { LandmarkList, Point2D } from "./types.ts";

export type FaceSide = "right" | "left";

export interface ContourSide {
  /** Angle (degrees) of the outline at the cheek point, between the ear-level point and the jaw-angle point. */
  cheekContourAngle: number;
  /** Angle (degrees) of the outline at the jaw-angle point, between the cheek point and the chin-side point. */
  jawContourAngle: number;
}

export interface ContourGeometry {
  right: ContourSide | null;
  left: ContourSide | null;
  /**
   * The side of the face turned toward the camera. In a turned (45°) view the
   * far side is foreshortened, so only the near side is reported there; null
   * when the view is frontal enough that both sides are.
   */
  nearSide: FaceSide | null;
  /** Front-view only (null otherwise): jaw width / face width. */
  jawToFaceWidthRatio: number | null;
  /** Front-view only (null otherwise): nose-base-to-chin height / jaw width. */
  lowerFaceContourRatio: number | null;
}

const LANDMARK_SETS = {
  right: {
    ear: LANDMARK.faceRightEdge,
    cheek: LANDMARK.rightOvalCheek,
    jaw: LANDMARK.rightJaw,
    chinSide: LANDMARK.rightOvalJawFront,
  },
  left: {
    ear: LANDMARK.faceLeftEdge,
    cheek: LANDMARK.leftOvalCheek,
    jaw: LANDMARK.leftJaw,
    chinSide: LANDMARK.leftOvalJawFront,
  },
} as const;

/** How much wider one side's nose-to-face-edge span must be before the view counts as turned. */
export const TURNED_SPAN_RATIO = 1.25;

function px(p: Point2D, w: number, h: number): Point2D {
  return { x: p.x * w, y: p.y * h };
}

function contourSide(lm: LandmarkList, side: FaceSide, w: number, h: number): ContourSide | null {
  const s = LANDMARK_SETS[side];
  const [ear, cheek, jaw, chinSide] = [s.ear, s.cheek, s.jaw, s.chinSide].map((i) => lm[i] && px(lm[i], w, h));
  if (!ear || !cheek || !jaw || !chinSide) return null;
  const cheekAngle = angle(ear, cheek, jaw);
  const jawAngle = angle(cheek, jaw, chinSide);
  if (!Number.isFinite(cheekAngle) || !Number.isFinite(jawAngle)) return null;
  return { cheekContourAngle: cheekAngle, jawContourAngle: jawAngle };
}

/** Which side faces the camera, judged from where the nose tip sits between the face edges; null if roughly frontal. */
export function nearSideOf(lm: LandmarkList): FaceSide | null {
  const nose = lm[LANDMARK.noseTip];
  const right = lm[LANDMARK.faceRightEdge];
  const left = lm[LANDMARK.faceLeftEdge];
  if (!nose || !right || !left) return null;
  const rightSpan = Math.abs(nose.x - right.x);
  const leftSpan = Math.abs(left.x - nose.x);
  const smaller = Math.min(rightSpan, leftSpan);
  if (smaller === 0) return rightSpan > leftSpan ? "right" : "left";
  if (Math.max(rightSpan, leftSpan) / smaller < TURNED_SPAN_RATIO) return null;
  return rightSpan > leftSpan ? "right" : "left";
}

/**
 * `view`: "front" reports both sides plus the two front-only ratios;
 * "threeQuarter" reports only the near side and no ratios (foreshortened).
 * Profile photos are not supported — see viewCapabilities.ts.
 */
export function calculateContourGeometry(
  lm: LandmarkList,
  imageWidth: number,
  imageHeight: number,
  view: "front" | "threeQuarter",
): ContourGeometry {
  const right = contourSide(lm, "right", imageWidth, imageHeight);
  const left = contourSide(lm, "left", imageWidth, imageHeight);

  if (view === "threeQuarter") {
    const near = nearSideOf(lm);
    return {
      right: near === "right" ? right : null,
      left: near === "left" ? left : null,
      nearSide: near,
      jawToFaceWidthRatio: null,
      lowerFaceContourRatio: null,
    };
  }

  const w = (a: number, b: number) => Math.abs(lm[a].x - lm[b].x) * imageWidth;
  const jawWidth = w(LANDMARK.rightJaw, LANDMARK.leftJaw);
  const faceWidth = w(LANDMARK.faceRightEdge, LANDMARK.faceLeftEdge);
  const lowerFaceHeight = Math.abs(lm[LANDMARK.chin].y - lm[LANDMARK.noseBase].y) * imageHeight;

  return {
    right,
    left,
    nearSide: null,
    jawToFaceWidthRatio: ratio(jawWidth, faceWidth),
    lowerFaceContourRatio: ratio(lowerFaceHeight, jawWidth),
  };
}
