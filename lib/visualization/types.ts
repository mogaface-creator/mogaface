/**
 * The visualization plan decides WHAT an image generator is allowed to
 * depict. It is derived only from consumer-ready treatment opportunities —
 * an image model never decides on its own what a person "needs". Anything not
 * on the approved list is recorded as an excluded change, with a reason.
 *
 * A plan describes an ILLUSTRATION. It is not a prediction of any treatment
 * outcome, and every plan carries the fixed disclaimer below.
 */

import type { EvidenceRef } from "../interpretation/types.ts";

/** The only changes a first-version illustration may show. Everything else is excluded. */
export const VISUALIZATION_CATEGORIES = ["facial_contour", "expression_lines"] as const;
export type VisualizationCategory = (typeof VISUALIZATION_CATEGORIES)[number];

/** Changes stay subtle: anything stronger is rejected by the validator. */
export const VISUALIZATION_INTENSITIES = ["subtle", "light"] as const;
export type VisualizationIntensity = (typeof VISUALIZATION_INTENSITIES)[number];

export const VISUALIZATION_DISCLAIMER = {
  label: "Illustrative visualization",
  notice: "Not a prediction of treatment outcome.",
} as const;

/** What an illustration must keep unchanged. */
export const PRESERVATION_RULES: readonly string[] = [
  "the person's identity and recognisable features",
  "general facial proportions",
  "skin tone",
  "hair",
  "facial hair",
  "the background, where possible",
  "a natural, realistic appearance",
];

export interface VisualizationChange {
  category: VisualizationCategory;
  description: string;
  intensity: VisualizationIntensity;
  /** Ids of the opportunity and evidence this change rests on. Never empty. Internal — not shown to consumers. */
  evidenceIds: string[];
}

export interface ExcludedChange {
  category: string;
  reason: string;
}

export type PlanStatus = "planned" | "not_eligible";

export type IneligibleReason = "no_front_photo" | "front_photo_quality" | "no_supported_change";

export interface VisualizationPlan {
  version: string;
  status: PlanStatus;
  /** The FRONT photo is the only source in this version. Null when not eligible for lack of one. */
  sourcePhoto: { slot: "front"; ref: string } | null;
  /** Empty unless status is "planned"; then at least one. */
  changes: VisualizationChange[];
  excludedChanges: ExcludedChange[];
  disclaimer: typeof VISUALIZATION_DISCLAIMER;
  preserve: readonly string[];
  ineligibleReason: IneligibleReason | null;
  evidence: EvidenceRef[];
}
