"use client";

import { useEffect, useReducer, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { EXPRESSION_STEPS, INITIAL_RECORDING, TOTAL_RECORDING_MS, recorderSupported, recordingReducer, startExpressionRecorder, stepAt, type ExpressionRecorder } from "@/lib/camera-capture/recording.ts";
import { CameraPreview } from "./CameraPreview";

/**
 * Guided expression recording: Relax → Raise your eyebrows → Frown → Smile →
 * Squint, three seconds each (~15 s). Video only (never audio). The file goes
 * to the EXISTING analyzeVideoFile pipeline later — there is no separate
 * expression engine here. Precise timing is not required.
 */
export function ExpressionVideoCapture({ stream, onRecorded, onSkip }: { stream: MediaStream | null; onRecorded: (file: File) => void; onSkip: () => void }) {
  const [state, dispatch] = useReducer(recordingReducer, INITIAL_RECORDING);
  const recorderRef = useRef<ExpressionRecorder | null>(null);
  const supported = typeof MediaRecorder !== "undefined" && recorderSupported();

  // Drive the timeline while recording.
  useEffect(() => {
    if (state.status !== "recording") return;
    const startedAt = performance.now();
    const id = window.setInterval(() => dispatch({ type: "TICK", elapsedMs: performance.now() - startedAt }), 100);
    return () => window.clearInterval(id);
  }, [state.status]);

  // The timeline ended: stop the recorder and hand over the file.
  useEffect(() => {
    if (state.status !== "finished") return;
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (!recorder) return;
    recorder.stop();
    recorder.result.then(onRecorded, () => dispatch({ type: "FAIL", message: "The recording didn't work this time. You can try again or skip the video." }));
  }, [state.status, onRecorded]);

  // Leaving the flow always releases the recorder.
  useEffect(() => () => recorderRef.current?.cancel(), []);

  const start = () => {
    if (!stream) return;
    try {
      recorderRef.current = startExpressionRecorder(stream);
      dispatch({ type: "START" });
    } catch {
      dispatch({ type: "FAIL", message: "Video recording isn't available in this browser. You can skip this step." });
    }
  };

  const pos = stepAt(state.elapsedMs);
  const recording = state.status === "recording";

  return (
    <div data-testid="expression-video" className="mx-auto max-w-md">
      <h3 className="text-center font-serif text-2xl tracking-tight">Now let&apos;s capture a few expressions</h3>
      <p className="mt-2 text-center text-sm text-muted">About 15 seconds. Start relaxed, then follow the prompts — exact timing doesn&apos;t matter.</p>

      <div className="mt-5">
        <CameraPreview stream={stream}>
          {recording && (
            <span className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /> Recording
            </span>
          )}
        </CameraPreview>
      </div>

      <ol aria-label="Expression steps" className="mt-5 flex items-center justify-center gap-3 text-xs" data-testid="expression-steps">
        {EXPRESSION_STEPS.map((s, i) => (
          <li key={s.id} aria-current={recording && i === pos.index ? "step" : undefined} className="flex flex-col items-center gap-1">
            <span className={`h-3 w-3 rounded-full ${recording && i === pos.index ? "bg-accent" : recording && i < pos.index ? "bg-accent/50" : "border border-border"}`} />
            <span className={recording && i === pos.index ? "font-medium" : "text-muted"}>{s.label}</span>
          </li>
        ))}
      </ol>

      <p role="status" aria-live="polite" data-testid="expression-cue" className="mt-5 text-center text-2xl font-medium tracking-tight">
        {recording ? `${pos.step.prompt}` : state.status === "error" ? state.error : "Ready when you are"}
      </p>
      {recording && <p className="mt-1 text-center text-sm text-muted">{pos.secondsLeft}s · {Math.max(0, Math.round((TOTAL_RECORDING_MS - state.elapsedMs) / 1000))}s left in total</p>}
      {state.status === "finished" && <p className="mt-3 text-center text-sm text-muted">Processing your video…</p>}

      <div className="mt-6 flex items-center justify-center gap-3">
        {!recording && state.status !== "finished" && (
          <>
            <Button type="button" variant="ghost" onClick={onSkip}>
              Skip the video
            </Button>
            <Button type="button" onClick={start} disabled={!stream || !supported}>
              {state.status === "error" ? "Try again" : "Start recording"}
            </Button>
          </>
        )}
        {recording && (
          <Button type="button" variant="secondary" onClick={() => { recorderRef.current?.cancel(); recorderRef.current = null; dispatch({ type: "CANCEL" }); }}>
            Cancel
          </Button>
        )}
      </div>
      {!supported && <p className="mt-3 text-center text-xs text-muted">Video recording isn&apos;t available in this browser. You can skip this step, or add a video later on the review page.</p>}
    </div>
  );
}
