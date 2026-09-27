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
import { findUnsafeVisualText } from "./safety.ts";
import type { ExcludedChange, IneligibleReason, VisualizationChange, VisualizationCategory, VisualizationPlan } from "./types.ts";
import { APPROVED_VISUAL_CHANGES, PRESERVATION_RULES, VISUALIZATION_DISCLAIMER } from "./types.ts";
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

const APPROVED: Partial<Record<TreatmentCategory, { category: VisualizationCategory }>> = {
  FACIAL_CONTOURING: { category: "facial_contour" },
  NEUROMODULATOR: { category: "expression_lines" },
};

const EXCLUDED_REASON: Partial<Record<TreatmentCategory, { category: string; reason: string }>> = {
  DERMAL_FILLER: { category: "facial_fullness", reason: "Illustrating facial fullness could imply a volume finding that this assessment does not establish." },
  FACIAL_LIFTING: { category: "facial_lifting", reason: "Lifting-related changes are not evaluated by this assessment, so they are not illustrated." },
  SKIN_TREATMENT: { category: "skin_appearance", reason: "Skin concerns come from your responses only; there is no visual skin evidence to base an illustration on." },
  HAIR_SCALP_ASSESSMENT: { category: "hair_and_scalp", reason: "Hair and scalp are not illustrated." },
  CLINIC_CONSULTATION: { category: "general_consultation", reason: "A general consultation has nothing to illustrate." },
};

/**
 * Builds/merges the VisualizationChange for one category from one
 * opportunity's evidence, using the fixed APPROVED_VISUAL_CHANGES template.
 * Exported so the development-only composite fixture
 * (lib/image-generation/devIllustrationFixture.ts) can build a plausible
 * multi-area VisualizationChange[] from its own synthetic opportunities using
 * the exact same construction as a real plan — never new wording, a new
 * evidence shape, or new fields.
 */
export function buildChangeFromOpportunity(category: VisualizationCategory, opp: TreatmentOpportunity, existing?: VisualizationChange): VisualizationChange {
  const fixed = APPROVED_VISUAL_CHANGES[category];
  const ids = [opp.id, ...opp.evidenceObservationIds, ...opp.evidenceQuestionIds];
  const refs: EvidenceRef[] = [
    { sourceType: "treatment_opportunity", sourceId: opp.id },
    ...opp.evidenceObservationIds.map((id) => ({ sourceType: "visual_observation" as const, sourceId: id })),
    ...opp.evidenceQuestionIds.map((id) => ({ sourceType: "questionnaire" as const, sourceId: id })),
  ];
  return {
    changeId: `change.${category}`,
    category,
    targetRegion: fixed.targetRegion,
    description: fixed.description,
    visualInstruction: fixed.visualInstruction,
    intensity: "subtle",
    intensityLimit: "subtle",
    evidenceIds: [...new Set([...(existing?.evidenceIds ?? []), ...ids])],
    evidenceRefs: [...new Map([...(existing?.evidenceRefs ?? []), ...refs].map((r) => [`${r.sourceType}:${r.sourceId}`, r])).values()],
    sourceOpportunityId: existing?.sourceOpportunityId ?? opp.id,
    consumerReady: true,
    safetyStatus: "approved",
  };
}

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
    const fixed = APPROVED_VISUAL_CHANGES[approved.category];
    if (findUnsafeVisualText(fixed.visualInstruction).length > 0) {
      noteExcluded(approved.category, "The rendering instruction for this area did not pass the safety check.");
      continue;
    }
    const existing = changes.get(approved.category);
    changes.set(approved.category, buildChangeFromOpportunity(approved.category, opp, existing));
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
