/**
 * Camera access: support detection, friendly error mapping, opening and
 * closing a stream. Browser APIs are passed in (`CameraEnv`) so the logic is
 * testable without hardware. Raw DOMExceptions never reach the UI.
 */

import { FALLBACK_CONSTRAINTS, buildCameraConstraints, type CameraConstraintOptions } from "./constraints.ts";
import type { CameraError, CameraErrorKind } from "./types.ts";

export const CAMERA_MESSAGES: Record<CameraErrorKind, string> = {
  permission_denied: "Camera access is blocked. You can allow camera access in your browser settings or upload photos instead.",
  no_camera: "We couldn't find a camera on this device.",
  camera_busy: "Your camera is being used by another application.",
  unsupported: "This browser can't use the camera here. You can upload your photos instead.",
  insecure_context: "The camera only works on a secure (https) page. You can upload your photos instead.",
  overconstrained: "We couldn't start your camera with the settings we tried. You can upload your photos instead.",
  unknown: "We couldn't start your camera. You can try again or upload your photos instead.",
};

const RETRYABLE: Record<CameraErrorKind, boolean> = {
  permission_denied: false,
  no_camera: false,
  camera_busy: true,
  unsupported: false,
  insecure_context: false,
  overconstrained: true,
  unknown: true,
};

export function cameraError(kind: CameraErrorKind): CameraError {
  return { kind, message: CAMERA_MESSAGES[kind], retryable: RETRYABLE[kind] };
}

/** Maps whatever getUserMedia threw (DOMException or otherwise) to a friendly CameraError. Never throws. */
export function mapCameraError(err: unknown): CameraError {
  const name = typeof err === "object" && err !== null && "name" in err ? String((err as { name: unknown }).name) : "";
  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
    case "SecurityError":
      return cameraError("permission_denied");
    case "NotFoundError":
    case "DevicesNotFoundError":
      return cameraError("no_camera");
    case "NotReadableError":
    case "TrackStartError":
    case "AbortError":
      return cameraError("camera_busy");
    case "OverconstrainedError":
    case "ConstraintNotSatisfiedError":
      return cameraError("overconstrained");
    case "TypeError":
      return cameraError("unsupported");
    default:
      return cameraError("unknown");
  }
}

export interface CameraEnv {
  isSecureContext: boolean;
  mediaDevices: Pick<MediaDevices, "getUserMedia" | "enumerateDevices"> | undefined;
}

/** Null when the camera can be requested; otherwise the friendly reason it cannot. */
export function assessCameraSupport(env: CameraEnv): CameraError | null {
  if (!env.isSecureContext) return cameraError("insecure_context");
  if (!env.mediaDevices || typeof env.mediaDevices.getUserMedia !== "function") return cameraError("unsupported");
  return null;
}

export function currentEnv(): CameraEnv {
  return {
    isSecureContext: typeof window !== "undefined" && window.isSecureContext === true,
    mediaDevices: typeof navigator !== "undefined" ? navigator.mediaDevices : undefined,
  };
}

/** What the browser actually gave us — it may differ from the ideal we asked for. */
export interface StreamInfo {
  width: number | null;
  height: number | null;
  deviceId: string | null;
  facingMode: string | null;
}

export function describeStream(stream: MediaStream): StreamInfo {
  const s = stream.getVideoTracks()[0]?.getSettings?.() ?? {};
  return { width: s.width ?? null, height: s.height ?? null, deviceId: s.deviceId ?? null, facingMode: s.facingMode ?? null };
}

export type OpenResult = { ok: true; stream: MediaStream; info: StreamInfo } | { ok: false; error: CameraError };

/**
 * Requests the camera. Must be called from a user interaction. If the
 * preferred constraints are over-constrained it retries ONCE with the most
 * permissive video-only request. Never throws.
 */
export async function openCamera(env: CameraEnv, options: CameraConstraintOptions = {}): Promise<OpenResult> {
  const unsupported = assessCameraSupport(env);
  if (unsupported) return { ok: false, error: unsupported };
  const md = env.mediaDevices!;
  try {
    const stream = await md.getUserMedia(buildCameraConstraints(options));
    return { ok: true, stream, info: describeStream(stream) };
  } catch (first) {
    const mapped = mapCameraError(first);
    if (mapped.kind !== "overconstrained") return { ok: false, error: mapped };
    try {
      const stream = await md.getUserMedia(FALLBACK_CONSTRAINTS);
      return { ok: true, stream, info: describeStream(stream) };
    } catch (second) {
      return { ok: false, error: mapCameraError(second) };
    }
  }
}

/** Stops every track so the browser's camera indicator turns off. Safe to call twice or with null. */
export function stopStream(stream: MediaStream | null | undefined): void {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    try {
      track.stop();
    } catch {
      /* already stopped */
    }
  }
}

export async function listVideoDevices(env: CameraEnv): Promise<{ deviceId: string; label: string }[]> {
  try {
    const all = (await env.mediaDevices?.enumerateDevices()) ?? [];
    return all.filter((d) => d.kind === "videoinput").map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Camera ${i + 1}` }));
  } catch {
    return [];
  }
}
