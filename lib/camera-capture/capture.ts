/**
 * Client-only frame capture. The image is drawn from the actual <video>
 * frame onto an off-screen canvas — never a screenshot of the page — so it
 * contains no controls, no overlay, and (deliberately) is NOT mirrored even
 * when the on-screen preview is: the analysis expects an ordinary photo.
 * The result is an in-memory File compatible with the existing photo
 * pipeline. Nothing is stored or uploaded.
 */

import { analyzeSinglePhoto } from "../facial-analysis/multiPhoto/coordinator.ts";
import type { PhotoSlot } from "../facial-analysis/multiPhoto/types.ts";
import { describeCaptureRecord, type CaptureFeedback } from "./feedback.ts";

export const CAPTURE_MAX_SIDE = 1920;
export const CAPTURE_JPEG_QUALITY = 0.92;

/** Same names the upload flow would have produced, e.g. "front.jpg". */
export const photoFileName = (slot: PhotoSlot) => `${slot}.jpg`;

/** Scales (w,h) down so the long side is at most `maxSide`; never upscales. Preserves aspect ratio. */
export function fitSize(width: number, height: number, maxSide: number = CAPTURE_MAX_SIDE): { width: number; height: number } {
  if (!(width > 0) || !(height > 0)) return { width: 0, height: 0 };
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export class CaptureError extends Error {}

export async function captureFrameToFile(video: HTMLVideoElement, slot: PhotoSlot): Promise<File> {
  const { videoWidth, videoHeight } = video;
  const size = fitSize(videoWidth, videoHeight);
  if (size.width === 0) throw new CaptureError("The camera isn't ready yet.");

  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new CaptureError("This browser can't capture a frame.");
  ctx.drawImage(video, 0, 0, size.width, size.height);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", CAPTURE_JPEG_QUALITY));
  canvas.width = canvas.height = 0; // release the pixel buffer
  if (!blob) throw new CaptureError("The photo couldn't be created.");
  return new File([blob], photoFileName(slot), { type: "image/jpeg", lastModified: Date.now() });
}

/** Runs the EXISTING single-photo analysis on the captured file and translates it into simple feedback. */
export async function validateCapturedPhoto(slot: PhotoSlot, file: File): Promise<CaptureFeedback> {
  return describeCaptureRecord(await analyzeSinglePhoto(slot, file));
}
