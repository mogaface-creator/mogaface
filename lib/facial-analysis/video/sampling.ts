/**
 * Frame sampling plan. Pure — the browser side (capture.ts) turns these
 * timestamps into decoded frames.
 */

export const DEFAULT_MAX_FRAMES = 24;

/** Frames are drawn no larger than this on their long side before detection/measurement. */
export const MAX_FRAME_SIDE = 960;

/** Skip the very start/end, where cameras are still adjusting exposure or the user is reaching for the button. */
export const EDGE_MARGIN_FRACTION = 0.05;

/**
 * Evenly spaced timestamps (seconds) across the usable middle of the video.
 * Returns [] for a non-positive/non-finite duration, and never more than
 * `maxFrames` entries.
 */
export function planFrameTimes(durationSec: number, maxFrames: number = DEFAULT_MAX_FRAMES): number[] {
  if (!Number.isFinite(durationSec) || durationSec <= 0 || !Number.isFinite(maxFrames) || maxFrames < 1) return [];
  const count = Math.floor(maxFrames);
  const start = durationSec * EDGE_MARGIN_FRACTION;
  const end = durationSec * (1 - EDGE_MARGIN_FRACTION);
  if (count === 1) return [(start + end) / 2];
  const step = (end - start) / (count - 1);
  return Array.from({ length: count }, (_, i) => start + i * step);
}

/** Provenance id for a sampled frame, e.g. "video_frame_14". */
export function frameId(index: number): string {
  return `video_frame_${index}`;
}
