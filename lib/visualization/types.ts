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
import type { TreatmentCategory } from "../treatment-opportunities/types.ts";

/**
 * Every visual area the taxonomy recognizes. Recognizing a category here does
 * NOT make it visualizable — that is ILLUSTRATION_POLICY's decision
 * (eligibility.ts), and for three of these there is no path to real evidence
 * at all yet (see VISUALIZATION_CATEGORY_TREATMENT_CATEGORY below and
 * build.ts's APPROVED map, which only routes two of these from real
 * opportunities). The rest exist so the taxonomy, the dev-only composite
 * fixture, and the report UI have a name for each area in the product's
 * target reference experience — never so production can show them early.
 */
export const VISUALIZATION_CATEGORIES = ["expression_lines", "facial_contour", "jawline_definition", "under_eye", "skin_appearance"] as const;
export type VisualizationCategory = (typeof VISUALIZATION_CATEGORIES)[number];

/** Short, consumer-facing name for a visualized area's UI card. */
export const VISUALIZATION_CATEGORY_LABELS: Record<VisualizationCategory, string> = {
  expression_lines: "Expression lines",
  facial_contour: "Facial contour",
  jawline_definition: "Jawline definition",
  under_eye: "Under-eye appearance",
  skin_appearance: "Skin appearance",
};

/**
 * The treatment family a category would relate to IF it were ever
 * visualizable — used only for consumer-facing labelling (e.g. "Facial
 * contouring") and for the eligibility/validator re-check that a change is
 * backed by a real, matching, consumer-ready opportunity. It does not by
 * itself grant eligibility: build.ts's APPROVED map (not this one) decides
 * whether a real opportunity can ever populate a given category, and
 * ILLUSTRATION_POLICY (eligibility.ts) decides whether it may be rendered.
 */
export const VISUALIZATION_CATEGORY_TREATMENT_CATEGORY: Record<VisualizationCategory, TreatmentCategory> = {
  expression_lines: "NEUROMODULATOR",
  facial_contour: "FACIAL_CONTOURING",
  jawline_definition: "FACIAL_CONTOURING",
  under_eye: "DERMAL_FILLER",
  skin_appearance: "SKIN_TREATMENT",
};

/** Changes stay subtle: anything stronger is rejected by the validator. */
export const VISUALIZATION_INTENSITIES = ["subtle", "light"] as const;
export type VisualizationIntensity = (typeof VISUALIZATION_INTENSITIES)[number];

export const VISUALIZATION_DISCLAIMER = {
  label: "Illustrative visualization",
  notice: "Not a prediction of treatment outcome.",
} as const;

/** What an illustration must keep unchanged unless an approved change explicitly concerns it. */
export const PRESERVATION_RULES: readonly string[] = [
  "the person's identity and recognisable features",
  "general facial proportions",
  "facial structure",
  "eye shape",
  "nose shape",
  "lip shape",
  "skin tone",
  "eye colour",
  "ethnicity and gender presentation",
  "apparent age",
  "hair",
  "hairstyle",
  "facial hair",
  "body and clothing",
  "head position and camera angle",
  "lighting",
  "the background",
  "a natural, realistic, unretouched appearance",
];

/** Where an approved change may act. Every other region must stay untouched. */
export const VISUALIZATION_TARGET_REGIONS = ["forehead", "lower_face_contour", "jawline", "under_eye_area", "skin_overall"] as const;
export type VisualizationTargetRegion = (typeof VISUALIZATION_TARGET_REGIONS)[number];

/**
 * The ONLY visual changes an illustration may ever contain, with the exact
 * wording an image model receives. The text is fixed here — never taken from a
 * user, a model, or a request — and every string is checked by safety.ts.
 * `description` is the consumer-facing summary; `visualInstruction` is the
 * rendering instruction.
 *
 * Wording is deliberately "clearly visible, natural-looking" rather than
 * "subtle": an early supervised test showed a merely "subtle" instruction
 * produced an After image too close to the Before to be useful. The safety
 * ceiling this sits under is unchanged — `intensityLimit` is still always
 * "subtle" in the type below, and every instruction still passes the exact
 * same UNSAFE_VISUAL_RULES (no beautification, no reshaping language, no
 * treatment names, no promises) — only the requested visibility of an
 * otherwise-identical, otherwise-identically-gated change increased.
 */
export const APPROVED_VISUAL_CHANGES: Record<VisualizationCategory, { targetRegion: VisualizationTargetRegion; description: string; visualInstruction: string }> = {
  expression_lines: {
    targetRegion: "forehead",
    description: "Visible, natural-looking reduction of the observed expression-related forehead lines",
    visualInstruction:
      "Illustrate a clearly visible, natural-looking reduction of the observed horizontal expression lines in the forehead region only — noticeable in a side-by-side comparison, not imperceptible — while keeping natural skin texture, the person's natural expression, and every other feature unchanged.",
  },
  facial_contour: {
    targetRegion: "lower_face_contour",
    description: "Visible, natural-looking refinement of facial contour and definition",
    visualInstruction:
      "Illustrate a clearly visible, natural-looking refinement of the lower-face contour only, noticeable in a side-by-side comparison, while keeping facial proportions, features and identity unchanged.",
  },
  // No treatment-opportunity rule produces a "jawline_definition" opportunity
  // distinct from facial_contour today (see lib/treatment-opportunities/rules.ts
  // Rule B) — build.ts's APPROVED map has no entry for it, so it can never be
  // populated from a real user's evidence. It exists for the taxonomy and the
  // dev-only composite fixture only (see lib/image-generation/devIllustrationFixture.ts).
  jawline_definition: {
    targetRegion: "jawline",
    description: "Visible, natural-looking definition along the jawline",
    visualInstruction:
      "Illustrate a clearly visible, natural-looking increase in definition along the jawline only, noticeable in a side-by-side comparison, while keeping the surrounding facial structure, proportions, features and identity unchanged.",
  },
  // No treatment-opportunity rule consumes the "under_eye" signal at all (see
  // lib/treatment-opportunities/evidence.ts) — this can never be populated from
  // a real user's evidence either. Taxonomy/dev-fixture only, same as above.
  under_eye: {
    targetRegion: "under_eye_area",
    description: "Visible, natural-looking reduction in the appearance of under-eye darkness",
    visualInstruction:
      "Illustrate a clearly visible, natural-looking reduction in the appearance of under-eye shadow/darkness in the under-eye region only, noticeable in a side-by-side comparison, while keeping eye shape, surrounding skin texture and identity unchanged.",
  },
  // A real SKIN_TREATMENT opportunity CAN exist (rules.ts Rule D), but build.ts
  // deliberately never maps it into a change — skin concerns come from
  // questionnaire responses, not visual evidence (see build.ts's
  // EXCLUDED_REASON). ILLUSTRATION_POLICY also keeps this false, so a change
  // in this category is blocked twice over even before that.
  skin_appearance: {
    targetRegion: "skin_overall",
    description: "Visible, natural-looking reduction in the appearance of the specifically observed skin-texture concern",
    visualInstruction:
      "Illustrate a clearly visible, natural-looking reduction in the appearance of the specifically observed skin-texture concern only, without altering skin texture anywhere else, noticeable in a side-by-side comparison, while keeping facial structure and identity unchanged.",
  },
};

/** How a generated image is named and labelled. It is an illustration — never a prediction, expectation, guarantee or treatment result. */
export const ILLUSTRATIVE_AFTER = {
  label: "Illustrative After",
  aiLabel: "AI-generated visualization",
  notice: "AI-generated visualization. This is illustrative only and is not a prediction or guarantee of treatment results.",
  shortNotice: "Illustrative only — not a prediction or guarantee of treatment results.",
} as const;

export interface VisualizationChange {
  /** Stable id, e.g. "change.expression_lines". */
  changeId: string;
  category: VisualizationCategory;
  targetRegion: VisualizationTargetRegion;
  /** Consumer-facing summary. */
  description: string;
  /** The rendering instruction — always equal to APPROVED_VISUAL_CHANGES[category].visualInstruction. */
  visualInstruction: string;
  intensity: VisualizationIntensity;
  /** The strongest intensity this change may be rendered at. */
  intensityLimit: "subtle";
  /** Ids of the opportunity and evidence this change rests on. Never empty. Internal — not shown to consumers. */
  evidenceIds: string[];
  evidenceRefs: EvidenceRef[];
  /** The treatment opportunity this change was derived from. */
  sourceOpportunityId: string;
  /** True only when the source opportunity is consumer-ready. */
  consumerReady: boolean;
  /** "approved" only after the instruction passed the safety validator. */
  safetyStatus: "approved";
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
