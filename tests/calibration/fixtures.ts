import { calculateContourGeometry } from "../../lib/facial-analysis/contour.ts";
import { createPhotoCalibrationSample, createVideoCalibrationSample } from "../../lib/facial-analysis/calibration/sample.ts";
import { analyzeVideoFrames } from "../../lib/facial-analysis/video/observe.ts";
import { buildCompleteFrontRecord } from "../observation/fixtures.ts";
import { BROW_RAISED, META, contourFace, expressionFace, flatGray, stripeRows, withNeutralOpening } from "../visual/fixtures.ts";
import type { CalibrationSample } from "../../lib/facial-analysis/calibration/types.ts";

/** A photo record as the coordinator produces it, with contour and under-eye measurements. */
export function frontRecord(underEyeRatio = 0.7) {
  const r = buildCompleteFrontRecord();
  r.landmarks = contourFace();
  r.contour = calculateContourGeometry(contourFace(), 1200, 1600, "front");
  r.underEye = {
    right: { underEyeLuminance: underEyeRatio * 100, cheekLuminance: 100, luminanceRatio: underEyeRatio },
    left: { underEyeLuminance: underEyeRatio * 100, cheekLuminance: 100, luminanceRatio: underEyeRatio },
  };
  return r;
}

export function photoSample(underEyeRatio = 0.7, description = "test matrix I — synthetic"): CalibrationSample {
  return createPhotoCalibrationSample({ record: frontRecord(underEyeRatio), gray: flatGray(), sourceDescription: description, role: "front" });
}

export function videoAnalysis() {
  return analyzeVideoFrames(
    META,
    withNeutralOpening(BROW_RAISED(), expressionFace({ browRaise: 0.016 })).map((f) => ({ ...f, gray: f.index >= 3 ? stripeRows(flatGray(), 300, 700, 150, 330) : flatGray() })),
  );
}

export function videoSample(): CalibrationSample {
  return createVideoCalibrationSample({ analysis: videoAnalysis(), sourceDescription: "synthetic", videoState: "BROW_RAISE" });
}
