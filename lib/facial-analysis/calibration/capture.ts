/**
 * Client-only glue for the development calibration panel: run the REAL
 * pipeline (the same analyzeSinglePhoto / analyzeVideoFile the app uses) on a
 * developer-supplied file and wrap the result as a CalibrationSample.
 *
 * Files are read in memory and never persisted; only numbers and short text
 * end up in the sample. Never import during SSR.
 */

import { loadImage, sampleGrayImage } from "../imageSampling.ts";
import { analyzeSinglePhoto } from "../multiPhoto/coordinator.ts";
import type { PhotoSlot } from "../multiPhoto/types.ts";
import { analyzeVideoFile } from "../video/capture.ts";
import type { ExpressionState } from "../video/types.ts";
import { createPhotoCalibrationSample, createVideoCalibrationSample } from "./sample.ts";
import type { CalibrationSample } from "./types.ts";

export async function calibratePhotoFile(file: File, role: PhotoSlot, sourceDescription: string): Promise<CalibrationSample> {
  const record = await analyzeSinglePhoto(role, file);
  let gray = null;
  const url = URL.createObjectURL(file);
  try {
    gray = sampleGrayImage(await loadImage(url)) ?? null;
  } catch {
    gray = null; // an unreadable image was already reported by the record itself
  } finally {
    URL.revokeObjectURL(url);
  }
  return createPhotoCalibrationSample({ record, gray, sourceDescription, role });
}

export async function calibrateVideoFile(
  file: File,
  sourceDescription: string,
  videoState: ExpressionState | null,
  onProgress?: (done: number, total: number) => void,
): Promise<CalibrationSample> {
  const analysis = await analyzeVideoFile(file, { onProgress });
  return createVideoCalibrationSample({ analysis, sourceDescription, videoState });
}
