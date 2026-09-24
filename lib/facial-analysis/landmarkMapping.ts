/**
 * Centralized semantic landmark map for the MediaPipe Face Landmarker's
 * 478-point canonical face mesh. Every index used anywhere in the analysis
 * engine must be looked up from here — never hard-code a raw index elsewhere.
 *
 * "left"/"right" below are anatomical (the subject's own left/right), which
 * matches MediaPipe's own naming in face_mesh_connections.py (FACEMESH_LEFT_EYE
 * / FACEMESH_RIGHT_EYE). On a typical un-mirrored front-facing photo, the
 * subject's right side appears on the left side of the image.
 *
 * Indices were cross-checked against MediaPipe's official connection sets
 * (FACEMESH_LEFT_EYE, FACEMESH_RIGHT_EYE, FACEMESH_LIPS, FACEMESH_FACE_OVAL)
 * from google-ai-edge/mediapipe. Points not covered by an official named set
 * (nose ala, jaw gonion, eyebrows) were assigned by their consistent ~+230
 * index offset between the confirmed right/left pairs (33→263, 61→291,
 * 234→454), which mirrors how the canonical model groups right-side and
 * left-side points.
 */

export const LANDMARK = {
  // Midline reference points.
  /** Top of the mesh, near the hairline. Not a true trichion — the mesh does
   * not track hair, so this is an approximation of the upper forehead boundary. */
  foreheadTop: 10,
  /** Glabella — between the eyebrows. Used as the upper-third/middle-third boundary. */
  glabella: 9,
  /** Subnasale — base of the nose, where it meets the upper lip. */
  noseBase: 2,
  /** Tip of the nose. */
  noseTip: 1,
  /** Center of the outer upper lip. */
  upperLip: 0,
  /** Center of the outer lower lip. */
  lowerLip: 17,
  /** Bottom of the chin. */
  chin: 152,

  // Right eye (subject's right).
  rightEyeOuter: 33,
  rightEyeInner: 133,
  // Left eye (subject's left).
  leftEyeInner: 362,
  leftEyeOuter: 263,

  // Eyebrows. Lower confidence than eye/mouth corners since brow hair can
  // shift the visible edge; used only for symmetry, not load-bearing ratios.
  rightEyebrowOuter: 70,
  rightEyebrowInner: 107,
  leftEyebrowInner: 336,
  leftEyebrowOuter: 300,

  // Nose ala (the widest visible points of the nostrils' outer wings).
  noseRightAla: 129,
  noseLeftAla: 358,

  // Mouth corners.
  mouthRight: 61,
  mouthLeft: 291,

  // Jaw — approximate gonion (jaw-angle) points, used for jaw width.
  // These sit on the mesh's face-oval contour, not a true bony landmark,
  // so jaw width should be read as an approximation.
  rightJaw: 172,
  leftJaw: 397,

  // Face boundary (cheek extremes at ear level) — used for face width.
  faceRightEdge: 234,
  faceLeftEdge: 454,

  // --- Added for the visual-observation layer (video expressions, under-eye
  // region, contour geometry). Every index below was checked against
  // MediaPipe's own connection sets (FACE_LANDMARKS_RIGHT_EYE / LEFT_EYE /
  // RIGHT_EYEBROW / LEFT_EYEBROW / LIPS / FACE_OVAL as exposed by
  // @mediapipe/tasks-vision), not inferred from an offset.

  // Eyelid centers: vertical eye opening = lower - upper.
  rightUpperLid: 159,
  rightLowerLid: 145,
  leftUpperLid: 386,
  leftLowerLid: 374,

  // Middle of each eyebrow's upper contour: brow-to-eye distance tracks brow raise.
  rightEyebrowMid: 105,
  leftEyebrowMid: 334,

  // Inner lip edges: mouth opening.
  innerUpperLip: 13,
  innerLowerLip: 14,

  // Face-oval contour between ear level and chin, subject's right then left.
  // Oval order (ear → chin): 234, 93, 132, 58, 172, 136, 150, 149, 176, 148, 152
  // and mirrored 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152.
  rightOvalCheek: 132,
  rightOvalJawFront: 150,
  leftOvalCheek: 361,
  leftOvalJawFront: 379,
} as const;

export type LandmarkName = keyof typeof LANDMARK;

/** All indices this module depends on, for a cheap "did detection return enough points" check. */
export const REQUIRED_LANDMARK_INDICES: number[] = Array.from(new Set(Object.values(LANDMARK)));
