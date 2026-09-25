/**
 * The guided-capture flow as a pure state machine, so ordering, retakes,
 * optional steps and error handling are testable without a camera.
 *
 *   intro → requesting → photo (front) → review → photo (left 45°) → review →
 *   photo (right 45°) → review → profiles offer → [profile photos] → video →
 *   video review → complete
 *
 * Accepted photos map straight onto the existing PhotoSlot structure; there
 * is no parallel data model.
 */

import type { PhotoSlot } from "../facial-analysis/multiPhoto/types.ts";
import { PHOTO_STEPS, PROFILE_STEPS, REQUIRED_STEPS, type CameraErrorKind } from "./types.ts";

export type FlowPhase =
  | "intro"
  | "requesting"
  | "photo"
  | "review"
  | "profiles_offer"
  | "video"
  | "video_review"
  | "complete"
  | "error";

export interface FlowState {
  phase: FlowPhase;
  /** The photo being captured or reviewed. */
  step: PhotoSlot | null;
  accepted: PhotoSlot[];
  includeProfiles: boolean;
  videoAccepted: boolean;
  error: CameraErrorKind | null;
}

export type FlowAction =
  | { type: "REQUEST_CAMERA" }
  | { type: "CAMERA_READY" }
  | { type: "CAMERA_FAILED"; kind: CameraErrorKind }
  | { type: "CAPTURED"; slot: PhotoSlot }
  | { type: "ACCEPT_PHOTO" }
  | { type: "RETAKE" }
  | { type: "ADD_PROFILES" }
  | { type: "SKIP_PROFILES" }
  | { type: "VIDEO_RECORDED" }
  | { type: "ACCEPT_VIDEO" }
  | { type: "RERECORD_VIDEO" }
  | { type: "SKIP_VIDEO" }
  | { type: "RETRY" };

const REQUIRED_SLOTS = REQUIRED_STEPS.map((s) => s.slot);
const PROFILE_SLOTS = PROFILE_STEPS.map((s) => s.slot);

/** Photo steps in order, given whether profiles were chosen. */
export const photoOrder = (includeProfiles: boolean): PhotoSlot[] => (includeProfiles ? PHOTO_STEPS.map((s) => s.slot) : REQUIRED_SLOTS);

/** The next step still to capture, in order; null when none remain. */
export function nextStep(accepted: readonly PhotoSlot[], includeProfiles: boolean): PhotoSlot | null {
  return photoOrder(includeProfiles).find((s) => !accepted.includes(s)) ?? null;
}

export function initialFlow(alreadyCaptured: readonly PhotoSlot[] = []): FlowState {
  return { phase: "intro", step: null, accepted: [...new Set(alreadyCaptured)], includeProfiles: false, videoAccepted: false, error: null };
}

/** Where to go once a photo has been accepted. */
function afterPhotos(state: FlowState, accepted: PhotoSlot[]): FlowState {
  const next = nextStep(accepted, state.includeProfiles);
  if (next) return { ...state, accepted, phase: "photo", step: next };
  const requiredDone = REQUIRED_SLOTS.every((s) => accepted.includes(s));
  const profilesAnswered = state.includeProfiles || PROFILE_SLOTS.some((s) => accepted.includes(s));
  if (requiredDone && !profilesAnswered) return { ...state, accepted, phase: "profiles_offer", step: null };
  return { ...state, accepted, phase: "video", step: null };
}

export function flowReducer(state: FlowState, action: FlowAction): FlowState {
  switch (action.type) {
    case "REQUEST_CAMERA":
      return state.phase === "intro" || state.phase === "error" ? { ...state, phase: "requesting", error: null } : state;
    case "CAMERA_READY": {
      if (state.phase !== "requesting") return state;
      const next = nextStep(state.accepted, state.includeProfiles);
      return next ? { ...state, phase: "photo", step: next } : afterPhotos(state, state.accepted);
    }
    case "CAMERA_FAILED":
      return { ...state, phase: "error", error: action.kind, step: null };
    case "CAPTURED":
      // Only the step currently being captured can be captured.
      return state.phase === "photo" && state.step === action.slot ? { ...state, phase: "review" } : state;
    case "ACCEPT_PHOTO": {
      if (state.phase !== "review" || !state.step) return state;
      return afterPhotos(state, state.accepted.includes(state.step) ? state.accepted : [...state.accepted, state.step]);
    }
    case "RETAKE":
      return state.phase === "review" ? { ...state, phase: "photo" } : state;
    case "ADD_PROFILES":
      return state.phase === "profiles_offer" ? afterPhotos({ ...state, includeProfiles: true }, state.accepted) : state;
    case "SKIP_PROFILES": {
      // Declined at the offer, or abandoned part-way through the (optional) profile steps.
      const onOptionalStep = state.phase === "photo" && state.step !== null && PROFILE_SLOTS.includes(state.step);
      return state.phase === "profiles_offer" || onOptionalStep ? { ...state, phase: "video", step: null } : state;
    }
    case "VIDEO_RECORDED":
      return state.phase === "video" ? { ...state, phase: "video_review" } : state;
    case "ACCEPT_VIDEO":
      return state.phase === "video_review" ? { ...state, phase: "complete", videoAccepted: true } : state;
    case "RERECORD_VIDEO":
      return state.phase === "video_review" ? { ...state, phase: "video" } : state;
    case "SKIP_VIDEO":
      return state.phase === "video" ? { ...state, phase: "complete", videoAccepted: false } : state;
    case "RETRY":
      return state.phase === "error" ? { ...state, phase: "requesting", error: null } : state;
  }
}

/** Progress for the step indicator: how many of the chosen photo steps are accepted. */
export function photoProgress(state: FlowState): { done: number; total: number } {
  const order = photoOrder(state.includeProfiles);
  return { done: order.filter((s) => state.accepted.includes(s)).length, total: order.length };
}
