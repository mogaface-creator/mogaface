/**
 * What this analysis explicitly cannot currently determine. Every
 * MogaFaceAnalysis carries this list unmodified — nothing here is hidden
 * or reduced based on how much data a given assessment happens to have.
 */
export const ANALYSIS_LIMITATIONS: string[] = [
  "Measurements are relative units derived from each photo's own geometry, not physical centimeters — there is no calibration reference.",
  "Frontal geometry comes primarily from the front photo; there is exactly one front photo per assessment today, so nothing is averaged across multiple frontal views.",
  "45° geometry is computed per-photo but is not currently combined into frontal metrics — see FACIAL_ANALYSIS_METHODOLOGY.md.",
  "Profile-specific metrics (nose projection, chin projection, facial convexity) are not currently implemented.",
  "Contour observations are relative outline angles and ratios from 2D photographs; they are not volumes, and no absolute physical measurement exists without a calibration reference.",
  "Camera angle and lens distance change every geometric measurement; a 45° photo is not a calibrated 45° pose.",
  "Selfie lighting changes how skin, shadows and lines appear — brightness- and texture-based observations shift with lighting direction, exposure and the camera's own image processing.",
  "Expression states are identified from landmark geometry relative to the video's own neutral frames; the user's expression may be partial or imperfect, and the video may not contain every requested expression.",
  "Expression movement and line-contrast thresholds are uncalibrated heuristics with no validation set — treat them as descriptive, not diagnostic.",
  "Static photographs cannot establish dynamic (expression-related) lines; only a within-video comparison of neutral and expression frames is used, and only when a video is provided.",
  "Under-eye observations describe how an area looks in one photo (relative brightness); they do not say why it looks that way. Puffiness, hollowing and fine-line patterns are not measured.",
  "Facial lifting or laxity is not measured: no clinically defensible observation method exists, and generic jaw geometry is not treated as evidence of it.",
  "Nothing here is a clinical diagnosis, a treatment suitability determination, or a prediction of any treatment result.",
  "Skin analysis is not implemented — MediaPipe's facial-landmark system is not a skin-analysis engine.",
  "Hair computer-vision analysis is not implemented; hair observations are entirely user-reported.",
  "Facial-hair computer-vision analysis is not implemented; facial-hair observations are entirely user-reported.",
  "Style computer-vision analysis is not implemented; style observations are entirely user-reported.",
  "No reference population or percentile comparison exists for any measurement.",
  "No attractiveness, beauty, or \"ideal proportion\" score exists anywhere in this system.",
];
