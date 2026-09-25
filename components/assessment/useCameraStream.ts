"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { currentEnv, listVideoDevices, openCamera, stopStream, type StreamInfo } from "@/lib/camera-capture/camera.ts";
import type { CameraError } from "@/lib/camera-capture/types.ts";

export type CameraStatus = "idle" | "requesting" | "ready" | "error";

/**
 * Owns the camera stream for the guided capture. Guarantees the camera is
 * released: on `stop()`, when the component unmounts, and when the page is
 * hidden/unloaded — the browser's "camera in use" indicator turns off.
 * The MediaStream itself never leaves this hook's consumers (it is passed to
 * <video> and the recorder only; it is not stored, exposed or sent anywhere).
 */
export function useCameraStream() {
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [error, setError] = useState<CameraError | null>(null);
  const [info, setInfo] = useState<StreamInfo | null>(null);
  const [devices, setDevices] = useState<{ deviceId: string; label: string }[]>([]);

  const stop = useCallback(() => {
    stopStream(streamRef.current);
    streamRef.current = null;
    setStream(null);
    setStatus("idle");
  }, []);

  /** Must be called from a user interaction. Resolves null when the camera is live, or the friendly error. */
  const start = useCallback(async (deviceId?: string): Promise<CameraError | null> => {
    stopStream(streamRef.current); // switching cameras: release the old one first
    streamRef.current = null;
    setStatus("requesting");
    setError(null);
    const env = currentEnv();
    const result = await openCamera(env, { deviceId });
    if (!result.ok) {
      setStatus("error");
      setError(result.error);
      setStream(null);
      return result.error;
    }
    streamRef.current = result.stream;
    setStream(result.stream);
    setInfo(result.info);
    setStatus("ready");
    // Labels are only available after permission has been granted.
    void listVideoDevices(env).then(setDevices);
    return null;
  }, []);

  useEffect(() => {
    const release = () => {
      stopStream(streamRef.current);
      streamRef.current = null;
    };
    window.addEventListener("pagehide", release);
    return () => {
      window.removeEventListener("pagehide", release);
      release(); // unmount: leaving the flow always releases the camera
    };
  }, []);

  return { stream, status, error, info, devices, start, stop };
}
