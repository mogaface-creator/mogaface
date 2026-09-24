/**
 * Client-only video → frame samples. The one file in this folder that
 * touches the DOM: it decodes the user's video with a native <video>
 * element, seeks to each planned timestamp, draws that frame to a canvas,
 * and runs the app's existing MediaPipe face detector on it.
 *
 * Nothing is uploaded — decoding, detection and analysis all stay in the
 * browser, and the File is never persisted. No video-processing dependency
 * is used. Like faceLandmarker.ts, never import this during SSR.
 */

import { detectFace, FaceLandmarkerError } from "../faceLandmarker.ts";
import { sampleGrayImage, sampleMeanBrightness } from "../imageSampling.ts";
import { analyzeVideoFrames } from "./observe.ts";
import { DEFAULT_MAX_FRAMES, MAX_FRAME_SIDE, planFrameTimes } from "./sampling.ts";
import { validateVideoMetadata } from "./validate.ts";
import type { VideoExpressionAnalysis, VideoFrameSample, VideoMetadata } from "./types.ts";

const LOAD_TIMEOUT_MS = 15_000;
const SEEK_TIMEOUT_MS = 5_000;

export class VideoAnalysisError extends Error {}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new VideoAnalysisError(message)), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

function loadVideo(url: string): Promise<HTMLVideoElement> {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  const ready = new Promise<HTMLVideoElement>((resolve, reject) => {
    video.onloadeddata = () => resolve(video);
    video.onerror = () => reject(new VideoAnalysisError("Could not read this video. Try a different file or format."));
  });
  video.src = url;
  return withTimeout(ready, LOAD_TIMEOUT_MS, "The video took too long to load.");
}

function seekTo(video: HTMLVideoElement, timeSec: number): Promise<void> {
  const seeked = new Promise<void>((resolve, reject) => {
    video.onseeked = () => resolve();
    video.onerror = () => reject(new VideoAnalysisError("Could not read a frame from this video."));
  });
  video.currentTime = timeSec;
  return withTimeout(seeked, SEEK_TIMEOUT_MS, "Timed out reading a video frame.");
}

export interface VideoAnalysisOptions {
  maxFrames?: number;
  onProgress?: (done: number, total: number) => void;
}

/**
 * Analyzes one video file. Never throws: metadata problems, unreadable
 * files and detector failures come back as an "insufficient_evidence"
 * analysis whose `notes` say why.
 */
export async function analyzeVideoFile(file: File, options: VideoAnalysisOptions = {}): Promise<VideoExpressionAnalysis> {
  const emptyMeta: VideoMetadata = { durationSec: 0, width: 0, height: 0, sizeBytes: file.size, mimeType: file.type };
  const fail = (message: string, metadata: VideoMetadata = emptyMeta) => {
    const analysis = analyzeVideoFrames({ ...metadata, mimeType: metadata.mimeType || "video/unknown" }, []);
    return { ...analysis, status: "insufficient_evidence" as const, notes: [message, ...analysis.notes] };
  };

  const url = URL.createObjectURL(file);
  try {
    const video = await loadVideo(url);
    const metadata: VideoMetadata = {
      durationSec: video.duration,
      width: video.videoWidth,
      height: video.videoHeight,
      sizeBytes: file.size,
      mimeType: file.type,
    };
    const check = validateVideoMetadata(metadata);
    if (!check.valid) return fail(check.errors[0], metadata);

    const scale = Math.min(1, MAX_FRAME_SIDE / Math.max(metadata.width, metadata.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(metadata.width * scale);
    canvas.height = Math.round(metadata.height * scale);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return fail("This browser cannot read video frames.", metadata);

    const times = planFrameTimes(metadata.durationSec, options.maxFrames ?? DEFAULT_MAX_FRAMES);
    const samples: VideoFrameSample[] = [];
    for (const [index, timeSec] of times.entries()) {
      await seekTo(video, timeSec);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const detection = await detectFace(canvas);
      samples.push({
        index,
        timeSec,
        imageWidth: canvas.width,
        imageHeight: canvas.height,
        faceCount: detection.faces.length,
        landmarks: detection.faces.length === 1 ? detection.faces[0] : null,
        meanBrightness: sampleMeanBrightness(canvas),
        gray: sampleGrayImage(canvas, MAX_FRAME_SIDE) ?? null,
      });
      options.onProgress?.(index + 1, times.length);
    }
    return analyzeVideoFrames(metadata, samples);
  } catch (err) {
    return fail(err instanceof VideoAnalysisError || err instanceof FaceLandmarkerError || err instanceof Error ? err.message : "The video could not be analyzed.");
  } finally {
    URL.revokeObjectURL(url);
  }
}
