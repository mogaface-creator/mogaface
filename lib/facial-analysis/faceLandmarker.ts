/**
 * Client-only loader around MediaPipe's FaceLandmarker.
 *
 * Responsibilities: lazily initialize the model exactly once, run detection
 * on an image, and normalize MediaPipe's result/errors into shapes the rest
 * of the app can rely on. Nothing here should ever run during SSR — every
 * export guards on `typeof window`.
 *
 * The WASM runtime is fetched from the official MediaPipe CDN (jsdelivr),
 * as documented by Google — this is a static asset load for the library's
 * own runtime, not an external AI API call. The face-landmark *model* file
 * is self-hosted at /models/face_landmarker.task so detection is pinned to
 * a known version and works offline once cached. No image data is ever sent
 * anywhere — detection runs entirely in the browser.
 */

import type { FaceLandmarker as FaceLandmarkerType } from "@mediapipe/tasks-vision";
import type { LandmarkList } from "./types.ts";

const WASM_CDN_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_ASSET_PATH = "/models/face_landmarker.task";
const MAX_FACES = 2;

let landmarkerPromise: Promise<FaceLandmarkerType> | null = null;

export class FaceLandmarkerError extends Error {}

async function createLandmarker(): Promise<FaceLandmarkerType> {
  if (typeof window === "undefined") {
    throw new FaceLandmarkerError("Face detection is only available in the browser.");
  }
  if (typeof WebAssembly === "undefined") {
    throw new FaceLandmarkerError("Your browser does not support WebAssembly, which is required for face analysis.");
  }

  let mod: typeof import("@mediapipe/tasks-vision");
  try {
    mod = await import("@mediapipe/tasks-vision");
  } catch {
    throw new FaceLandmarkerError("Could not load the face-analysis engine. Check your connection and try again.");
  }

  const { FaceLandmarker, FilesetResolver } = mod;

  let vision;
  try {
    vision = await FilesetResolver.forVisionTasks(WASM_CDN_BASE);
  } catch {
    throw new FaceLandmarkerError(
      "Could not load the face-analysis runtime. Check your internet connection and try again.",
    );
  }

  try {
    return await FaceLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: MODEL_ASSET_PATH,
        delegate: "GPU",
      },
      runningMode: "IMAGE",
      numFaces: MAX_FACES,
    });
  } catch {
    // GPU delegate can fail on some browsers/drivers — retry on CPU.
    try {
      return await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MODEL_ASSET_PATH,
          delegate: "CPU",
        },
        runningMode: "IMAGE",
        numFaces: MAX_FACES,
      });
    } catch {
      throw new FaceLandmarkerError("Could not initialize the face-analysis model in this browser.");
    }
  }
}

/** Loads (once) and returns the shared FaceLandmarker instance. */
export function getFaceLandmarker(): Promise<FaceLandmarkerType> {
  if (!landmarkerPromise) {
    landmarkerPromise = createLandmarker().catch((err) => {
      landmarkerPromise = null; // allow retry on next call
      throw err;
    });
  }
  return landmarkerPromise;
}

export interface FaceDetectionResult {
  /** One entry per detected face; empty when no face was found. */
  faces: LandmarkList[];
}

/** Runs detection on an already-loaded image element, or a canvas holding a video frame. */
export async function detectFace(image: HTMLImageElement | HTMLCanvasElement): Promise<FaceDetectionResult> {
  const landmarker = await getFaceLandmarker();
  let result;
  try {
    result = landmarker.detect(image);
  } catch {
    throw new FaceLandmarkerError("Face analysis failed on this image. Try a different photo.");
  }
  const faces = (result.faceLandmarks ?? []).map((face) =>
    face.map((p) => ({ x: p.x, y: p.y, z: p.z, visibility: p.visibility })),
  );
  return { faces };
}
