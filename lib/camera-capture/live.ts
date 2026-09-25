/**
 * Live analysis of the camera preview using the EXISTING MediaPipe
 * FaceLandmarker (detectFace) — there is no second detector. A frame is drawn
 * to a small off-screen canvas at a controlled rate, detected, and turned
 * into GuidanceInput. Client-only.
 */

import { detectFace } from "../facial-analysis/faceLandmarker.ts";
import { sampleMeanBrightness } from "../facial-analysis/imageSampling.ts";
import type { PhotoSlot } from "../facial-analysis/multiPhoto/types.ts";
import type { GuidanceInput } from "./guidance.ts";

/** Analysis frames are downscaled: enough for landmarks, cheap enough for several passes a second. */
export const LIVE_MAX_SIDE = 480;
/** Controlled sampling rate — not every browser frame. */
export const LIVE_INTERVAL_MS = 150;

export function createLiveAnalyzer() {
  const canvas = document.createElement("canvas");
  return {
    /** Returns null if the video has no frame yet. Never throws for detection problems: they surface as "no face". */
    async analyze(video: HTMLVideoElement, target: PhotoSlot, mirrored: boolean): Promise<GuidanceInput | null> {
      const { videoWidth, videoHeight } = video;
      if (!videoWidth || !videoHeight || video.readyState < 2) return null;
      const scale = Math.min(1, LIVE_MAX_SIDE / Math.max(videoWidth, videoHeight));
      canvas.width = Math.round(videoWidth * scale);
      canvas.height = Math.round(videoHeight * scale);
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      let faces: Awaited<ReturnType<typeof detectFace>>["faces"] = [];
      try {
        faces = (await detectFace(canvas)).faces;
      } catch {
        faces = [];
      }
      return {
        faceCount: faces.length,
        landmarks: faces.length === 1 ? faces[0] : null,
        frameWidth: canvas.width,
        frameHeight: canvas.height,
        meanBrightness: sampleMeanBrightness(canvas),
        target,
        mirrored,
      };
    },
    dispose() {
      canvas.width = canvas.height = 0;
    },
  };
}
