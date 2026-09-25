/**
 * Guided camera capture — shared types.
 *
 * This module guides a person into a usable position and captures ONLY when
 * the existing quality/view rules say the frame is usable and steady. It does
 * not detect faces itself (it drives the existing MediaPipe FaceLandmarker),
 * defines no new measurement, and never guarantees a perfect image — it just
 * reduces bad inputs. Nothing captured here is stored or uploaded.
 */

import type { PhotoSlot } from "../facial-analysis/multiPhoto/types.ts";

export type CameraErrorKind =
  | "permission_denied"
  | "no_camera"
  | "camera_busy"
  | "unsupported"
  | "insecure_context"
  | "overconstrained"
  | "unknown";

/** `message` is always friendly text — the raw DOMException is never exposed. */
export interface CameraError {
  kind: CameraErrorKind;
  message: string;
  /** Whether trying again could help (e.g. camera busy) versus needing a settings change. */
  retryable: boolean;
}

export const GUIDANCE_STATES = [
  "NO_FACE",
  "MULTIPLE_FACES",
  "TOO_FAR",
  "TOO_CLOSE",
  "MOVE_LEFT",
  "MOVE_RIGHT",
  "MOVE_UP",
  "MOVE_DOWN",
  "TURN_LEFT",
  "TURN_RIGHT",
  "HEAD_TOO_TILTED",
  "LIGHT_TOO_DARK",
  "LIGHT_TOO_BRIGHT",
  "HOLD_STILL",
  "GOOD_TO_CAPTURE",
  "PROCESSING",
  "CAPTURED",
] as const;
export type GuidanceState = (typeof GUIDANCE_STATES)[number];

export interface GuidanceResult {
  state: GuidanceState;
  /** Plain, friendly instruction — no numbers, no jargon. */
  message: string;
  /** True when this single frame satisfies every capture condition (stability is judged separately). */
  frameOk: boolean;
}

/** A guided-capture step: one photo view. */
export interface PhotoStep {
  slot: PhotoSlot;
  /** Shown as the step title. */
  label: string;
  /** Required for the assessment baseline (front and both 45° views). */
  required: boolean;
}

export const PHOTO_STEPS: readonly PhotoStep[] = [
  { slot: "front", label: "Front", required: true },
  { slot: "leftFortyFive", label: "Left 45°", required: true },
  { slot: "rightFortyFive", label: "Right 45°", required: true },
  { slot: "leftProfile", label: "Left profile", required: false },
  { slot: "rightProfile", label: "Right profile", required: false },
];

export const REQUIRED_STEPS = PHOTO_STEPS.filter((s) => s.required);
export const PROFILE_STEPS = PHOTO_STEPS.filter((s) => !s.required);
