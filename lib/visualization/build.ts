/**
 * Builds a VisualizationPlan from the existing treatment opportunities.
 *
 * An illustration is planned only when ALL hold (Phase 7):
 *   1. a front photo exists,
 *   2. it passed quality validation,
 *   3. at least one CONSUMER-READY visualization opportunity exists,
 *   4. that opportunity maps to an approved change and rests on visual evidence.
 * Otherwise the plan is "not_eligible" and no image may be generated.
 */

import type { EvidenceRef } from "../interpretation/types.ts";
import type { TreatmentCategory, TreatmentOpportunity } from "../treatment-opportunities/types.ts";
import type { ExcludedChange, IneligibleReason, VisualizationChange, VisualizationCategory, VisualizationPlan } from "./types.ts";
import { PRESERVATION_RULES, VISUALIZATION_DISCLAIMER } from "./types.ts";
import { VISUALIZATION_PLAN_VERSION } from "./versions.ts";

export interface FrontPhotoRef {
  /** Opaque reference to the photo (a blob URL in the local architecture). */
  ref: string;
  /** True only if the photo passed quality validation. */
  qualityValid: boolean;
}

export interface PlanInput {
  frontPhoto: FrontPhotoRef | null;
  opportunities: TreatmentOpportunity[];
}

const APPROVED: Partial<Record<TreatmentCategory, { category: VisualizationCategory; description: string }>> = {
  FACIAL_CONTOURING: { category: "facial_contour", description: "Subtle visual emphasis of facial contour and definition" },
  NEUROMODULATOR: {
    category: "expression_lines",
    description: "Subtle reduction in the visible appearance of expression-related forehead lines",
  },
};

const EXCLUDED_REASON: Partial<Record<TreatmentCategory, { category: string; reason: string }>> = {
  DERMAL_FILLER: { category: "facial_fullness", reason: "Illustrating facial fullness could imply a volume finding that this assessment does not establish." },
  FACIAL_LIFTING: { category: "facial_lifting", reason: "Lifting-related changes are not evaluated by this assessment, so they are not illustrated." },
  SKIN_TREATMENT: { category: "skin_appearance", reason: "Skin concerns come from your responses only; there is no visual skin evidence to base an illustration on." },
  HAIR_SCALP_ASSESSMENT: { category: "hair_and_scalp", reason: "Hair and scalp are not illustrated." },
  CLINIC_CONSULTATION: { category: "general_consultation", reason: "A general consultation has nothing to illustrate." },
};

function notEligible(reason: IneligibleReason, sourcePhoto: VisualizationPlan["sourcePhoto"], excluded: ExcludedChange[]): VisualizationPlan {
  return {
    version: VISUALIZATION_PLAN_VERSION,
    status: "not_eligible",
    sourcePhoto,
    changes: [],
    excludedChanges: excluded,
    disclaimer: VISUALIZATION_DISCLAIMER,
    preserve: PRESERVATION_RULES,
    ineligibleReason: reason,
    evidence: [],
  };
}

export function buildVisualizationPlan(input: PlanInput): VisualizationPlan {
  const excluded: ExcludedChange[] = [];
  const noteExcluded = (category: string, reason: string) => {
    if (!excluded.some((e) => e.category === category)) excluded.push({ category, reason });
  };

  const potential = input.opportunities.filter((o) => o.status === "potential_opportunity" && o.category !== null);
  const changes = new Map<VisualizationCategory, VisualizationChange>();
  const evidence: EvidenceRef[] = [];

  for (const opp of potential) {
    const approved = APPROVED[opp.category as TreatmentCategory];
    if (!approved) {
      const ex = EXCLUDED_REASON[opp.category as TreatmentCategory];
      if (ex) noteExcluded(ex.category, ex.reason);
      continue;
    }
    if (!opp.consumerReady) {
      noteExcluded(approved.category, "The visual evidence for this area is not yet at a standard that allows it to be illustrated.");
      continue;
    }
    if (opp.evidenceObservationIds.length === 0) {
      noteExcluded(approved.category, "There is no visual evidence for this area to base an illustration on.");
      continue;
    }
    const ids = [opp.id, ...opp.evidenceObservationIds, ...opp.evidenceQuestionIds];
    const existing = changes.get(approved.category);
    changes.set(approved.category, {
      category: approved.category,
      description: approved.description,
      intensity: "subtle",
      evidenceIds: [...new Set([...(existing?.evidenceIds ?? []), ...ids])],
    });
    evidence.push({ sourceType: "treatment_opportunity", sourceId: opp.id });
    for (const id of opp.evidenceObservationIds) evidence.push({ sourceType: "visual_observation", sourceId: id });
    for (const id of opp.evidenceQuestionIds) evidence.push({ sourceType: "questionnaire", sourceId: id });
  }

  const sourcePhoto = input.frontPhoto ? ({ slot: "front", ref: input.frontPhoto.ref } as const) : null;
  if (!input.frontPhoto) return notEligible("no_front_photo", null, excluded);
  if (!input.frontPhoto.qualityValid) return notEligible("front_photo_quality", sourcePhoto, excluded);
  if (changes.size === 0) return notEligible("no_supported_change", sourcePhoto, excluded);

  return {
    version: VISUALIZATION_PLAN_VERSION,
    status: "planned",
    sourcePhoto,
    changes: [...changes.values()],
    excludedChanges: excluded,
    disclaimer: VISUALIZATION_DISCLAIMER,
    preserve: PRESERVATION_RULES,
    ineligibleReason: null,
    evidence: [...new Map(evidence.map((e) => [`${e.sourceType}:${e.sourceId}`, e])).values()],
  };
}
