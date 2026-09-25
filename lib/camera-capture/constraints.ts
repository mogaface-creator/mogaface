/**
 * getUserMedia constraints. Everything is a PREFERENCE (`ideal`), never an
 * exact requirement, so a device that cannot provide 1280×720 still works —
 * the caller must read the stream's actual settings (see camera.ts).
 *
 * Video only, always: photo capture and the expression recording never need
 * audio, so the microphone is never requested.
 */

export const IDEAL_WIDTH = 1280;
export const IDEAL_HEIGHT = 720;

export interface CameraConstraintOptions {
  /** A device the user chose from the list. Omit to let the browser pick the default (front-facing on phones). */
  deviceId?: string;
}

export function buildCameraConstraints(options: CameraConstraintOptions = {}): MediaStreamConstraints {
  return {
    audio: false,
    video: {
      width: { ideal: IDEAL_WIDTH },
      height: { ideal: IDEAL_HEIGHT },
      // Prefer the front camera where the device has several (phones); harmless where it does not.
      facingMode: { ideal: "user" },
      ...(options.deviceId ? { deviceId: { ideal: options.deviceId } } : {}),
    },
  };
}

/** The most permissive request, used only if the preferred one is over-constrained. Still video-only. */
export const FALLBACK_CONSTRAINTS: MediaStreamConstraints = { audio: false, video: true };
