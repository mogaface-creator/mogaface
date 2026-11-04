/** Appearance preferences, never a diagnosis or a prescription. All are opt-in. */
import { sanitizeAppearanceConcerns, type AppearanceConcerns } from "../assessment/appearanceConcerns.ts";
import type { AppearanceArea } from "./realismPrompt.server.ts";
export const NATURAL_REFINEMENT_KEYS = ["brow_opening", "lip_vermilion", "lower_face_balance", "mentolabial", "chin_projection"] as const;
export type NaturalRefinementKey = typeof NATURAL_REFINEMENT_KEYS[number];
const DETAIL_TARGETS: Record<string, NaturalRefinementKey> = {
  BROW_OPENING: "brow_opening", LIP_FULLNESS: "lip_vermilion", LOWER_FACE_SLIMMING: "lower_face_balance",
  MENTOLABIAL_TRANSITION: "mentolabial", CHIN_PROJECTION: "chin_projection",
};
export function selectedNaturalRefinements(value: AppearanceConcerns | null | undefined): NaturalRefinementKey[] {
  const concerns = sanitizeAppearanceConcerns(value);
  if (!concerns) return [];
  return [...new Set(concerns.details.flatMap(detail => DETAIL_TARGETS[detail] ? [DETAIL_TARGETS[detail]] : []))];
}
const INSTRUCTIONS: Record<NaturalRefinementKey, string> = {
  brow_opening: "Create a subtle more open brow frame by a small change in middle and outer brow position only. Retain brow density, individual hairs and natural arch; preserve eyeball size, lid margins, canthal tilt and gaze. No surprised arch or stretched eyes. Preserve if brow detail is unclear.",
  lip_vermilion: "Slightly increase ONLY the visible vermilion body of both lips vertically and clarify the natural vermilion border. Preserve mouth width, corner positions, Cupid's bow, surrounding cutaneous lip, philtrum, natural colour and fine lip lines. Keep the mouth closed if closed in the source: opening the pink part means visible vermilion, not an open mouth. No overlining, liner, thick raised border, pout or duck lips.",
  lower_face_balance: "Modestly slim and balance visible lower lateral jaw-region fullness, preserving cheek volume and neck dimensions. A visible contour difference is not a diagnosis of masseter hypertrophy. Do not infer anatomical left/right from an unverified mirrored photograph. If laterality or pose is unclear, do not make a unilateral correction. No hollow cheeks, perfect symmetry, dramatic weight-loss effect or pointed V-shaped jaw.",
  mentolabial: "Gently soften the visible mentolabial groove: the dark transition between the lower lip and chin apex. Reduce its shadow and apparent depth while retaining a faint natural lip-to-chin transition, pores and skin variation. No inflated shelf, flat plastic patch, added chin length or lip change unless separately selected. Preserve if the transition is obscured by facial hair or unclear lighting.",
  chin_projection: "As an explicitly selected visual concept, illustrate only a modest apparent chin-contour adjustment and natural rounded central taper. A frontal photo cannot establish projection; do not describe a frontal concept as a measured forward-projection change. Preserve when the chin is obscured. No major vertical elongation, pointed chin or change to mouth position. Do not infer a skeletal deficiency or reconstruct hidden anatomy.",
};
export function naturalRefinementAreas(keys: readonly NaturalRefinementKey[]): AppearanceArea[] {
  return NATURAL_REFINEMENT_KEYS.filter(key => keys.includes(key)).map(key => ({key, level: "subtle", instruction: INSTRUCTIONS[key]}));
}
