import { calculateContourGeometry } from "../../lib/facial-analysis/contour.ts";
import { LANDMARK } from "../../lib/facial-analysis/landmarkMapping.ts";
import { createSession, withExpectations, withPhotoSample, withVideoSample, type CalibrationSession } from "../../lib/facial-analysis/calibration/session.ts";
import { createPhotoCalibrationSample } from "../../lib/facial-analysis/calibration/sample.ts";
import { emptyExpectations, type EngineeringExpectations } from "../../lib/facial-analysis/calibration/expectations.ts";
import type { PhotoSlot } from "../../lib/facial-analysis/multiPhoto/types.ts";
import { buildCompleteFrontRecord } from "../observation/fixtures.ts";
import { contourFace, flatGray } from "../visual/fixtures.ts";
import { frontRecord, videoSample } from "./fixtures.ts";

/** A photo sample for `slot`, built through the real sample pipeline. `underEyeRatio` only matters for front. */
export function slotSample(slot: PhotoSlot, opts: { underEyeRatio?: number; nearSideShift?: number } = {}) {
  const record = slot === "front" ? frontRecord(opts.underEyeRatio ?? 0.7) : { ...buildCompleteFrontRecord(), slot };
  if (slot !== "front") {
    const turned = contourFace();
    turned[LANDMARK.noseTip] = { x: opts.nearSideShift ?? 0.35, y: 0.55, z: 0 };
    if (slot === "rightFortyFive") turned[LANDMARK.rightOvalCheek] = { x: 0.3, y: 0.62, z: 0 }; // makes the right view's cheek angle differ
    record.landmarks = turned;
    record.contour = calculateContourGeometry(turned, 1200, 1600, "threeQuarter");
  }
  return createPhotoCalibrationSample({ record, gray: flatGray(), sourceDescription: `test ${slot}`, role: slot });
}

export function realSession(id = "REAL-001", opts: { underEyeRatio?: number; video?: boolean; expectations?: Partial<EngineeringExpectations> } = {}): CalibrationSession {
  let s = createSession(id);
  s = withPhotoSample(s, "front", slotSample("front", { underEyeRatio: opts.underEyeRatio }));
  s = withPhotoSample(s, "leftFortyFive", slotSample("leftFortyFive"));
  s = withPhotoSample(s, "rightFortyFive", slotSample("rightFortyFive"));
  if (opts.video !== false) s = withVideoSample(s, videoSample());
  return withExpectations(s, { ...emptyExpectations(), ...opts.expectations });
}
