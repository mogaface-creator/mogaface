/**
 * Local, rule-based interpretation. No network, no API key, no randomness:
 * the same InterpretationInput always yields the same statements.
 *
 * Rules (see docs/INTERPRETATION_AND_RESULTS.md):
 *  - A goal area only becomes a "discuss" item when a CONSUMER-READY treatment
 *    opportunity for that area exists AND (where the area needs visual proof)
 *    at least one usable visual observation backs it. Otherwise the goal is
 *    recorded with an honest "not enough evidence" statement.
 *  - Visual observations that rest on uncalibrated thresholds are never
 *    stated to a consumer (see lib/facial-analysis/calibration/status.ts).
 *  - Skin is questionnaire-only: no skin computer vision exists.
 *  - Nothing here names a treatment as needed, suitable, or recommended.
 */

import { normalizeAppearanceConcerns } from "../assessment/appearanceConcerns.ts";
import type { AppearanceConcernId } from "../assessment/appearanceConcerns.ts";
import type { Assessment, GoalArea, GoalPriority } from "../assessment/types.ts";
import { isConsumerReady } from "../facial-analysis/calibration/status.ts";
import type { MogaFaceAnalysis, Observation } from "../observation/types.ts";
import { validateObservation } from "../observation/validate.ts";
import type { TreatmentCategory, TreatmentOpportunity } from "../treatment-opportunities/types.ts";
import type {
  EvidenceEntry,
  EvidenceRef,
  InterpretationArea,
  InterpretationInput,
  InterpretationOpportunity,
  InterpretationPriority,
  InterpretationResult,
  InterpretationSection,
  InterpretationStatement,
  UserGoal,
} from "./types.ts";
import { buildReport } from "./report.ts";
import { INTERPRETATION_VERSION } from "./versions.ts";

// ---------------------------------------------------------------------------
// Input construction
// ---------------------------------------------------------------------------

const CONCERN_AREA: Record<AppearanceConcernId, InterpretationArea | null> = {
  FACIAL_LINES: "facial_lines",
  FACIAL_DEFINITION: "facial_definition",
  FACIAL_BALANCE: "facial_balance",
  FACIAL_VOLUME: "facial_volume",
  FACIAL_LIFTING: "facial_lifting",
  UNDER_EYE: "under_eye",
  SKIN_TEXTURE: "skin",
  SKIN_TONE: "skin",
  PIGMENTATION: "skin",
  BLEMISHES: "skin",
  OVERALL_APPEARANCE: "overall",
  NOT_SURE: null,
};

/** Consumer wording for a priority. Appearance-focused; no treatment names. */
const CONCERN_PRIORITY_LABEL: Record<AppearanceConcernId, string> = {
  FACIAL_LINES: "Expression-related facial lines",
  FACIAL_DEFINITION: "A more defined appearance",
  FACIAL_BALANCE: "Facial balance",
  FACIAL_VOLUME: "Facial fullness",
  FACIAL_LIFTING: "A firmer, more lifted look",
  UNDER_EYE: "Under-eye appearance",
  SKIN_TEXTURE: "Skin texture",
  SKIN_TONE: "Skin tone",
  PIGMENTATION: "Evenness of skin colour",
  BLEMISHES: "Blemish appearance",
  OVERALL_APPEARANCE: "Overall appearance",
  NOT_SURE: "",
};

const LEGACY_PRIORITY: Record<GoalPriority, { area: InterpretationArea | null; label: string }> = {
  lookMoreDefined: { area: "facial_definition", label: "A more defined appearance" },
  improveSkin: { area: "skin", label: "Skin appearance" },
  improveHair: { area: null, label: "Hair" },
  improveFacialFraming: { area: "facial_balance", label: "Facial balance" },
  improveGrooming: { area: null, label: "Grooming" },
  improvePersonalStyle: { area: null, label: "Personal style" },
  lookMorePolished: { area: "overall", label: "A more polished appearance" },
  buildHealthierAppearance: { area: "overall", label: "A healthier-looking appearance" },
  overallGlowUp: { area: "overall", label: "Overall appearance" },
};

const LEGACY_AREA: Partial<Record<GoalArea, { area: InterpretationArea; label: string }>> = {
  jawDefinition: { area: "facial_definition", label: "Jaw and facial definition" },
  skin: { area: "skin", label: "Skin" },
};

/**
 * Builds the ONLY thing a provider may see: normalized goals, validated
 * observations, treatment opportunities, and limitations. Age, gender,
 * height, weight, photos and landmark arrays are deliberately not included.
 */
export function buildInterpretationInput(
  assessment: Assessment,
  analysis: MogaFaceAnalysis | null,
  opportunities: TreatmentOpportunity[],
): InterpretationInput {
  const goals: UserGoal[] = [];

  for (const s of normalizeAppearanceConcerns(assessment.appearanceConcerns)) {
    const area = CONCERN_AREA[s.concern];
    if (area === null) continue; // NOT_SURE records uncertainty, not a goal
    goals.push({
      sourceId: s.signal,
      area,
      label: s.detail === null ? CONCERN_PRIORITY_LABEL[s.concern] : s.label,
      isPriority: s.isPriority,
      isDetail: s.detail !== null,
    });
  }
  for (const p of assessment.goals.priorities) {
    const m = LEGACY_PRIORITY[p];
    if (m) goals.push({ sourceId: `goals.priorities.${p}`, area: m.area, label: m.label, isPriority: true, isDetail: false });
  }
  for (const a of assessment.goals.areas) {
    const m = LEGACY_AREA[a];
    if (m) goals.push({ sourceId: `goals.areas.${a}`, area: m.area, label: m.label, isPriority: false, isDetail: false });
  }

  return {
    assessmentId: assessment.id,
    goals,
    observations: (analysis?.observations ?? []).filter((o) => validateObservation(o).length === 0),
    opportunities,
    limitations: analysis?.limitations ?? [],
    assessmentCreatedAt: assessment.createdAt,
    methodologyVersions: analysis ? { ...analysis.versions } : undefined,
  };
}

// ---------------------------------------------------------------------------
// Consumer wording
// ---------------------------------------------------------------------------

interface AreaCopy {
  title: string;
  category: TreatmentCategory | null;
  /** The area needs at least one usable visual observation, not just a goal. */
  needsVisual: boolean;
  discuss: string;
  insufficient: string;
}

const AREA_COPY: Partial<Record<InterpretationArea, AreaCopy>> = {
  facial_lines: {
    title: "Facial lines",
    category: "NEUROMODULATOR",
    needsVisual: true,
    discuss: "Expression-related facial lines were observed during the assessment. A neuromodulator consultation may be worth discussing with your clinician.",
    insufficient: "We couldn't establish enough visual evidence to interpret facial lines from these images.",
  },
  facial_definition: {
    title: "Facial definition",
    category: "FACIAL_CONTOURING",
    needsVisual: true,
    discuss:
      "Your assessment identified facial contour characteristics relevant to your goal of a more defined appearance. Facial contouring options may be worth discussing with your clinician.",
    insufficient: "We couldn't establish enough visual evidence to interpret facial definition from these images.",
  },
  facial_volume: {
    title: "Facial fullness",
    category: "DERMAL_FILLER",
    needsVisual: true,
    discuss: "Your goals and the available facial contour evidence suggest that a facial fullness assessment may be worth discussing with your clinician.",
    insufficient: "We couldn't establish enough visual evidence to interpret facial volume from these images.",
  },
  facial_lifting: {
    title: "Lifting and firmness",
    category: "FACIAL_LIFTING",
    needsVisual: true,
    discuss: "Your stated goals and the available facial observations may justify discussing lifting-related options with your clinician.",
    insufficient: "Your goal was recorded, but the current assessment does not have enough visual evidence to evaluate lifting-related changes.",
  },
  skin: {
    title: "Skin appearance",
    category: "SKIN_TREATMENT",
    needsVisual: false,
    discuss: "Your responses indicate skin-related concerns that may be worth assessing with your clinician.",
    insufficient: "Your skin-related goals were recorded. This assessment does not analyze skin from photographs.",
  },
  under_eye: {
    title: "Under-eye appearance",
    category: null,
    needsVisual: true,
    discuss: "Your assessment identified a visible difference in under-eye appearance relative to nearby facial skin.",
    insufficient: "We couldn't establish enough visual evidence to interpret under-eye appearance from these images.",
  },
};

const AREA_ORDER: InterpretationArea[] = ["facial_lines", "facial_definition", "facial_volume", "facial_lifting", "under_eye", "skin"];

export const CONSUMER_LIMITATIONS: string[] = [
  "This assessment is based only on the photos, video and answers you provided.",
  "Lighting, camera angle and expression all affect what can be observed.",
  "It cannot tell which treatments, if any, are appropriate for you.",
  "A qualified clinician must assess your face in person.",
];

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export interface BuildOptions {
  /** Override the visual-calibration flag (tests only). Defaults to VISUAL_OBSERVATIONS_CALIBRATED. */
  calibrated?: boolean;
  now?: () => string;
}

const dedupeRefs = (refs: EvidenceRef[]) => [...new Map(refs.map((r) => [`${r.sourceType}:${r.sourceId}`, r])).values()];
const q = (sourceId: string): EvidenceRef => ({ sourceType: "questionnaire", sourceId });
const vis = (sourceId: string): EvidenceRef => ({ sourceType: "visual_observation", sourceId });

export function buildInterpretation(input: InterpretationInput, options: BuildOptions = {}): InterpretationResult {
  const usableId = (id: string) => isConsumerReady([id], options.calibrated);
  const byId = new Map(input.observations.map((o) => [o.id, o]));
  const measured = (o: Observation<unknown>) => o.type !== "user_reported";
  const usableVisual = input.observations.filter((o) => measured(o) && usableId(o.id));

  let n = 0;
  const statement = (text: string, evidence: EvidenceRef[]): InterpretationStatement => ({ id: `stmt.${++n}`, statement: text, evidence: dedupeRefs(evidence) });
  const section = (...s: (InterpretationStatement | null)[]): InterpretationSection => ({ statements: s.filter((x): x is InterpretationStatement => x !== null) });

  const goalsIn = (area: InterpretationArea) => input.goals.filter((g) => g.area === area);
  const pick = (ids: string[], max = 3) => ids.slice(0, max);

  // ---- priorities ----
  const explicit = input.goals.filter((g) => g.isPriority && !g.isDetail && g.area !== null);
  const fallback = input.goals.filter((g) => !g.isDetail && g.area !== null);
  const seenLabels = new Set<string>();
  const priorities: InterpretationPriority[] = [];
  for (const g of explicit.length > 0 ? explicit : fallback) {
    if (seenLabels.has(g.label) || priorities.length >= 3) continue;
    seenLabels.add(g.label);
    priorities.push({ id: `priority.${priorities.length + 1}`, label: g.label, evidence: [q(g.sourceId)] });
  }

  // ---- areas to discuss ----
  const opportunities: InterpretationOpportunity[] = [];
  for (const area of AREA_ORDER) {
    const goals = goalsIn(area);
    const copy = AREA_COPY[area];
    if (goals.length === 0 || !copy) continue;
    const goalRefs = pick([...new Set(goals.map((g) => g.sourceId))], 4).map(q);

    if (area === "under_eye") {
      const obs = byId.get("eyeArea.visibleUnderEyeDarkness");
      const ok = obs && measured(obs) && obs.value === true && usableId(obs.id);
      opportunities.push({
        id: `area.${area}`, area, title: copy.title, category: null,
        status: ok ? "observation_only" : "insufficient_evidence",
        statement: ok ? copy.discuss : copy.insufficient,
        evidence: ok ? dedupeRefs([...goalRefs, vis(obs.id)]) : goalRefs,
      });
      continue;
    }

    const opp = input.opportunities.find((o) => o.status === "potential_opportunity" && o.consumerReady && o.category === copy.category);
    const observationRefs = (opp?.evidenceObservationIds ?? []).filter((id) => byId.has(id) && usableId(id) && measured(byId.get(id)!));
    const supported = !!opp && (!copy.needsVisual || observationRefs.length > 0);

    opportunities.push({
      id: `area.${area}`, area, title: copy.title,
      category: supported ? copy.category : null,
      status: supported ? "discuss" : "insufficient_evidence",
      statement: supported ? copy.discuss : copy.insufficient,
      evidence: supported
        ? dedupeRefs([...goalRefs, { sourceType: "treatment_opportunity", sourceId: opp.id }, ...pick(observationRefs, 4).map(vis)])
        : goalRefs,
    });
  }
  const discussed = opportunities.filter((o) => o.status === "discuss");

  // ---- sections ----
  const structureIds = usableVisual.filter((o) => o.domain === "facial-structure" && o.id.startsWith("facialStructure.") && !o.id.startsWith("facialStructure.contour.")).map((o) => o.id);
  const contourIds = usableVisual.filter((o) => o.id.startsWith("facialStructure.contour.")).map((o) => o.id);
  const eyeIds = usableVisual.filter((o) => o.domain === "eye-area" && o.id.startsWith("eyeArea.") && !o.id.startsWith("eyeArea.underEye") && !o.id.startsWith("eyeArea.visible")).map((o) => o.id);
  const underEye = opportunities.find((o) => o.area === "under_eye" && o.status === "observation_only");

  const userValues = (id: string): string[] => {
    const o = byId.get(id);
    return o && o.type === "user_reported" ? (Array.isArray(o.value) ? o.value.map(String) : [String(o.value)]) : [];
  };
  const userIds = (prefix: string) => input.observations.filter((o) => o.type === "user_reported" && o.id.startsWith(prefix)).map((o) => o.id);
  const hairConcerns = userValues("hair.concerns").filter((v) => v !== "none" && v !== "other");
  const facialHairGoals = userValues("facialHair.improvements").filter((v) => v !== "notApplicable");
  const styleGoals = userValues("style.styleGoals").filter((v) => v !== "notSure");
  const lifestyleIds = userIds("lifestyle.");

  const skinGoals = goalsIn("skin");
  const facialStructure = section(
    structureIds.length ? statement("The assessment measured facial structure from your front photo.", pick(structureIds).map(vis)) : null,
    contourIds.length ? statement("The assessment detected measurable facial contour geometry.", pick(contourIds).map(vis)) : null,
  );
  const eyeArea = section(
    eyeIds.length ? statement("The assessment measured the eye area from your front photo.", pick(eyeIds).map(vis)) : null,
    underEye ? statement(underEye.statement, underEye.evidence) : null,
  );
  const skin = section(skinGoals.length ? statement("You indicated skin appearance as an area of interest.", pick([...new Set(skinGoals.map((g) => g.sourceId))]).map(q)) : null);
  const hair = section(hairConcerns.length ? statement(`You noted hair concerns: ${hairConcerns.join(", ")}.`, [q("hair.concerns")]) : null);
  const facialHair = section(facialHairGoals.length ? statement(`You noted facial hair goals: ${facialHairGoals.join(", ")}.`, [q("facialHair.improvements")]) : null);
  const lifestyle = section(lifestyleIds.length ? statement("You shared lifestyle information that your clinician may find useful context.", pick(lifestyleIds).map(q)) : null);
  const style = section(styleGoals.length ? statement("You shared personal style goals.", [q("style.styleGoals")]) : null);

  // ---- summary ----
  const summary =
    discussed.length > 0
      ? statement(
          `Your assessment highlighted ${discussed.length === 1 ? "one area" : `${discussed.length} areas`} you may want to discuss with your clinician.`,
          discussed.flatMap((o) => o.evidence.filter((r) => r.sourceType === "treatment_opportunity")),
        )
      : priorities.length > 0
        ? statement(
            "Your assessment is ready. It recorded your priorities, but there isn't enough visual evidence to highlight specific areas to discuss yet.",
            priorities.flatMap((p) => p.evidence),
          )
        : statement("Your assessment is ready. There isn't enough information yet to highlight specific areas.", [{ sourceType: "assessment", sourceId: input.assessmentId }]);

  // ---- audit list ----
  const labelFor = (r: EvidenceRef): string => {
    if (r.sourceType === "assessment") return "Assessment";
    if (r.sourceType === "treatment_opportunity") return input.opportunities.find((o) => o.id === r.sourceId)?.title ?? r.sourceId;
    if (r.sourceType === "visual_observation") return byId.get(r.sourceId)?.label ?? r.sourceId;
    return input.goals.find((g) => g.sourceId === r.sourceId)?.label ?? byId.get(r.sourceId)?.label ?? r.sourceId;
  };
  const allSections = [facialStructure, eyeArea, skin, hair, facialHair, lifestyle, style];
  const allRefs = dedupeRefs([
    ...summary.evidence,
    ...priorities.flatMap((p) => p.evidence),
    ...opportunities.flatMap((o) => o.evidence),
    ...allSections.flatMap((s) => s.statements.flatMap((x) => x.evidence)),
  ]);
  const evidence: EvidenceEntry[] = allRefs.map((r) => ({ ...r, label: labelFor(r) }));

  const base = {
    version: INTERPRETATION_VERSION,
    createdAt: (options.now ?? (() => new Date().toISOString()))(),
    summary,
    priorities,
    facialStructure,
    eyeArea,
    skin,
    hair,
    facialHair,
    lifestyle,
    style,
    opportunities,
    limitations: [...CONSUMER_LIMITATIONS],
    evidence,
    clinicianReviewRequired: true as const,
  };
  return { ...base, report: buildReport(input, base, usableId) };
}
