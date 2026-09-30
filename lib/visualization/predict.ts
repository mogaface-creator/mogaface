/**
 * The MogaFace Prediction Engine — the goal-driven illustrative-visualization
 * pathway that sits ALONGSIDE, and never replaces, the calibration-gated
 * treatment-opportunity pathway (lib/treatment-opportunities/, this
 * directory's build.ts + eligibility.ts).
 *
 * WHY THIS EXISTS: the treatment-opportunity pathway requires
 * CALIBRATION_STATE[category] === true (facial-analysis/calibration/status.ts)
 * before ANY visual-evidence-cited opportunity can be illustrated — and today
 * every category is false (see docs/VISUAL_CALIBRATION.md): no real-data
 * engineering calibration has been performed. That gate protects a specific,
 * narrow claim — "this pixel measurement is trustworthy enough to cite as
 * evidence for a clinical-adjacent treatment opportunity" — and it stays
 * exactly as strict as it always was; this module never touches it, never
 * sets CALIBRATION_STATE, and never changes a threshold.
 *
 * This module answers a DIFFERENT, honestly-scoped question instead: "given
 * what the user told us they want (self-reported — always real input,
 * never gated by CV calibration) and the actual photo/video we have of them
 * (real visual context, whether or not any specific pixel measurement on it
 * has been calibrated), what is the most conservative, plausible
 * illustrative change we can honestly show?" It never claims a
 * computer-vision measurement is clinically validated — every generated
 * illustration still carries the same fixed VISUALIZATION_DISCLAIMER and
 * ILLUSTRATIVE_AFTER notice as the calibrated pathway.
 *
 * Reuses, unchanged: APPROVED_VISUAL_CHANGES' fixed, safety-checked wording,
 * PRESERVATION_RULES, VISUALIZATION_DISCLAIMER, buildChangeFromOpportunity
 * (build.ts), the questionnaire→signal mapping and evidence lookups
 * (treatment-opportunities/evidence.ts), and createOpportunity's id/evidence
 * derivation (treatment-opportunities/types.ts). The only new decision this
 * module makes is WHICH categories a self-reported goal may unlock, and what
 * counts as sufficient real-world grounding for each — never inventing new
 * wording, new categories, or new evidence sources.
 */

import type { AppearanceConcernId } from "../assessment/appearanceConcerns.ts";
import type { Assessment } from "../assessment/types.ts";
import type { MogaFaceAnalysis, Observation } from "../observation/types.ts";
import {
  buildConcernSignals,
  deriveConfidence,
  findStructureEvidence,
  findVideoEvidence,
  isContourEvidenceId,
  signalEvidence,
  signalsOfKind,
  videoObservationsFrom,
} from "../treatment-opportunities/evidence.ts";
import { createOpportunity } from "../treatment-opportunities/types.ts";
import type { ConcernSignal, ConcernSignalKind, EvidenceItem, TreatmentCategory, TreatmentConcern, TreatmentOpportunity, VideoObservation } from "../treatment-opportunities/types.ts";
import { buildPredictionFocus } from "./focus.ts";
import type { PredictionFocus } from "./focus.ts";
import { buildChangeFromOpportunity } from "./build.ts";
import type { FrontPhotoRef } from "./build.ts";
import { PRESERVATION_RULES, VISUALIZATION_DISCLAIMER } from "./types.ts";
import type { ExcludedChange, VisualizationCategory, VisualizationChange, VisualizationPlan } from "./types.ts";
import { VISUALIZATION_PLAN_VERSION } from "./versions.ts";

/**
 * Which categories the GOAL-DRIVEN pathway may ever populate — a separate
 * product-policy surface from ILLUSTRATION_POLICY (eligibility.ts), which
 * governs the calibration-gated pathway only. Change a value here only after
 * an explicit product/evidence-policy decision for THIS pathway — same
 * discipline as ILLUSTRATION_POLICY, a different, independent decision.
 * `jawline_definition` stays false: no appearance concern maps to it
 * distinctly from facial_contour, and no evidence path for it exists (see
 * APPROVED_VISUAL_CHANGES' own comment in types.ts).
 */
export const PREDICTION_CATEGORY_POLICY: Record<VisualizationCategory, boolean> = {
  expression_lines: true,
  facial_contour: true,
  jawline_definition: false,
  under_eye: true,
  skin_appearance: true,
  hair_appearance: true,
};

/**
 * Fixed, always-the-same list of changes the image model must never make,
 * regardless of category or user. The image prompt does not paste this list:
 * some phrases here are rejected by the prompt safety scan. The prompt uses
 * the approved instruction plus the photo-specific focus instead
 * (lib/visualization/focus.ts, lib/image-generation/predictionPrompt.ts). Distinct from
 * PRESERVATION_RULES (what must stay THE SAME): this is what must never be
 * DONE, phrased as explicit prohibitions rather than things to preserve.
 */
export const PROHIBITED_CHANGES: readonly string[] = [
  "generic beautification or attractiveness optimisation",
  "changing the person's ethnicity",
  "changing the person's apparent age",
  "changing eye shape, size or position",
  "changing nose shape or size",
  "changing lip shape or size",
  "changing facial proportions unrelated to the approved change",
  "extreme face slimming",
  "an exaggerated or reshaped jawline",
  "plastic-looking or over-smoothed skin",
  "completely removing natural skin texture",
  "changing hairstyle, unless hair is explicitly the approved change",
  "changing facial hair, unless explicitly the approved change",
  "changing clothing",
  "changing the background",
  "changing the camera angle, pose or framing",
  "creating what looks like a different person",
  "diagnosing hair loss or naming a medical cause for it",
  "claiming hair regrowth or any treatment outcome",
  "claiming suitability or candidacy for a hair treatment",
  "an unrealistic, perfectly even, or implausible hairline",
  "extreme or maximal hair density",
  "a completely different hairstyle, even when hair coverage is the approved change",
];

/** Fixed sentence describing the cross-angle invariant — reused verbatim, never computed per-request. */
export const CROSS_ANGLE_CONSISTENCY =
  "The same approved plan, unchanged, is applied identically to every angle (front, left 45°, right 45°) of this same person — no angle may introduce a different change, a different intensity, or a different instruction.";

/** Fixed purpose statement — reused verbatim, never computed per-request. */
export const PREDICTION_PURPOSE =
  "A personalized, conservative illustrative visualization of how this specific person's selected concern(s) could plausibly look addressed — based on their own stated goals and the visual information actually available for them. Not a prediction, guarantee, or clinical claim.";

/**
 * A VisualizationPlan produced by the goal-driven pathway. Reuses
 * VisualizationPlan's entire shape (status, changes, preserve, disclaimer,
 * sourcePhoto, excludedChanges, evidence) unchanged — every consumer of a
 * VisualizationPlan (validateVisualizationPlan, generateVisualization,
 * buildIllustrationPrompt) already works on a PredictionPlan with no
 * changes. Only genuinely new fields are added.
 */
export interface PredictionPlan extends VisualizationPlan {
  /** The user's own selected appearance concerns (self-reported), whether or not each could actually be illustrated — see excludedChanges for why not. */
  goals: AppearanceConcernId[];
  prohibited: readonly string[];
  purpose: string;
  consistency: string;
  /**
   * Places on this person's photo the approved changes apply to. Empty when
   * they named an area but not a place within it — the prompt then uses a
   * category default (lib/visualization/focus.ts).
   */
  focus: PredictionFocus[];
}

interface CategoryCandidate {
  category: VisualizationCategory;
  concern: TreatmentConcern;
  treatmentCategory: TreatmentCategory;
  signalKinds: readonly ConcernSignalKind[];
  /**
   * Real, available evidence for this category beyond the self-report
   * itself. May legitimately return [] (see requireObservationEvidence).
   */
  findObserved(observations: Observation<unknown>[], videoObservations: VideoObservation[]): EvidenceItem[];
  /**
   * Whether an actual detected/measured signal (even if UNCALIBRATED) is
   * required in addition to the self-report before this category may be
   * illustrated. False only for skin_appearance, where no computer-vision
   * method exists at all (see treatment-opportunities/evidence.ts's
   * SKIN_VISUAL_OBSERVATION_IDS comment) — there, the front photo itself,
   * which the image model actually edits, is the visual grounding.
   */
  requireObservationEvidence: boolean;
}

const CATEGORY_CANDIDATES: readonly CategoryCandidate[] = [
  {
    category: "expression_lines",
    concern: "dynamic_facial_lines",
    treatmentCategory: "NEUROMODULATOR",
    signalKinds: ["expression_lines"],
    findObserved: (_observations, videoObservations) => findVideoEvidence(videoObservations, "expression_lines"),
    requireObservationEvidence: true,
  },
  {
    category: "facial_contour",
    concern: "facial_contour_volume",
    treatmentCategory: "FACIAL_CONTOURING",
    signalKinds: ["facial_definition", "facial_contour"],
    findObserved: (observations) => findStructureEvidence(observations, isContourEvidenceId),
    requireObservationEvidence: true,
  },
  {
    category: "under_eye",
    concern: "under_eye_appearance",
    treatmentCategory: "DERMAL_FILLER",
    signalKinds: ["under_eye"],
    findObserved: (observations) =>
      observations.filter((o) => o.id === "eyeArea.visibleUnderEyeDarkness" && o.value === true).map((o) => ({ kind: "observation" as const, id: o.id, label: o.label, source: o.source })),
    requireObservationEvidence: true,
  },
  {
    category: "skin_appearance",
    concern: "skin_appearance",
    treatmentCategory: "SKIN_TREATMENT",
    signalKinds: ["skin_concern"],
    findObserved: () => [],
    requireObservationEvidence: false,
  },
  // Grounded the same way as skin_appearance: no computer-vision hair/scalp measurement exists
  // (see HairAnalysis.inferences, always empty), so the real front photo itself — which visibly
  // shows hair coverage, unlike e.g. under-eye darkness which needs a pixel ratio to even
  // describe — is the grounding, alongside the person's own reported hair/scalp concern.
  {
    category: "hair_appearance",
    concern: "hair_appearance",
    treatmentCategory: "HAIR_SCALP_ASSESSMENT",
    signalKinds: ["hair_appearance"],
    findObserved: () => [],
    requireObservationEvidence: false,
  },
];

const BASE_LIMITATIONS = [
  "This illustration is based on your submitted images and questionnaire answers only.",
  "It is an illustrative hypothetical, not a prediction or guarantee of any outcome.",
  "A clinician must assess anatomy, medical history and treatment suitability before any real treatment.",
];

/**
 * Builds ONE synthetic, goal-driven "opportunity" per qualifying category —
 * shaped exactly like a real TreatmentOpportunity (reusing createOpportunity
 * for id/evidence-id derivation) so buildChangeFromOpportunity (build.ts) can
 * be reused unchanged. `consumerReady` is deliberately overridden to `true`
 * here: unlike a real rule's opportunity, this one's "ready" decision was
 * already made by THIS function's own (documented, evidence-tiered) gating —
 * it is not, and must never be read as, a claim that the underlying
 * observation is CALIBRATION_STATE-calibrated. The id is prefixed
 * "prediction:" so it is never mistaken for a real treatment-opportunity id
 * in logs, evidence refs, or a future state where both pathways are active.
 */
function buildCandidateOpportunity(candidate: CategoryCandidate, signals: ConcernSignal[], observed: EvidenceItem[]): TreatmentOpportunity {
  const evidence = [...signalEvidence(signals), ...observed];
  const opp = createOpportunity({
    concern: candidate.concern,
    category: candidate.treatmentCategory,
    title: "Illustrative visualization",
    rationale: "Based on your selected goal and the visual information available, an illustrative visualization of this area is available for consultation.",
    evidence,
    status: "potential_opportunity",
    confidence: deriveConfidence(signals, evidence),
    limitations: BASE_LIMITATIONS,
  });
  return { ...opp, id: `prediction:${opp.id}`, consumerReady: true };
}

function notEligible(reason: VisualizationPlan["ineligibleReason"], sourcePhoto: VisualizationPlan["sourcePhoto"], excluded: ExcludedChange[], goals: AppearanceConcernId[]): PredictionPlan {
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
    goals,
    prohibited: PROHIBITED_CHANGES,
    purpose: PREDICTION_PURPOSE,
    consistency: CROSS_ANGLE_CONSISTENCY,
    focus: [],
  };
}

export interface PredictionPlanInput {
  assessment: Assessment;
  analysis: MogaFaceAnalysis;
  frontPhoto: FrontPhotoRef | null;
}

/**
 * Deterministic from its input: the same assessment + analysis always
 * produces the same PredictionPlan (createOpportunity's own createdAt/id
 * derivation aside, nothing here is random or time-varying in a way that
 * changes WHAT is planned). Called once, server-side, when the trusted
 * analysis-session record is created (lib/analysis-session/store.ts); the
 * SAME resulting object is then reused, unchanged, for every angle.
 */
export function buildPredictionPlan(input: PredictionPlanInput): PredictionPlan {
  const { assessment, analysis, frontPhoto } = input;
  const goals = [...assessment.appearanceConcerns.selected];
  const signals = buildConcernSignals(assessment);
  const videoObservations = videoObservationsFrom(analysis.observations);

  const excluded: ExcludedChange[] = [];
  const noteExcluded = (category: string, reason: string) => {
    if (!excluded.some((e) => e.category === category)) excluded.push({ category, reason });
  };

  const changes: VisualizationChange[] = [];
  const evidenceRefsSeen = new Set<string>();
  const evidence: VisualizationPlan["evidence"] = [];

  for (const candidate of CATEGORY_CANDIDATES) {
    if (!PREDICTION_CATEGORY_POLICY[candidate.category]) continue;
    const matchingSignals = signalsOfKind(signals, candidate.signalKinds);
    if (matchingSignals.length === 0) continue; // no goal for this area at all — never illustrated unprompted

    const observed = candidate.findObserved(analysis.observations, videoObservations);
    if (candidate.requireObservationEvidence && observed.length === 0) {
      noteExcluded(candidate.category, "There is no visual information available yet to base an illustration of this area on.");
      continue;
    }

    const opp = buildCandidateOpportunity(candidate, matchingSignals, observed);
    const change = buildChangeFromOpportunity(candidate.category, opp);
    changes.push(change);
    for (const ref of change.evidenceRefs) {
      const key = `${ref.sourceType}:${ref.sourceId}`;
      if (!evidenceRefsSeen.has(key)) {
        evidenceRefsSeen.add(key);
        evidence.push(ref);
      }
    }
  }

  const sourcePhoto = frontPhoto ? ({ slot: "front", ref: frontPhoto.ref } as const) : null;
  if (!frontPhoto) return notEligible("no_front_photo", null, excluded, goals);
  if (!frontPhoto.qualityValid) return notEligible("front_photo_quality", sourcePhoto, excluded, goals);
  if (changes.length === 0) return notEligible("no_supported_change", sourcePhoto, excluded, goals);

  return {
    version: VISUALIZATION_PLAN_VERSION,
    status: "planned",
    sourcePhoto,
    changes,
    excludedChanges: excluded,
    disclaimer: VISUALIZATION_DISCLAIMER,
    preserve: PRESERVATION_RULES,
    ineligibleReason: null,
    evidence,
    goals,
    prohibited: PROHIBITED_CHANGES,
    purpose: PREDICTION_PURPOSE,
    consistency: CROSS_ANGLE_CONSISTENCY,
    focus: buildPredictionFocus(assessment, changes.map((change) => change.category)),
  };
}
