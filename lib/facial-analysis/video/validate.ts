/**
 * Video metadata validation — the cheap checks made before any frame is
 * decoded. Pure: takes numbers/strings, returns problems.
 */

import type { VideoMetadata } from "./types.ts";

export const MIN_VIDEO_DURATION_SEC = 2;
export const MAX_VIDEO_DURATION_SEC = 60;
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
export const MIN_VIDEO_DIMENSION_ERROR = 240;
export const MIN_VIDEO_DIMENSION_WARNING = 480;

export interface VideoMetadataValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateVideoMetadata(meta: Partial<VideoMetadata> | null | undefined): VideoMetadataValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const m = meta ?? {};

  if (typeof m.mimeType !== "string" || !m.mimeType.startsWith("video/")) errors.push("This file is not a video.");

  const finitePositive = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;

  if (!finitePositive(m.durationSec)) {
    errors.push("The video's length could not be read.");
  } else if (m.durationSec < MIN_VIDEO_DURATION_SEC) {
    errors.push(`The video is too short. Record at least ${MIN_VIDEO_DURATION_SEC} seconds.`);
  } else if (m.durationSec > MAX_VIDEO_DURATION_SEC) {
    errors.push(`The video is too long. Keep it under ${MAX_VIDEO_DURATION_SEC} seconds.`);
  }

  if (!finitePositive(m.width) || !finitePositive(m.height)) {
    errors.push("The video's dimensions could not be read.");
  } else {
    const minDim = Math.min(m.width, m.height);
    if (minDim < MIN_VIDEO_DIMENSION_ERROR) errors.push("The video resolution is too low to analyze.");
    else if (minDim < MIN_VIDEO_DIMENSION_WARNING) warnings.push("The video resolution is low; measurements may be less precise.");
  }

  if (finitePositive(m.sizeBytes) && m.sizeBytes > MAX_VIDEO_BYTES) errors.push("The video file is too large.");

  return { valid: errors.length === 0, errors, warnings };
}
