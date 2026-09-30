/**
 * The three photo angles multi-angle illustration generation supports.
 * Deliberately dependency-free (no imports) so both lib/analysis-session/
 * and lib/image-generation/multiAngle.ts can import it without a circular
 * module dependency between them.
 */
export const ANGLE_SLOTS = ["front", "leftFortyFive", "rightFortyFive"] as const;
export type AngleSlot = (typeof ANGLE_SLOTS)[number];
