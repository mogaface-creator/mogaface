/**
 * The registry of every threshold and tunable margin in the visual layer,
 * built from the real constants (not copies), so it cannot drift from the
 * code. docs/VISUAL_CALIBRATION.md documents each entry by id — a test
 * checks that every id here appears there.
 *
 * ALL of these are first-version engineering heuristics. None has been
 * checked against real faces; none is clinically validated.
 */

import { CONTOUR_VIEW_DISAGREEMENT_DEG } from "../../treatment-opportunities/evidence.ts";
import { TURNED_SPAN_RATIO } from "../contour.ts";
import {
  MAX_BRIGHTNESS,
  MAX_ROLL_DEGREES,
  MAX_YAW_RATIO,
  MIN_BRIGHTNESS,
  MIN_FACE_WIDTH_ERROR,
  MIN_FACE_WIDTH_WARNING,
  MIN_RESOLUTION_ERROR,
  MIN_RESOLUTION_WARNING,
} from "../quality.ts";
import { UNDER_EYE_BORDERLINE_FRACTION, UNDER_EYE_DARKER_RATIO } from "../underEye.ts";
import {
  BASELINE_STABILITY,
  DOMINANCE_FACTOR,
  MOVEMENT_BORDERLINE_FRACTION,
  MOVEMENT_THRESHOLD_PCT,
  NEUTRAL_FRACTION,
  NEUTRAL_WINDOW_FRAMES,
} from "../video/expressions.ts";
import {
  CONSISTENT_CV,
  HIGH_STRENGTH_MIN_FRAMES,
  LINE_CONTRAST_BORDERLINE_FRACTION,
  LINE_CONTRAST_FLOOR,
  LINE_CONTRAST_RATIO_THRESHOLD,
} from "../video/observe.ts";
import { DEFAULT_MAX_FRAMES, EDGE_MARGIN_FRACTION, MAX_FRAME_SIDE } from "../video/sampling.ts";
import {
  MAX_VIDEO_DURATION_SEC,
  MIN_VIDEO_DIMENSION_ERROR,
  MIN_VIDEO_DIMENSION_WARNING,
  MIN_VIDEO_DURATION_SEC,
} from "../video/validate.ts";

export interface ThresholdDefinition {
  /** Stable id, referenced from docs/VISUAL_CALIBRATION.md. */
  id: string;
  value: number;
  unit: string;
  /**
   *  decision   — decides whether an observation is produced
   *  margin     — the borderline band around a decision (borderline → no observation)
   *  parameter  — a tuning parameter of the method (window size, dominance factor, …)
   *  quality_gate — decides whether a photo/frame/video is usable at all
   *  guard      — a cross-check that can withhold evidence
   */
  kind: "decision" | "margin" | "parameter" | "quality_gate" | "guard";
  meaning: string;
  /** Observation ids (or families) whose presence depends on this value. */
  affects: string[];
  /** Where the constant lives. */
  source: string;
}

const T = (t: ThresholdDefinition) => t;

export const VISUAL_THRESHOLDS: ThresholdDefinition[] = [
  T({ id: "movement.BROW_RAISE", value: MOVEMENT_THRESHOLD_PCT.BROW_RAISE, unit: "% vs neutral", kind: "decision", meaning: "Brow-to-eye distance increase at which a frame counts as a brow raise.", affects: ["expression.browRaise.foreheadRegionMovementPct", "expression.visibleForeheadLinePattern"], source: "video/expressions.ts" }),
  T({ id: "movement.FROWN", value: MOVEMENT_THRESHOLD_PCT.FROWN, unit: "% vs neutral", kind: "decision", meaning: "Mean inner-brow closeness/drop at which a frame counts as a frown.", affects: ["expression.frown.glabellarRegionMovementPct", "expression.visibleGlabellarLinePattern"], source: "video/expressions.ts" }),
  T({ id: "movement.SMILE", value: MOVEMENT_THRESHOLD_PCT.SMILE, unit: "% vs neutral", kind: "decision", meaning: "Mouth-width increase at which a frame counts as a smile.", affects: ["expression.smile.mouthAreaMovementPct", "expression.visibleLateralEyeLinePattern"], source: "video/expressions.ts" }),
  T({ id: "movement.SQUINT", value: MOVEMENT_THRESHOLD_PCT.SQUINT, unit: "% vs neutral", kind: "decision", meaning: "Eye-opening decrease at which a frame counts as a squint.", affects: ["expression.squint.eyeAreaMovementPct", "expression.visibleLateralEyeLinePattern"], source: "video/expressions.ts" }),
  T({ id: "movement.borderlineFraction", value: MOVEMENT_BORDERLINE_FRACTION, unit: "fraction of threshold", kind: "margin", meaning: "A frame must exceed a state's threshold by this margin to count; below it (down to neutralFraction) the frame is ambiguous.", affects: ["expression.*"], source: "video/expressions.ts" }),
  T({ id: "movement.neutralFraction", value: NEUTRAL_FRACTION, unit: "fraction of threshold", kind: "parameter", meaning: "A frame is NEUTRAL only if every state's movement is below this fraction of its threshold.", affects: ["expression.*"], source: "video/expressions.ts" }),
  T({ id: "movement.dominanceFactor", value: DOMINANCE_FACTOR, unit: "×", kind: "parameter", meaning: "When two expressions both pass, the stronger must exceed the other by this factor or the frame is ambiguous.", affects: ["expression.*"], source: "video/expressions.ts" }),
  T({ id: "baseline.windowFrames", value: NEUTRAL_WINDOW_FRAMES, unit: "frames", kind: "parameter", meaning: "How many of the first usable frames form the neutral baseline.", affects: ["expression.*"], source: "video/expressions.ts" }),
  T({ id: "baseline.stability", value: BASELINE_STABILITY, unit: "relative spread", kind: "quality_gate", meaning: "Maximum (max−min)/median of any feature across baseline frames for the face to count as at rest; otherwise no baseline.", affects: ["expression.*"], source: "video/expressions.ts" }),
  T({ id: "lineContrast.ratio", value: LINE_CONTRAST_RATIO_THRESHOLD, unit: "× neutral", kind: "decision", meaning: "Expression-frame line contrast ÷ neutral-frame line contrast needed to call a line pattern visible.", affects: ["expression.visibleForeheadLinePattern", "expression.visibleGlabellarLinePattern", "expression.visibleLateralEyeLinePattern"], source: "video/observe.ts" }),
  T({ id: "lineContrast.borderlineFraction", value: LINE_CONTRAST_BORDERLINE_FRACTION, unit: "fraction of threshold", kind: "margin", meaning: "A contrast ratio within this margin of lineContrast.ratio is insufficient evidence.", affects: ["expression.visible*LinePattern"], source: "video/observe.ts" }),
  T({ id: "lineContrast.floor", value: LINE_CONTRAST_FLOOR, unit: "fraction of mean brightness", kind: "quality_gate", meaning: "Minimum expression-frame contrast, so a near-flat region cannot pass on a ratio of tiny numbers; also floors the neutral denominator.", affects: ["expression.visible*LinePattern"], source: "video/observe.ts" }),
  T({ id: "strength.consistentCv", value: CONSISTENT_CV, unit: "coefficient of variation", kind: "parameter", meaning: "Movement is 'consistent' (needed for high evidence strength) at or below this variation across expression frames.", affects: ["expression evidence strength"], source: "video/observe.ts" }),
  T({ id: "strength.highMinFrames", value: HIGH_STRENGTH_MIN_FRAMES, unit: "frames", kind: "parameter", meaning: "Expression frames needed for high evidence strength.", affects: ["expression evidence strength"], source: "video/observe.ts" }),
  T({ id: "underEye.darkerRatio", value: UNDER_EYE_DARKER_RATIO, unit: "under-eye ÷ cheek brightness", kind: "decision", meaning: "Both eyes at or below this ratio (and clear of the borderline band) → 'visible dark-looking under-eye appearance'.", affects: ["eyeArea.visibleUnderEyeDarkness"], source: "underEye.ts" }),
  T({ id: "underEye.borderlineFraction", value: UNDER_EYE_BORDERLINE_FRACTION, unit: "fraction of threshold", kind: "margin", meaning: "A ratio within this margin of underEye.darkerRatio is insufficient evidence.", affects: ["eyeArea.visibleUnderEyeDarkness"], source: "underEye.ts" }),
  T({ id: "contour.turnedSpanRatio", value: TURNED_SPAN_RATIO, unit: "span ratio", kind: "decision", meaning: "Nose-to-edge span ratio at which a '45°' photo counts as turned enough to report its near-side contour; a frontal-looking 45° photo contributes nothing.", affects: ["facialStructure.contour.*.leftFortyFive.*", "facialStructure.contour.*.rightFortyFive.*"], source: "contour.ts" }),
  T({ id: "contour.viewDisagreementDeg", value: CONTOUR_VIEW_DISAGREEMENT_DEG, unit: "degrees", kind: "guard", meaning: "Left vs right 45° outline angles further apart than this are contradictory; contour evidence is set aside (insufficient).", affects: ["facialStructure.contour.* (as engine evidence)"], source: "treatment-opportunities/evidence.ts" }),
  T({ id: "quality.maxRoll", value: MAX_ROLL_DEGREES, unit: "degrees", kind: "quality_gate", meaning: "Eye-line tilt above which a front photo warns and a video frame is unusable.", affects: ["all photo/video observations"], source: "quality.ts" }),
  T({ id: "quality.maxYaw", value: MAX_YAW_RATIO, unit: "span ratio", kind: "quality_gate", meaning: "Nose-to-eye span ratio above which a front photo warns and a video frame is unusable.", affects: ["all photo/video observations"], source: "quality.ts" }),
  T({ id: "quality.minFaceWidthError", value: MIN_FACE_WIDTH_ERROR, unit: "fraction of frame width", kind: "quality_gate", meaning: "Face narrower than this is a hard error.", affects: ["all photo/video observations"], source: "quality.ts" }),
  T({ id: "quality.minFaceWidthWarning", value: MIN_FACE_WIDTH_WARNING, unit: "fraction of frame width", kind: "quality_gate", meaning: "Face narrower than this warns.", affects: ["all photo/video observations"], source: "quality.ts" }),
  T({ id: "quality.minBrightness", value: MIN_BRIGHTNESS, unit: "0-255 mean luminance", kind: "quality_gate", meaning: "Darker frames are flagged; video frames this dark are unusable.", affects: ["all photo/video observations"], source: "quality.ts" }),
  T({ id: "quality.maxBrightness", value: MAX_BRIGHTNESS, unit: "0-255 mean luminance", kind: "quality_gate", meaning: "Brighter frames are flagged; video frames this bright are unusable.", affects: ["all photo/video observations"], source: "quality.ts" }),
  T({ id: "quality.minResolutionError", value: MIN_RESOLUTION_ERROR, unit: "px (short side)", kind: "quality_gate", meaning: "Hard resolution floor for photos and frames.", affects: ["all photo/video observations"], source: "quality.ts" }),
  T({ id: "quality.minResolutionWarning", value: MIN_RESOLUTION_WARNING, unit: "px (short side)", kind: "quality_gate", meaning: "Resolution warning level.", affects: ["all photo/video observations"], source: "quality.ts" }),
  T({ id: "video.minDurationSec", value: MIN_VIDEO_DURATION_SEC, unit: "s", kind: "quality_gate", meaning: "Shortest accepted video.", affects: ["expression.*"], source: "video/validate.ts" }),
  T({ id: "video.maxDurationSec", value: MAX_VIDEO_DURATION_SEC, unit: "s", kind: "quality_gate", meaning: "Longest accepted video.", affects: ["expression.*"], source: "video/validate.ts" }),
  T({ id: "video.minDimensionError", value: MIN_VIDEO_DIMENSION_ERROR, unit: "px (short side)", kind: "quality_gate", meaning: "Video below this resolution is rejected.", affects: ["expression.*"], source: "video/validate.ts" }),
  T({ id: "video.minDimensionWarning", value: MIN_VIDEO_DIMENSION_WARNING, unit: "px (short side)", kind: "quality_gate", meaning: "Video below this resolution warns.", affects: ["expression.*"], source: "video/validate.ts" }),
  T({ id: "video.maxFrames", value: DEFAULT_MAX_FRAMES, unit: "frames", kind: "parameter", meaning: "Frames sampled per video.", affects: ["expression.*"], source: "video/sampling.ts" }),
  T({ id: "video.edgeMarginFraction", value: EDGE_MARGIN_FRACTION, unit: "fraction of duration", kind: "parameter", meaning: "Start and end of the video skipped when sampling.", affects: ["expression.*"], source: "video/sampling.ts" }),
  T({ id: "video.maxFrameSide", value: MAX_FRAME_SIDE, unit: "px", kind: "parameter", meaning: "Frames are downscaled to this long side before detection and pixel measures.", affects: ["expression.*"], source: "video/sampling.ts" }),
];

/**
 * Threshold-like values that are NOT individually registered: the region
 * boxes in regions.ts (forehead, glabellar, lateral-eye and under-eye strips)
 * are built from fixed fractions of the face/eye size. Where those boxes land
 * on a real face is the most likely source of calibration error in the
 * pixel-based measures, and must be inspected visually — see
 * docs/VISUAL_CALIBRATION.md, "Candidate calibration issues".
 */
export const REGION_GEOMETRY_NOTE =
  "Region boxes (regions.ts) use fixed proportions of face and eye size; check where they fall on real faces (hair, brows, glasses, shadows).";
