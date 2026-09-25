"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { assessCameraSupport, cameraError, currentEnv } from "@/lib/camera-capture/camera.ts";
import { captureFrameToFile, validateCapturedPhoto } from "@/lib/camera-capture/capture.ts";
import { FALLBACK_REASON, type CaptureFeedback } from "@/lib/camera-capture/feedback.ts";
import { flowReducer, initialFlow, photoOrder, photoProgress } from "@/lib/camera-capture/flow.ts";
import { INITIAL_STABILITY, MESSAGES, evaluateGuidance, faceCenter, profileIsManual, stepStability } from "@/lib/camera-capture/guidance.ts";
import { LIVE_INTERVAL_MS, createLiveAnalyzer } from "@/lib/camera-capture/live.ts";
import { PHOTO_STEPS, type GuidanceResult } from "@/lib/camera-capture/types.ts";
import type { PhotoSlot } from "@/lib/facial-analysis/multiPhoto/types.ts";
import { CameraPreview } from "./CameraPreview";
import { CaptureReview } from "./CaptureReview";
import { LiveCue, STEP_COPY, StepDots } from "./CaptureGuidance";
import { ExpressionVideoCapture } from "./ExpressionVideoCapture";
import { FaceGuideOverlay } from "./FaceGuideOverlay";
import { useCameraStream } from "./useCameraStream";

/** After this long without a good frame, offer a manual "Take photo now" (the photo is still checked before it can be used). */
const MANUAL_FALLBACK_MS = 10_000;
/** The preview is shown mirrored, so movement cues are given in what the person sees. */
const MIRRORED = true;

interface Pending {
  file: File;
  url: string;
  feedback: CaptureFeedback | null;
}

/**
 * Guided camera capture: allow camera → live position/quality guidance →
 * capture only after a short, steady, good position → review → next view →
 * optional profiles → expression video. Uses the existing MediaPipe pipeline
 * and quality rules; stores and uploads nothing, and releases the camera when
 * finished or when the person leaves.
 */
export function GuidedCameraCapture({
  existingSlots,
  onAcceptPhoto,
  onVideo,
  onUseUpload,
  onBack,
  onFinished,
}: {
  existingSlots: PhotoSlot[];
  onAcceptPhoto: (slot: PhotoSlot, file: File) => void;
  onVideo: (file: File | null) => void;
  onUseUpload: () => void;
  onBack: () => void;
  onFinished: () => void;
}) {
  const [flow, dispatch] = useReducer(flowReducer, existingSlots, initialFlow);
  const cam = useCameraStream();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [guidance, setGuidance] = useState<GuidanceResult>({ state: "NO_FACE", message: MESSAGES.NO_FACE, frameOk: false });
  const [progress, setProgress] = useState(0);
  const [manualReady, setManualReady] = useState(false);
  const [pending, setPending] = useState<Pending | null>(null);
  const [pendingVideo, setPendingVideo] = useState<{ file: File; url: string } | null>(null);
  const [supportProblem] = useState(() => (typeof window === "undefined" ? null : assessCameraSupport(currentEnv())));

  const pendingUrlRef = useRef<string | null>(null);
  const videoUrlRef = useRef<string | null>(null);
  useEffect(() => {
    pendingUrlRef.current = pending?.url ?? null;
    videoUrlRef.current = pendingVideo?.url ?? null;
  }, [pending, pendingVideo]);
  useEffect(
    () => () => {
      // Leaving the flow: release any preview object URLs (the camera itself is released by the hook).
      if (pendingUrlRef.current) URL.revokeObjectURL(pendingUrlRef.current);
      if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
    },
    [],
  );

  const requestCamera = async () => {
    dispatch({ type: "REQUEST_CAMERA" });
    const problem = await cam.start();
    if (problem) dispatch({ type: "CAMERA_FAILED", kind: problem.kind });
    else dispatch({ type: "CAMERA_READY" });
  };

  const doCapture = useCallback(async (slot: PhotoSlot) => {
    const video = videoRef.current;
    if (!video) return;
    setGuidance({ state: "PROCESSING", message: MESSAGES.PROCESSING, frameOk: true });
    try {
      const file = await captureFrameToFile(video, slot);
      setPending({ file, url: URL.createObjectURL(file), feedback: null });
      dispatch({ type: "CAPTURED", slot });
      validateCapturedPhoto(slot, file).then(
        (feedback) => setPending((p) => (p && p.file === file ? { ...p, feedback } : p)),
        () => setPending((p) => (p && p.file === file ? { ...p, feedback: { ok: false, positives: [], reasons: [FALLBACK_REASON] } } : p)),
      );
    } catch {
      setGuidance({ state: "NO_FACE", message: "That didn't work — let's try again", frameOk: false });
    }
  }, []);

  // ---- live guidance loop: sampled at a controlled rate, never every browser frame ----
  useEffect(() => {
    if (flow.phase !== "photo" || !flow.step || !cam.stream) return;
    const slot = flow.step;
    const auto = !profileIsManual(slot);
    const analyzer = createLiveAnalyzer();
    const startedAt = performance.now();
    let stability = INITIAL_STABILITY;
    let busy = false;
    let done = false;

    const tick = async () => {
      if (busy || done || !videoRef.current) return;
      busy = true;
      try {
        const input = await analyzer.analyze(videoRef.current, slot, MIRRORED);
        if (done || !input) return;
        const g = evaluateGuidance(input);
        const now = performance.now();
        const step = stepStability(stability, { ok: auto && g.frameOk, center: faceCenter(input.landmarks), timeMs: now });
        stability = step.state;
        if (auto && step.stable) {
          done = true;
          await doCapture(slot);
          return;
        }
        setGuidance(g);
        setProgress(step.progress);
        if (now - startedAt > MANUAL_FALLBACK_MS) setManualReady(true);
      } finally {
        busy = false;
      }
    };
    const id = window.setInterval(tick, LIVE_INTERVAL_MS);
    return () => {
      done = true;
      window.clearInterval(id);
      analyzer.dispose();
    };
  }, [flow.phase, flow.step, cam.stream, doCapture]);

  const step = flow.step ? PHOTO_STEPS.find((s) => s.slot === flow.step)! : null;
  const resetLive = () => {
    setProgress(0);
    setManualReady(false);
    setGuidance({ state: "NO_FACE", message: MESSAGES.NO_FACE, frameOk: false });
  };

  const usePhoto = () => {
    if (!pending?.feedback?.ok || !flow.step) return;
    onAcceptPhoto(flow.step, pending.file);
    URL.revokeObjectURL(pending.url);
    setPending(null);
    resetLive();
    dispatch({ type: "ACCEPT_PHOTO" });
  };
  const retake = () => {
    if (pending) URL.revokeObjectURL(pending.url);
    setPending(null);
    resetLive();
    dispatch({ type: "RETAKE" });
  };

  const onRecorded = useCallback((file: File) => {
    setPendingVideo({ file, url: URL.createObjectURL(file) });
    dispatch({ type: "VIDEO_RECORDED" });
  }, []);
  const useVideo = () => {
    if (!pendingVideo) return;
    onVideo(pendingVideo.file);
    URL.revokeObjectURL(pendingVideo.url);
    setPendingVideo(null);
    cam.stop(); // finished with the camera
    dispatch({ type: "ACCEPT_VIDEO" });
  };
  const rerecord = () => {
    if (pendingVideo) URL.revokeObjectURL(pendingVideo.url);
    setPendingVideo(null);
    dispatch({ type: "RERECORD_VIDEO" });
  };
  const skipVideo = () => {
    cam.stop();
    dispatch({ type: "SKIP_VIDEO" });
  };
  const switchToUpload = () => {
    cam.stop();
    onUseUpload();
  };

  const cameraPicker =
    cam.devices.length > 1 ? (
      <label className="mt-4 flex items-center justify-center gap-2 text-xs text-muted">
        Camera
        <select aria-label="Camera" defaultValue={cam.info?.deviceId ?? ""} onChange={(e) => void cam.start(e.target.value)} className="rounded-full border border-border bg-background px-3 py-1.5 text-xs text-foreground">
          {cam.devices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label}
            </option>
          ))}
        </select>
      </label>
    ) : null;

  return (
    <div data-testid="guided-capture" data-phase={flow.phase} data-step={flow.step ?? ""}>
      {flow.phase === "intro" && (
        <div className="mx-auto max-w-md text-center">
          <h2 className="font-serif text-3xl tracking-tight">Let&apos;s capture your photos</h2>
          <p className="mt-4 text-base leading-7 text-muted">Your camera will help us guide you into the correct position.</p>
          <p className="mt-2 text-sm text-muted">Your photos stay in this assessment unless you choose to continue.</p>
          {supportProblem && (
            <p role="alert" className="mt-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
              {supportProblem.message}
            </p>
          )}
          <div className="mt-8 flex flex-col items-center gap-3">
            <Button type="button" onClick={requestCamera} disabled={!!supportProblem} className="w-full max-w-xs">
              Allow camera
            </Button>
            <Button type="button" variant="secondary" onClick={switchToUpload} className="w-full max-w-xs">
              Upload instead
            </Button>
            <Button type="button" variant="ghost" onClick={onBack}>
              Back
            </Button>
          </div>
        </div>
      )}

      {flow.phase === "requesting" && (
        <p role="status" className="py-24 text-center text-lg text-muted">
          Starting your camera… allow access if your browser asks.
        </p>
      )}

      {flow.phase === "error" && flow.error && (
        <div role="alert" className="mx-auto max-w-md text-center" data-testid="camera-error" data-error-kind={flow.error}>
          <h2 className="font-serif text-2xl tracking-tight">We couldn&apos;t use the camera</h2>
          <p className="mt-4 text-base leading-7 text-muted">{cameraError(flow.error).message}</p>
          <div className="mt-8 flex flex-col items-center gap-3">
            {cameraError(flow.error).retryable && (
              <Button type="button" onClick={requestCamera} className="w-full max-w-xs">
                Try again
              </Button>
            )}
            <Button type="button" variant={cameraError(flow.error).retryable ? "secondary" : "primary"} onClick={switchToUpload} className="w-full max-w-xs">
              Upload instead
            </Button>
          </div>
        </div>
      )}

      {flow.phase === "photo" && step && (
        <div>
          <StepDots current={flow.step} accepted={flow.accepted} steps={photoOrder(flow.includeProfiles)} />
          <h2 className="mt-6 text-center font-serif text-2xl tracking-tight">{STEP_COPY[step.slot].title}</h2>
          <p className="mt-1 text-center text-sm text-muted">{STEP_COPY[step.slot].hint}</p>
          <div className="mt-5">
            <CameraPreview stream={cam.stream} videoRef={videoRef} mirrored={MIRRORED}>
              <FaceGuideOverlay state={guidance.state} progress={progress} />
            </CameraPreview>
          </div>
          <LiveCue message={guidance.message} good={guidance.state === "HOLD_STILL" || guidance.state === "GOOD_TO_CAPTURE" || guidance.state === "PROCESSING"} />
          <div className="mt-5 flex flex-col items-center gap-3">
            {(profileIsManual(step.slot) || manualReady) && (
              <Button type="button" variant={profileIsManual(step.slot) ? "primary" : "secondary"} onClick={() => void doCapture(step.slot)} data-testid="manual-capture">
                {profileIsManual(step.slot) ? "Capture" : "Take photo now"}
              </Button>
            )}
            {cameraPicker}
            {!step.required && (
              <Button type="button" variant="ghost" onClick={() => dispatch({ type: "SKIP_PROFILES" })} data-testid="skip-profiles">
                Skip profile photos
              </Button>
            )}
            <Button type="button" variant="ghost" onClick={switchToUpload}>
              Upload instead
            </Button>
          </div>
        </div>
      )}

      {flow.phase === "review" && step && pending && <CaptureReview label={step.label} previewUrl={pending.url} feedback={pending.feedback} onUse={usePhoto} onRetake={retake} />}

      {flow.phase === "profiles_offer" && (
        <div className="mx-auto max-w-md text-center">
          <h2 className="font-serif text-3xl tracking-tight">Your main photos are ready</h2>
          <p className="mt-4 text-base leading-7 text-muted">Would you like to add profile photos too? They&apos;re optional.</p>
          <div className="mt-8 flex flex-col items-center gap-3">
            <Button type="button" variant="secondary" onClick={() => dispatch({ type: "ADD_PROFILES" })} className="w-full max-w-xs">
              Add profile photos
            </Button>
            <Button type="button" onClick={() => dispatch({ type: "SKIP_PROFILES" })} className="w-full max-w-xs">
              Continue to expressions
            </Button>
          </div>
        </div>
      )}

      {flow.phase === "video" && (
        <>
          <ExpressionVideoCapture stream={cam.stream} onRecorded={onRecorded} onSkip={skipVideo} />
          <div className="mt-2 flex justify-center">{cameraPicker}</div>
        </>
      )}

      {flow.phase === "video_review" && pendingVideo && (
        <div data-testid="video-review" className="mx-auto max-w-md text-center">
          <h3 className="font-serif text-2xl tracking-tight">Video captured</h3>
          <div className="mt-5 overflow-hidden rounded-3xl border border-border bg-black">
            <video src={pendingVideo.url} controls playsInline muted className="max-h-[60vh] w-full" aria-label="Your expression video" />
          </div>
          <div className="mt-6 flex items-center justify-center gap-3">
            <Button type="button" variant="secondary" onClick={rerecord}>
              Record again
            </Button>
            <Button type="button" onClick={useVideo}>
              Use video
            </Button>
          </div>
        </div>
      )}

      {flow.phase === "complete" && (
        <div data-testid="capture-complete" className="mx-auto max-w-md text-center">
          <h2 className="font-serif text-3xl tracking-tight">Your photos are ready</h2>
          <p className="mt-4 text-base leading-7 text-muted">
            {photoProgress(flow).done} photo{photoProgress(flow).done === 1 ? "" : "s"} captured{flow.videoAccepted ? " and your expression video" : ""}. Your camera is off.
          </p>
          <div className="mt-8 flex justify-center">
            <Button type="button" onClick={onFinished}>
              Continue
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
