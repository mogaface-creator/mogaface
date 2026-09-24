/**
 * Per-frame quality. Reuses the photo pipeline's checks (face count, size,
 * cropping, resolution, brightness) and is stricter about head pose, because
 * an expression comparison is only meaningful when the head hasn't moved
 * between the frames being compared.
 */

import { checkPhotoQuality, estimateRollDegrees, estimateYawRatio, MAX_ROLL_DEGREES, MAX_YAW_RATIO } from "../quality.ts";
import type { FrameAssessment, VideoFrameSample } from "./types.ts";

export function assessFrame(sample: VideoFrameSample): FrameAssessment {
  const quality = checkPhotoQuality({
    imageWidth: sample.imageWidth,
    imageHeight: sample.imageHeight,
    faceCount: sample.faceCount,
    landmarks: sample.landmarks ?? undefined,
    meanBrightness: sample.meanBrightness,
    expectFrontalOrientation: false,
  });

  const reasons = [...quality.errors];

  if (quality.valid && sample.landmarks) {
    const roll = estimateRollDegrees(sample.landmarks, sample.imageWidth, sample.imageHeight);
    const yaw = estimateYawRatio(sample.landmarks);
    if (roll === null || yaw === null) reasons.push("Face landmarks were incomplete.");
    else {
      if (Math.abs(roll) > MAX_ROLL_DEGREES) reasons.push("Head is tilted in this frame.");
      if (yaw > MAX_YAW_RATIO) reasons.push("Face is turned away from the camera in this frame.");
    }
    // Dim/overexposed frames still measure geometry, but expression texture in them is unreliable.
    if (quality.warnings.some((w) => w.includes("too dark") || w.includes("overexposed"))) {
      reasons.push("Lighting is too dark or too bright in this frame.");
    }
  }

  return { index: sample.index, timeSec: sample.timeSec, usable: reasons.length === 0, reasons, quality };
}
