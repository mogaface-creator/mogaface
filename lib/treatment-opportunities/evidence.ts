/**
 * Evidence gathering for the treatment-opportunity engine: questionnaire →
 * normalized concern signals, observation lookup, confidence derivation,
 * and the "why was this created?" explanation.
 *
 * Nothing here invents evidence. If an observation or answer does not exist,
 * the lookups return nothing and the rules fall back to
 * "insufficient_evidence" / no opportunity.
 */

import { normalizeAppearanceConcerns } from "../assessment/appearanceConcerns.ts";
import type { AppearanceConcernDetailId, AppearanceConcernId } from "../assessment/appearanceConcerns.ts";
import type { Assessment, GoalArea, GoalPriority } from "../assessment/types.ts";
import type { Observation } from "../observation/types.ts";
import { EXPRESSION_MOVEMENT_OBSERVATION_IDS, LINE_PATTERN_OBSERVATION_IDS } from "../observation/videoDomains.ts";
import type {
  ConcernSignal,
  ConcernSignalKind,
  EvidenceItem,
  OpportunityConfidence,
  TreatmentCategory,
  TreatmentConcern,
  TreatmentOpportunity,
  VideoObservation,
} from "./types.ts";

// ---------------------------------------------------------------------------
// Observation id registries
// ---------------------------------------------------------------------------

/**
 * Measured facial-structure observations a contour/volume assessment may
 * reference. These are relative-geometry measurements from lib/observation/
 * — they show that structure was measured, not that any deficiency exists.
 */
export const FACIAL_STRUCTURE_OBSERVATION_IDS: readonly string[] = [
  "facialStructure.faceWidthHeightRatio",
  "facialStructure.jawWidth",
  "facialStructure.lowerFaceHeight",
  "facialStructure.thirdsMiddle",
  "facialStructure.thirdsLower",
  "facialStructure.symmetry.Lower-face symmetry",
];

/** Contour geometry from lib/observation/photoDomains.ts: relative outline angles/ratios, per photo view. */
export const CONTOUR_OBSERVATION_PREFIX = "facialStructure.contour.";
/** The cheek-outline angles — the only evidence the volume branch of Rule B accepts (see rules.ts). */
export const CHEEK_CONTOUR_OBSERVATION_PREFIX = "facialStructure.contour.cheekContourAngle.";

/** Everything Rule B's contour branch may cite: the front-view structure measurements plus contour geometry. */
export const isContourEvidenceId = (id: string) => FACIAL_STRUCTURE_OBSERVATION_IDS.includes(id) || id.startsWith(CONTOUR_OBSERVATION_PREFIX);
/**
 * If the left and right 45° views report the same outline angle more than
 * this many degrees apart, the contour evidence is contradictory. An
 * UNCALIBRATED conservative guard, not a tuned value — see
 * docs/VISUAL_CALIBRATION.md. (Front-vs-45° angles are not compared: a
 * turned view is foreshortened by design, so they are not expected to agree.)
 */
export const CONTOUR_VIEW_DISAGREEMENT_DEG = 20;

export function contourViewsDisagree(observations: Observation<unknown>[]): boolean {
  const valueOf = (metric: string, slot: string) => {
    const o = observations.find((x) => x.id.startsWith(`${CONTOUR_OBSERVATION_PREFIX}${metric}.${slot}.`));
    return typeof o?.value === "number" && Number.isFinite(o.value) ? o.value : null;
  };
  return ["cheekContourAngle", "jawContourAngle"].some((metric) => {
    const [l, r] = [valueOf(metric, "leftFortyFive"), valueOf(metric, "rightFortyFive")];
    return l !== null && r !== null && Math.abs(l - r) > CONTOUR_VIEW_DISAGREEMENT_DEG;
  });
}

export const isCheekContourId = (id: string) => id.startsWith(CHEEK_CONTOUR_OBSERVATION_PREFIX);

/**
 * "Visible line pattern" observations produced by the video expression
 * domain (lib/observation/videoDomains.ts): value `true` only when a
 * region's line contrast was higher in expression frames than in neutral
 * frames of the same video. Emitted only when a video was analyzed.
 */
export const EXPRESSION_LINE_OBSERVATION_IDS: readonly string[] = LINE_PATTERN_OBSERVATION_IDS;

/**
 * RESERVED id. Deliberately unproduced: no clinically defensible lifting or
 * laxity observation method exists, and generic jaw geometry is NOT treated
 * as evidence of it (see docs/VISUAL_OBSERVATION_LAYER.md). Rule C therefore
 * stays "insufficient_evidence" until a validated layer emits these.
 */
export const LIFTING_OBSERVATION_IDS: readonly string[] = [
  "facialStructure.visual.lowerFacePosition",
  "facialStructure.visual.jawlinePosition",
];

/**
 * RESERVED ids. No layer emits these: skin analysis is not implemented (see
 * ANALYSIS_LIMITATIONS), so skin concerns stay user-reported. Contract for a
 * future validated layer: type "measured" or "inferred" (never
 * "user_reported"), value `true`.
 */
export const SKIN_VISUAL_OBSERVATION_IDS: readonly string[] = [
  "skin.visual.unevenTexture",
  "skin.visual.unevenTone",
  "skin.visual.blemishAppearance",
  "skin.visual.pigmentationAppearance",
  "skin.visual.fineLines",
  "skin.visual.rednessAppearance",
];

// ---------------------------------------------------------------------------
// Questionnaire → concern signals
// ---------------------------------------------------------------------------

interface SignalMapping {
  kind: ConcernSignalKind;
  strength: "explicit" | "general";
  label: string;
}

/**
 * The original broad goals (goals.areas / goals.priorities). Only answers the
 * questionnaire actually collects are mapped; never infer a signal from an
 * unrelated answer. Specific concerns come from appearanceConcerns below.
 */
const PRIORITY_SIGNALS: Partial<Record<GoalPriority, SignalMapping>> = {
  lookMoreDefined: { kind: "facial_definition", strength: "general", label: "Goal: look more defined" },
  improveSkin: { kind: "skin_concern", strength: "explicit", label: "Goal: improve skin" },
};

const AREA_SIGNALS: Partial<Record<GoalArea, SignalMapping>> = {
  skin: { kind: "skin_concern", strength: "general", label: "Area of interest: skin" },
  jawDefinition: { kind: "facial_contour", strength: "explicit", label: "Area of interest: jaw definition" },
};

/**
 * appearanceConcerns → engine signal kinds. Every mapped answer is EXPLICIT
 * (the user named the concern), but a signal is only evidence of what the
 * user said — rules still need supporting observations before suggesting a
 * category. FACIAL_BALANCE, OVERALL_APPEARANCE and NOT_SURE (uncertainty,
 * not a concern) map to nothing; UNDER_EYE maps to a kind no rule consumes
 * yet, so it is recorded but produces no opportunity.
 */
const APPEARANCE_CONCERN_KINDS: Partial<Record<AppearanceConcernId, ConcernSignalKind>> = {
  FACIAL_LINES: "expression_lines",
  FACIAL_DEFINITION: "facial_definition",
  FACIAL_VOLUME: "facial_volume",
  FACIAL_LIFTING: "facial_lifting",
  UNDER_EYE: "under_eye",
  SKIN_TEXTURE: "skin_concern",
  SKIN_TONE: "skin_concern",
  PIGMENTATION: "skin_concern",
  BLEMISHES: "skin_concern",
};

/** Details that map to a different kind than their parent. Other details inherit the parent's kind. */
const APPEARANCE_DETAIL_KINDS: Partial<Record<AppearanceConcernDetailId, ConcernSignalKind>> = {
  JAW_DEFINITION: "facial_contour",
  CHEEK_DEFINITION: "facial_contour",
  LOWER_FACE_DEFINITION: "facial_contour",
  OVERALL_CONTOUR: "facial_contour",
};

/** Never reads age or gender presentation — treatment signals are goal-driven only. */
export function buildConcernSignals(assessment: Assessment | null | undefined): ConcernSignal[] {
  const byKind = new Map<ConcernSignalKind, ConcernSignal>();

  const add = (mapping: SignalMapping | undefined, questionId: string) => {
    if (!mapping) return;
    const item: EvidenceItem = { kind: "questionnaire", id: questionId, label: mapping.label, source: "user" };
    const existing = byKind.get(mapping.kind);
    if (!existing) {
      byKind.set(mapping.kind, { kind: mapping.kind, strength: mapping.strength, evidence: [item] });
      return;
    }
    if (mapping.strength === "explicit") existing.strength = "explicit";
    existing.evidence.push(item);
  };

  const priorities = Array.isArray(assessment?.goals?.priorities) ? assessment.goals.priorities : [];
  const areas = Array.isArray(assessment?.goals?.areas) ? assessment.goals.areas : [];
  for (const p of new Set(priorities)) add(PRIORITY_SIGNALS[p], `goals.priorities.${p}`);
  for (const a of new Set(areas)) add(AREA_SIGNALS[a], `goals.areas.${a}`);

  // normalizeAppearanceConcerns returns [] for missing or malformed data.
  for (const s of normalizeAppearanceConcerns(assessment?.appearanceConcerns)) {
    if (s.detail?.endsWith("_NOT_SURE")) continue;
    const kind = (s.detail && APPEARANCE_DETAIL_KINDS[s.detail]) || APPEARANCE_CONCERN_KINDS[s.concern];
    add(kind && { kind, strength: "explicit", label: `Concern: ${s.label}` }, s.questionId);
  }

  return [...byKind.values()];
}

export function signalsOfKind(signals: ConcernSignal[], kinds: readonly ConcernSignalKind[]): ConcernSignal[] {
  return signals.filter((s) => kinds.includes(s.kind));
}

export function signalEvidence(signals: ConcernSignal[]): EvidenceItem[] {
  return signals.flatMap((s) => s.evidence);
}

// ---------------------------------------------------------------------------
// Observation / video lookup
// ---------------------------------------------------------------------------

function toEvidence(o: Observation<unknown>): EvidenceItem {
  return { kind: "observation", id: o.id, label: o.label, source: o.source };
}

/** Measured, finite facial-structure observations whose id is in `ids` (or satisfies the predicate). */
export function findStructureEvidence(observations: Observation<unknown>[], ids: readonly string[] | ((id: string) => boolean)): EvidenceItem[] {
  const matches = typeof ids === "function" ? ids : (id: string) => ids.includes(id);
  return observations
    .filter(
      (o) =>
        o.domain === "facial-structure" &&
        o.type === "measured" &&
        typeof o.value === "number" &&
        Number.isFinite(o.value) &&
        matches(o.id),
    )
    .map(toEvidence);
}

/**
 * Visual-feature observations (never user-reported) reporting a reserved
 * feature as visible. Returns nothing today — see the reserved-id note.
 */
export function findVisualFeatureEvidence(observations: Observation<unknown>[], ids: readonly string[]): EvidenceItem[] {
  return observations.filter((o) => o.type !== "user_reported" && o.value === true && ids.includes(o.id)).map(toEvidence);
}

/**
 * Video evidence derived from the observation layer: a measured, positive
 * expression-movement observation counts as video evidence that the
 * expression-line concern's movement is observable. Only movement that met
 * its threshold is ever emitted, so presence here already means "observed".
 */
export function videoObservationsFrom(observations: Observation<unknown>[]): VideoObservation[] {
  return observations
    .filter((o) => o.type === "measured" && EXPRESSION_MOVEMENT_OBSERVATION_IDS.includes(o.id) && typeof o.value === "number" && o.value > 0)
    .map((o) => ({ id: o.id, label: o.label, supports: "expression_lines" as const }));
}

export function findVideoEvidence(videos: VideoObservation[], kind: ConcernSignalKind): EvidenceItem[] {
  return videos
    .filter((v) => v.supports === kind && typeof v.id === "string" && v.id.length > 0)
    .map((v) => ({ kind: "video" as const, id: v.id, label: v.label, source: "video" }));
}

// ---------------------------------------------------------------------------
// Confidence
// ---------------------------------------------------------------------------

/** What each level means. Evidence completeness — NOT a probability of suitability. */
export const CONFIDENCE_MEANING: Record<OpportunityConfidence, string> = {
  high: "An explicit user goal plus at least two relevant observations from at least two independent sources (e.g. two photo views, or a photo and video).",
  moderate: "An explicit user goal plus at least one relevant observation, but not corroborated by an independent source.",
  low: "Weak or indirect evidence: only a general goal, or a user-reported concern with no supporting observation.",
};

export function deriveConfidence(signals: ConcernSignal[], evidence: EvidenceItem[]): OpportunityConfidence {
  const explicit = signals.some((s) => s.strength === "explicit");
  const observed = evidence.filter((e) => e.kind !== "questionnaire");
  // Every frame of one video is the same source — video observations must not corroborate each other.
  const sources = new Set(observed.map((e) => (e.source.startsWith("video") ? "video" : e.source)));
  if (explicit && observed.length >= 2 && sources.size >= 2) return "high";
  if (explicit && observed.length >= 1) return "moderate";
  return "low";
}

// ---------------------------------------------------------------------------
// Traceability
// ---------------------------------------------------------------------------

export interface OpportunityExplanation {
  opportunity: TreatmentCategory | null;
  concern: TreatmentConcern;
  reasons: string[];
}

const REASON_PREFIX: Record<EvidenceItem["kind"], string> = {
  questionnaire: "Reported by user",
  observation: "Relevant facial observation",
  video: "Video evidence",
};

/** Answers "why was this treatment opportunity created?" from the opportunity's own evidence. */
export function explainOpportunity(opportunity: TreatmentOpportunity): OpportunityExplanation {
  const reasons = opportunity.evidence.map((e) => `${REASON_PREFIX[e.kind]}: ${e.label}`);
  if (opportunity.status !== "potential_opportunity") {
    reasons.unshift(opportunity.rationale);
  } else if (opportunity.confidence) {
    reasons.push(`Evidence strength ${opportunity.confidence}: ${CONFIDENCE_MEANING[opportunity.confidence]}`);
  }
  return { opportunity: opportunity.category, concern: opportunity.concern, reasons };
}
