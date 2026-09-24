/**
 * The four initial rules. Each is conservative and explicit:
 *   - it needs a user-reported goal/concern signal (observation alone never
 *     creates an opportunity);
 *   - where the concern must be visible in photos/video and no supporting
 *     observation exists, it says so ("insufficient_evidence" /
 *     "not_available") and suggests no category;
 *   - wording is always "may be worth discussing with your clinician".
 */

import { TREATMENT_CATEGORY_DEFINITIONS } from "./categories.ts";
import {
  EXPRESSION_LINE_OBSERVATION_IDS,
  LIFTING_OBSERVATION_IDS,
  SKIN_VISUAL_OBSERVATION_IDS,
  deriveConfidence,
  CONTOUR_OBSERVATION_PREFIX,
  contourViewsDisagree,
  isCheekContourId,
  isContourEvidenceId,
  findStructureEvidence,
  findVideoEvidence,
  findVisualFeatureEvidence,
  signalEvidence,
  signalsOfKind,
} from "./evidence.ts";
import { createOpportunity } from "./types.ts";
import type {
  ConcernSignal,
  EvaluationContext,
  EvidenceItem,
  OpportunityConfidence,
  TreatmentCategory,
  TreatmentConcern,
  TreatmentOpportunity,
} from "./types.ts";

export interface TreatmentRule {
  id: string;
  concern: TreatmentConcern;
  evaluate(ctx: EvaluationContext): TreatmentOpportunity[];
}

const BASE_LIMITATIONS = [
  "Assessment is based on submitted images and questionnaire answers only.",
  "Suitability cannot be determined from photographs alone.",
  "A clinician must assess anatomy, medical history and treatment suitability.",
];

function potential(
  concern: TreatmentConcern,
  category: TreatmentCategory,
  rationale: string,
  signals: ConcernSignal[],
  observed: EvidenceItem[],
  extraLimitations: string[],
  /** Ceiling for evidence that is only indirectly relevant to the category. */
  maxConfidence?: OpportunityConfidence,
): TreatmentOpportunity {
  const evidence = [...signalEvidence(signals), ...observed];
  const derived = deriveConfidence(signals, evidence);
  const confidence = maxConfidence === "moderate" && derived === "high" ? "moderate" : derived;
  return createOpportunity({
    concern,
    category,
    title: TREATMENT_CATEGORY_DEFINITIONS[category].consultationLabel,
    rationale,
    evidence,
    status: "potential_opportunity",
    confidence,
    limitations: [...BASE_LIMITATIONS, ...extraLimitations],
  });
}

/**
 * The user raised a concern the engine cannot evidence. No category is
 * suggested. "not_available" when no analysis ran at all; otherwise
 * "insufficient_evidence".
 */
function withoutEvidence(
  concern: TreatmentConcern,
  concernTitle: string,
  signals: ConcernSignal[],
  analysisRan: boolean,
  limitation: string,
): TreatmentOpportunity {
  return createOpportunity({
    concern,
    category: null,
    title: `${concernTitle} — no supporting evidence`,
    rationale: analysisRan
      ? "You reported a related goal, but the available analysis has no supporting observation for it, so no treatment category is suggested."
      : "You reported a related goal, but no photo analysis is available yet, so this cannot be assessed and no treatment category is suggested.",
    evidence: signalEvidence(signals),
    status: analysisRan ? "insufficient_evidence" : "not_available",
    confidence: null,
    limitations: [...BASE_LIMITATIONS, limitation],
  });
}

// Rule A — dynamic facial lines → NEUROMODULATOR
const dynamicFacialLines: TreatmentRule = {
  id: "A.dynamic-facial-lines",
  concern: "dynamic_facial_lines",
  evaluate(ctx) {
    const signals = signalsOfKind(ctx.signals, ["expression_lines"]);
    if (signals.length === 0) return [];

    const lines = findVisualFeatureEvidence(ctx.observations, EXPRESSION_LINE_OBSERVATION_IDS);
    const video = findVideoEvidence(ctx.videoObservations, "expression_lines");
    const limitation = "Facial-line observations describe visible appearance only and are not a clinical assessment.";

    if (lines.length === 0) {
      return [
        withoutEvidence("dynamic_facial_lines", "Facial-line appearance", signals, ctx.photoAnalysisAvailable || ctx.videoAnalyzed || video.length > 0, limitation),
      ];
    }
    const media = video.length > 0 ? "images/video show" : "images show";
    return [
      potential(
        "dynamic_facial_lines",
        "NEUROMODULATOR",
        `Your submitted ${media} features associated with facial expression lines. A neuromodulator consultation may be worth discussing with your clinician.`,
        signals,
        [...lines, ...video],
        [limitation],
      ),
    ];
  },
};

// Rule B — facial contour / volume → FACIAL_CONTOURING or DERMAL_FILLER.
// Contour needs measured facial-structure/contour geometry. Volume needs the
// cheek-outline geometry from at least TWO photo views (a single view cannot
// corroborate itself) and its confidence is capped at "moderate": this is
// relative outline geometry, not a volume measurement, so it can support a
// conversation but never strong evidence for one.
const contourVolume: TreatmentRule = {
  id: "B.facial-contour-volume",
  concern: "facial_contour_volume",
  evaluate(ctx) {
    // Contradictory contour measurements across views are not evidence: set them aside (insufficient, not a coin-flip).
    const disputed = contourViewsDisagree(ctx.observations);
    const observations = disputed ? ctx.observations.filter((o) => !o.id.startsWith(CONTOUR_OBSERVATION_PREFIX)) : ctx.observations;
    const cheek = findStructureEvidence(observations, isCheekContourId);
    const cheekViews = new Set(cheek.map((e) => e.source));

    const groups = [
      {
        category: "DERMAL_FILLER" as const,
        signals: signalsOfKind(ctx.signals, ["facial_volume"]),
        observed: cheekViews.size >= 2 ? cheek : [],
        cap: "moderate" as const,
      },
      {
        category: "FACIAL_CONTOURING" as const,
        signals: signalsOfKind(ctx.signals, ["facial_definition", "facial_contour"]),
        observed: findStructureEvidence(observations, isContourEvidenceId),
        cap: undefined,
      },
    ].filter((g) => g.signals.length > 0);

    const limitation =
      "Facial-structure and contour measurements are relative geometry from photographs; they do not indicate volume loss or any deficiency." +
      (disputed ? " Contour measurements from the left and right 45° views disagreed, so they were not used." : "");
    const rationale =
      "Your goals and facial-structure observations suggest that a facial contour/volume assessment may be worth discussing with your clinician.";

    const out = groups
      .filter((g) => g.observed.length > 0)
      .map((g) => potential("facial_contour_volume", g.category, rationale, g.signals, g.observed, [limitation], g.cap));
    const unsupported = groups.filter((g) => g.observed.length === 0).flatMap((g) => g.signals);
    if (unsupported.length > 0) {
      out.push(withoutEvidence("facial_contour_volume", "Facial contour/volume", unsupported, ctx.photoAnalysisAvailable, limitation));
    }
    return out;
  },
};

// Rule C — facial lifting → FACIAL_LIFTING. The user's "lifting" goal is
// only a stated appearance goal; a lifting-relevant visual observation (none
// exist yet) is required, because generic geometry cannot show tissue laxity.
const facialLifting: TreatmentRule = {
  id: "C.facial-lifting",
  concern: "facial_lifting",
  evaluate(ctx) {
    const signals = signalsOfKind(ctx.signals, ["facial_lifting"]);
    if (signals.length === 0) return [];

    const observed = findVisualFeatureEvidence(ctx.observations, LIFTING_OBSERVATION_IDS);
    const limitation = "Photographs cannot measure tissue laxity; no validated laxity analysis exists in this version.";

    if (observed.length === 0) {
      return [withoutEvidence("facial_lifting", "Facial lifting", signals, ctx.photoAnalysisAvailable, limitation)];
    }
    return [
      potential(
        "facial_lifting",
        "FACIAL_LIFTING",
        "Your stated goals and available facial observations may justify discussing facial lifting/contouring options with your clinician.",
        signals,
        observed,
        [limitation],
      ),
    ];
  },
};

// Rule D — skin concerns → SKIN_TREATMENT. A user-reported skin concern is
// itself evidence, so this never returns insufficient_evidence; without a
// supporting observation it is simply low confidence.
const skinConcerns: TreatmentRule = {
  id: "D.skin-concerns",
  concern: "skin_appearance",
  evaluate(ctx) {
    const signals = signalsOfKind(ctx.signals, ["skin_concern"]);
    if (signals.length === 0) return [];

    const visual = findVisualFeatureEvidence(ctx.observations, SKIN_VISUAL_OBSERVATION_IDS);
    const basis = visual.length > 0 ? "images and responses indicate" : "responses indicate";
    return [
      potential(
        "skin_appearance",
        "SKIN_TREATMENT",
        `Your submitted ${basis} skin-related concerns that may be worth assessing with your clinician.`,
        signals,
        visual,
        ["Skin observations describe visible appearance only; no skin condition is identified or diagnosed."],
      ),
    ];
  },
};

export const TREATMENT_RULES: readonly TreatmentRule[] = [dynamicFacialLines, contourVolume, facialLifting, skinConcerns];
