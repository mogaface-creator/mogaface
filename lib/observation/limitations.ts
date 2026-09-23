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
  "Skin analysis is not implemented — MediaPipe's facial-landmark system is not a skin-analysis engine.",
  "Hair computer-vision analysis is not implemented; hair observations are entirely user-reported.",
  "Facial-hair computer-vision analysis is not implemented; facial-hair observations are entirely user-reported.",
  "Style computer-vision analysis is not implemented; style observations are entirely user-reported.",
  "No reference population or percentile comparison exists for any measurement.",
  "No attractiveness, beauty, or \"ideal proportion\" score exists anywhere in this system.",
];
