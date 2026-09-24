/**
 * Photo analysis coordinator — the bridge between assessment photo files
 * and the existing facial-analysis engine.
 *
 *   Assessment photos (File objects, held by PhotoCollection/AssessmentReview)
 *           ↓
 *   analyzeSinglePhoto() — THIS module
 *           ↓
 *   faceLandmarker.ts (MediaPipe, singleton — see Step 17)
 *           ↓
 *   quality.ts / measurements.ts / symmetry.ts / proportions.ts — unchanged
 *
 * This module owns no UI state. `runMultiPhotoAnalysis` processes slots one
 * at a time (Step 16 — no simultaneous MediaPipe calls); a caller that only
 * needs to reprocess one replaced photo should call `analyzeSinglePhoto`
 * directly instead (Step 14) and recompute `buildMultiPhotoAnalysis` from
 * its existing records — that recomputation is pure and cheap, no
 * re-detection required.
 */

import { detectFace, FaceLandmarkerError } from "../faceLandmarker.ts";
import { checkPhotoQuality, getFaceFrameCoverage } from "../quality.ts";
import { loadImage, sampleGrayImage, sampleMeanBrightness } from "../imageSampling.ts";
import { calculateContourGeometry } from "../contour.ts";
import { measureUnderEye } from "../underEye.ts";
import { calculateMeasurements } from "../measurements.ts";
import { calculateSymmetry } from "../symmetry.ts";
import { calculateProportions } from "../proportions.ts";
import { validateFront, validateThreeQuarter, validateProfile } from "./viewValidation.ts";
import { checkConsistency } from "./consistency.ts";
import { combineMeasurements } from "./combine.ts";
import { createIdleRecord, viewCategoryForSlot, MULTI_PHOTO_ANALYSIS_VERSION } from "./types.ts";
import type { MultiPhotoFacialAnalysis, PhotoAnalysisRecord, PhotoSlot } from "./types.ts";
import { PHOTO_SLOTS } from "../../assessment/types.ts";

/** Analyzes exactly one photo. Never throws — failures land in the returned record's `status`/`errors`. */
export async function analyzeSinglePhoto(
  slot: PhotoSlot,
  file: File,
  onStatusChange?: (status: PhotoAnalysisRecord["status"]) => void,
): Promise<PhotoAnalysisRecord> {
  const startedAt = performance.now();
  const record = createIdleRecord(slot, file);
  const setStatus = (status: PhotoAnalysisRecord["status"]) => {
    record.status = status;
    onStatusChange?.(status);
  };

  let objectUrl: string | null = null;
  try {
    setStatus("loading");
    objectUrl = URL.createObjectURL(file);
    const image = await loadImage(objectUrl);
    record.imageWidth = image.naturalWidth;
    record.imageHeight = image.naturalHeight;

    setStatus("validating");
    record.meanBrightness = sampleMeanBrightness(image) ?? null;

    setStatus("detecting");
    const detection = await detectFace(image);
    record.faceCount = detection.faces.length;
    const landmarks = detection.faces[0];

    setStatus("landmarking");
    const viewCategory = viewCategoryForSlot(slot);
    const quality = checkPhotoQuality({
      imageWidth: image.naturalWidth,
      imageHeight: image.naturalHeight,
      faceCount: detection.faces.length,
      landmarks,
      meanBrightness: record.meanBrightness ?? undefined,
      expectFrontalOrientation: viewCategory === "front",
    });
    record.quality = quality;

    if (landmarks) {
      record.landmarks = landmarks;
      record.faceFrameCoverage = getFaceFrameCoverage(landmarks);
      record.viewValidation =
        viewCategory === "front"
          ? validateFront(landmarks)
          : viewCategory === "threeQuarter"
            ? validateThreeQuarter(landmarks, slot === "leftFortyFive" ? "left" : "right")
            : validateProfile(landmarks);
      record.warnings.push(...record.viewValidation.warnings);
    }

    if (!quality.valid) {
      record.errors.push(...quality.errors);
      setStatus("blocked");
      return finish(record, startedAt);
    }
    record.warnings.push(...quality.warnings);

    // Only front and 45° photos get the frontal measurement engine — never
    // profile (Step 7: don't calculate frontal-only measurements from
    // profile images; see viewCapabilities.ts for why).
    if (landmarks && viewCategory !== "profile") {
      setStatus("analyzing");
      record.measurements = calculateMeasurements(landmarks);
      record.symmetry = calculateSymmetry(landmarks, record.measurements);
      record.proportions = calculateProportions(record.measurements);

      // Visual-observation inputs (relative geometry; front-view under-eye brightness).
      // Best-effort: a failure here must never fail the photo's core analysis.
      try {
        record.contour = calculateContourGeometry(landmarks, image.naturalWidth, image.naturalHeight, viewCategory === "front" ? "front" : "threeQuarter");
        if (viewCategory === "front") {
          const gray = sampleGrayImage(image);
          record.underEye = gray ? measureUnderEye(gray, landmarks) : null;
        }
      } catch {
        record.contour = null;
        record.underEye = null;
      }
    }

    setStatus("complete");
    return finish(record, startedAt);
  } catch (err) {
    record.errors.push(
      err instanceof FaceLandmarkerError || err instanceof Error
        ? err.message
        : "Something went wrong analyzing this photo.",
    );
    setStatus("error");
    return finish(record, startedAt);
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

function finish(record: PhotoAnalysisRecord, startedAt: number): PhotoAnalysisRecord {
  record.processingTimeMs = Math.round(performance.now() - startedAt);
  return record;
}

export interface RunOptions {
  onProgress?: (info: { slot: PhotoSlot; index: number; total: number }) => void;
  onPhotoStatusChange?: (slot: PhotoSlot, status: PhotoAnalysisRecord["status"]) => void;
}

/** Runs analysis for every slot that has a file, sequentially (Step 16). Slots with no file are skipped. */
export async function runMultiPhotoAnalysis(
  files: Partial<Record<PhotoSlot, File>>,
  options: RunOptions = {},
): Promise<PhotoAnalysisRecord[]> {
  const slotsToRun = PHOTO_SLOTS.map((p) => p.slot).filter((slot) => files[slot]);
  const records: PhotoAnalysisRecord[] = [];

  for (let i = 0; i < slotsToRun.length; i++) {
    const slot = slotsToRun[i];
    const file = files[slot]!;
    options.onProgress?.({ slot, index: i, total: slotsToRun.length });
    const record = await analyzeSinglePhoto(slot, file, (status) => options.onPhotoStatusChange?.(slot, status));
    records.push(record);
  }

  return records;
}

/** Pure — combines a set of per-photo records into the top-level result. Cheap enough to call after every change. */
export function buildMultiPhotoAnalysis(assessmentId: string, records: PhotoAnalysisRecord[]): MultiPhotoFacialAnalysis {
  return {
    multiPhotoAnalysisVersion: MULTI_PHOTO_ANALYSIS_VERSION,
    assessmentId,
    createdAt: new Date().toISOString(),
    photos: records,
    consistency: checkConsistency(records),
    combinedMeasurements: combineMeasurements(records),
  };
}
