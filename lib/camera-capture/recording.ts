/**
 * Expression-video recording. The timeline and the recording state machine
 * are pure (testable); the MediaRecorder wrapper is client-only.
 *
 * Video only — never audio. The recording is handed to the EXISTING
 * analyzeVideoFile pipeline; there is no separate expression engine. The
 * analysis wants a still, neutral opening, so the first step is "Relax".
 */

import type { ActiveExpressionState } from "../facial-analysis/video/types.ts";

export interface ExpressionStep {
  id: "RELAX" | ActiveExpressionState;
  label: string;
  prompt: string;
  seconds: number;
}

export const EXPRESSION_STEPS: readonly ExpressionStep[] = [
  { id: "RELAX", label: "Relax", prompt: "Relax your face", seconds: 3 },
  { id: "BROW_RAISE", label: "Brow raise", prompt: "Raise your eyebrows", seconds: 3 },
  { id: "FROWN", label: "Frown", prompt: "Frown naturally", seconds: 3 },
  { id: "SMILE", label: "Smile", prompt: "Smile naturally", seconds: 3 },
  { id: "SQUINT", label: "Squint", prompt: "Gently squint", seconds: 3 },
];

export const TOTAL_RECORDING_MS = EXPRESSION_STEPS.reduce((n, s) => n + s.seconds * 1000, 0);

export interface StepPosition {
  index: number;
  step: ExpressionStep;
  /** Milliseconds into the current step. */
  intoStepMs: number;
  /** Whole seconds left in the current step (for a countdown). */
  secondsLeft: number;
  done: boolean;
}

/** Which step a given elapsed time falls in. Clamps: past the end it reports the last step as done. */
export function stepAt(elapsedMs: number, steps: readonly ExpressionStep[] = EXPRESSION_STEPS): StepPosition {
  const t = Number.isFinite(elapsedMs) ? Math.max(0, elapsedMs) : 0;
  let start = 0;
  for (const [index, step] of steps.entries()) {
    const len = step.seconds * 1000;
    if (t < start + len) return { index, step, intoStepMs: t - start, secondsLeft: Math.ceil((start + len - t) / 1000), done: false };
    start += len;
  }
  const last = steps.length - 1;
  return { index: last, step: steps[last], intoStepMs: steps[last].seconds * 1000, secondsLeft: 0, done: true };
}

// ---- recording state machine ----

export type RecordingStatus = "idle" | "recording" | "finished" | "cancelled" | "error";

export interface RecordingState {
  status: RecordingStatus;
  elapsedMs: number;
  step: number;
  /** A friendly message when status is "error". */
  error: string | null;
}

export const INITIAL_RECORDING: RecordingState = { status: "idle", elapsedMs: 0, step: 0, error: null };

export type RecordingAction = { type: "START" } | { type: "TICK"; elapsedMs: number } | { type: "STOP" } | { type: "CANCEL" } | { type: "FAIL"; message: string } | { type: "RESET" };

export function recordingReducer(state: RecordingState, action: RecordingAction): RecordingState {
  switch (action.type) {
    case "START":
      return state.status === "recording" ? state : { status: "recording", elapsedMs: 0, step: 0, error: null };
    case "TICK": {
      if (state.status !== "recording") return state;
      const pos = stepAt(action.elapsedMs);
      // Reaching the end of the timeline finishes the recording by itself.
      return pos.done ? { ...state, status: "finished", elapsedMs: TOTAL_RECORDING_MS, step: pos.index } : { ...state, elapsedMs: action.elapsedMs, step: pos.index };
    }
    case "STOP":
      return state.status === "recording" ? { ...state, status: "finished" } : state;
    case "CANCEL":
      return state.status === "recording" ? { ...INITIAL_RECORDING, status: "cancelled" } : state;
    case "FAIL":
      return { ...INITIAL_RECORDING, status: "error", error: action.message };
    case "RESET":
      return INITIAL_RECORDING;
  }
}

// ---- MediaRecorder (client-only) ----

const MIME_PREFERENCE = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"];

/** First supported container/codec, or null when MediaRecorder cannot record video here. */
export function pickRecorderMimeType(isTypeSupported: (type: string) => boolean): string | null {
  return MIME_PREFERENCE.find((t) => isTypeSupported(t)) ?? null;
}

export const recordingFileName = (mimeType: string) => (mimeType.startsWith("video/mp4") ? "expression.mp4" : "expression.webm");

export function recorderSupported(): boolean {
  return typeof MediaRecorder !== "undefined" && pickRecorderMimeType((t) => MediaRecorder.isTypeSupported(t)) !== null;
}

export interface ExpressionRecorder {
  /** Resolves with the recording once stopped (by `stop()` or `finish`). Rejects if nothing was recorded. */
  result: Promise<File>;
  stop(): void;
  /** Stops and discards everything. */
  cancel(): void;
}

/**
 * Records `stream` (video only). Releases the recorder on stop/cancel; it does
 * NOT stop the camera tracks — the caller owns the stream.
 */
export function startExpressionRecorder(stream: MediaStream): ExpressionRecorder {
  const mimeType = pickRecorderMimeType((t) => MediaRecorder.isTypeSupported(t));
  if (!mimeType) throw new Error("Recording isn't supported in this browser.");
  const videoOnly = new MediaStream(stream.getVideoTracks()); // never includes audio
  const recorder = new MediaRecorder(videoOnly, { mimeType, videoBitsPerSecond: 2_500_000 });
  const chunks: Blob[] = [];
  let cancelled = false;

  const result = new Promise<File>((resolve, reject) => {
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onerror = () => reject(new Error("Recording failed."));
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      chunks.length = 0;
      if (cancelled || blob.size === 0) reject(new Error(cancelled ? "cancelled" : "Nothing was recorded."));
      else resolve(new File([blob], recordingFileName(mimeType), { type: mimeType, lastModified: Date.now() }));
    };
  });
  result.catch(() => {}); // a cancelled recording is not an unhandled rejection

  recorder.start(1000);
  const stop = () => {
    if (recorder.state !== "inactive") recorder.stop();
  };
  return {
    result,
    stop,
    cancel() {
      cancelled = true;
      stop();
    },
  };
}
