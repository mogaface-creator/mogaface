/**
 * Treatment CATEGORIES — generic families of treatment worth discussing —
 * not clinic services. Whether a given clinic actually offers a category is
 * a separate, later concern (clinic-specific configuration); nothing here
 * assumes any category is available anywhere.
 *
 * Wording is deliberately neutral: no efficacy claims, no suitability
 * claims. HAIR_SCALP_ASSESSMENT and CLINIC_CONSULTATION are defined for
 * completeness but no rule produces them yet.
 */

import type { TreatmentCategory } from "./types.ts";

export interface TreatmentCategoryDefinition {
  category: TreatmentCategory;
  label: string;
  /** Used as an opportunity's title, e.g. "Neuromodulator consultation". */
  consultationLabel: string;
  description: string;
}

export const TREATMENT_CATEGORY_DEFINITIONS: Record<TreatmentCategory, TreatmentCategoryDefinition> = {
  NEUROMODULATOR: {
    category: "NEUROMODULATOR",
    label: "Neuromodulator",
    consultationLabel: "Neuromodulator consultation",
    description: "Injectable treatments a clinician may consider for the appearance of expression lines.",
  },
  DERMAL_FILLER: {
    category: "DERMAL_FILLER",
    label: "Dermal filler",
    consultationLabel: "Dermal filler consultation",
    description: "Injectable treatments a clinician may consider for facial volume or contour.",
  },
  FACIAL_CONTOURING: {
    category: "FACIAL_CONTOURING",
    label: "Facial contouring",
    consultationLabel: "Facial contour assessment",
    description: "Approaches a clinician may discuss for facial definition and contour.",
  },
  FACIAL_LIFTING: {
    category: "FACIAL_LIFTING",
    label: "Facial lifting",
    consultationLabel: "Facial lifting consultation",
    description: "Approaches (e.g. thread-based) a clinician may discuss for facial lifting.",
  },
  SKIN_TREATMENT: {
    category: "SKIN_TREATMENT",
    label: "Skin treatment",
    consultationLabel: "Skin assessment",
    description: "Clinic skin treatments a clinician may discuss for skin-appearance concerns.",
  },
  HAIR_SCALP_ASSESSMENT: {
    category: "HAIR_SCALP_ASSESSMENT",
    label: "Hair and scalp assessment",
    consultationLabel: "Hair and scalp assessment",
    description: "A clinician-led review of hair and scalp concerns.",
  },
  CLINIC_CONSULTATION: {
    category: "CLINIC_CONSULTATION",
    label: "General clinic consultation",
    consultationLabel: "Clinic consultation",
    description: "A general consultation to discuss goals with a clinician.",
  },
};
