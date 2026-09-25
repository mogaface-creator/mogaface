/**
 * The personalised MogaFace report, built deterministically from the SAME
 * evidence the interpretation uses. It is the local (no key, no network)
 * provider's output and also the "draft" an AI provider is asked to rephrase.
 *
 * Rules:
 *  - Every statement carries evidence references that resolve to the input;
 *    when evidence is missing the statement says so honestly (sourceType
 *    "limitation") — a missing measurement is never turned into an observation.
 *  - User-reported information is worded as user-reported ("You reported…");
 *    only computer-vision observations are worded as observed.
 *  - Area decisions (discuss / observation only / insufficient) are the ones
 *    the interpretation already made from the treatment-opportunity engine and
 *    the calibration gate. Nothing here creates an opportunity or bypasses a gate.
 *  - No numbers, scores, comparisons with an ideal, causes or treatment claims.
 */

import type { Observation } from "../observation/types.ts";
import type {
  EvidenceLevel,
  EvidenceRef,
  InterpretationArea,
  InterpretationInput,
  InterpretationOpportunity,
  InterpretationResult,
  MogaFaceReport,
  ReportOpportunity,
  ReportPriority,
  ReportSection,
  ReportSourceType,
  ReportStatement,
  SectionBasis,
  UserGoal,
} from "./types.ts";

export const REPORT_LIMITATIONS: string[] = [
  "This analysis is based only on the photos, video and answers you submitted.",
  "Lighting, camera angle, expression and image quality all affect what can be observed.",
  "Some areas, including skin, cannot currently be assessed reliably from your images.",
  "MogaFace is not a medical assessment and cannot identify health conditions.",
  "MogaFace does not decide which treatments, if any, are appropriate for you.",
  "Every decision rests with a qualified clinician who assesses you in person.",
];

export const REPORT_CLINICIAN_REVIEW =
  "This report is designed to help you prepare for a consultation. A qualified clinician should assess you in person and decide which options, if any, are appropriate.";

export const REPORT_CTA = {
  heading: "Discuss Your Results With Your Clinician",
  supportingText: "Bring this report to your consultation to help explain the areas you would like to explore.",
} as const;

// ---------------------------------------------------------------------------
// Wording for questionnaire values (descriptive only — never a judgement)
// ---------------------------------------------------------------------------

const W: Record<string, Record<string, string>> = {
  hairLength: { veryShort: "very short", short: "short", medium: "medium-length", long: "long" },
  hairTexture: { straight: "straight", wavy: "wavy", curly: "curly", coily: "coily" },
  hairDensity: { low: "lower", medium: "medium", high: "higher" },
  hairConcern: { hairline: "hairline", thinning: "thinning", dryness: "dryness", frizz: "frizz", scalp: "scalp", styling: "styling", haircut: "haircut" },
  haircut: { every2to4Weeks: "every 2–4 weeks", every1to2Months: "every 1–2 months", every2to3Months: "every 2–3 months", rarely: "rarely" },
  facialHairStyle: { cleanShaven: "clean-shaven", stubble: "stubble", shortBeard: "a short beard", mediumBeard: "a medium beard", longBeard: "a long beard", mustache: "a moustache", varies: "a style that varies" },
  facialHairGoal: { shape: "shape", density: "density", length: "length", cheekLine: "cheek line", neckline: "neckline", grooming: "grooming" },
  sleep: { lessThan5: "fewer than 5 hours", "5to6": "5–6 hours", "6to7": "6–7 hours", "7to8": "7–8 hours", "8plus": "8 or more hours" },
  exercise: { none: "do not exercise regularly", "1to2PerWeek": "exercise 1–2 times per week", "3to4PerWeek": "exercise 3–4 times per week", "5plusPerWeek": "exercise 5 or more times per week" },
  training: { strength: "strength training", cardio: "cardio", sports: "sports", walking: "walking", other: "other activity" },
  activity: { sedentary: "mostly sedentary", lightlyActive: "lightly active", moderatelyActive: "moderately active", veryActive: "very active" },
  water: { lessThan1L: "less than 1 litre", "1to2L": "1–2 litres", "2to3L": "2–3 litres", "3LPlus": "3 litres or more" },
  style: { minimal: "minimal", casual: "casual", smartCasual: "smart casual", professional: "professional", streetwear: "streetwear", formal: "formal", sporty: "sporty", experimental: "experimental" },
  styleGoal: { clean: "clean", sophisticated: "sophisticated", masculine: "masculine", feminine: "feminine", sharp: "sharp", relaxed: "relaxed", modern: "modern", professional: "professional", confident: "confident" },
};

const list = (items: string[]): string => (items.length <= 1 ? (items[0] ?? "") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

type Base = Omit<InterpretationResult, "report">;

const q = (sourceId: string): EvidenceRef => ({ sourceType: "questionnaire", sourceId });
const vis = (sourceId: string): EvidenceRef => ({ sourceType: "visual_observation", sourceId });
const dedupe = (refs: EvidenceRef[]) => [...new Map(refs.map((r) => [`${r.sourceType}:${r.sourceId}`, r])).values()];

const LEVEL_OF: Record<string, EvidenceLevel> = { high: "complete", moderate: "partial", low: "limited" };

/** Plain-language description of what a visual observation is — no ids, no numbers. */
function describeVisual(id: string): string | null {
  if (id.startsWith("facialStructure.contour.")) return "Jaw and cheek contour outlines measured across your submitted views";
  if (id.startsWith("facialStructure.")) return "Facial proportions measured from your front photo";
  if (id.startsWith("eyeArea.visibleUnderEye") || id.startsWith("eyeArea.underEye")) return "The appearance of the under-eye area in your front photo";
  if (id.startsWith("eyeArea.")) return "Eye-area measurements from your front photo";
  if (id.startsWith("expression.")) return "Expression movement and visible line patterns in your recorded video";
  return null;
}

export function buildReport(input: InterpretationInput, base: Base, usableId: (id: string) => boolean): MogaFaceReport {
  const byId = new Map(input.observations.map((o) => [o.id, o]));
  const measuredUsable = input.observations.filter((o) => o.type !== "user_reported" && usableId(o.id));
  const goalOf = (id: string): UserGoal | undefined => input.goals.find((g) => g.sourceId === id);
  const oppOf = (area: InterpretationArea): InterpretationOpportunity | undefined => base.opportunities.find((o) => o.area === area);

  let n = 0;
  const st = (text: string, evidenceRefs: EvidenceRef[], sourceType: ReportSourceType, confidence: EvidenceLevel): ReportStatement => ({
    id: `report.${++n}`,
    text,
    evidenceRefs: dedupe(evidenceRefs.length > 0 ? evidenceRefs : [{ sourceType: "assessment", sourceId: input.assessmentId }]),
    confidence,
    sourceType,
  });
  const noEvidence = (text: string, refs: EvidenceRef[] = []) => st(text, refs, "limitation", "limited");

  const value = (id: string): string[] => {
    const o: Observation<unknown> | undefined = byId.get(id);
    return o && o.type === "user_reported" ? (Array.isArray(o.value) ? o.value.map(String) : [String(o.value)]) : [];
  };
  const word = (group: string, id: string): string | null => {
    const v = value(id)[0];
    return v !== undefined && W[group][v] ? W[group][v] : null;
  };
  const words = (group: string, id: string): string[] => value(id).map((v) => W[group][v]).filter((v): v is string => !!v);

  const section = (statements: ReportStatement[], fallback: string, fallbackRefs: EvidenceRef[] = [], howAssessed: string | null = null): ReportSection => {
    const basis: SectionBasis = statements.some((s) => s.sourceType === "observed" || s.sourceType === "opportunity")
      ? "observed"
      : statements.some((s) => s.sourceType === "user_reported")
        ? "user_reported"
        : "not_assessed";
    return { basis, statements: statements.length > 0 ? statements : [noEvidence(fallback, fallbackRefs)], howAssessed: basis === "observed" ? howAssessed : null };
  };

  // ---- facial structure ----
  const usableIds = (test: (id: string) => boolean) => measuredUsable.map((o) => o.id).filter(test);
  const structureIds = usableIds((id) => id.startsWith("facialStructure.") && !id.startsWith("facialStructure.contour."));
  const contourIds = usableIds((id) => id.startsWith("facialStructure.contour."));
  const has = (ids: string[], ...needles: string[]) => ids.filter((id) => needles.some((x) => id.includes(x)));

  const structureStatements: ReportStatement[] = [];
  if (structureIds.length > 0) {
    const parts: string[] = [];
    const proportions = has(structureIds, "faceWidth", "faceHeight", "thirds", "proportion.");
    const lower = has(structureIds, "jawWidth", "lowerFaceHeight");
    const features = has(structureIds, "noseWidth", "mouthWidth");
    const balance = has(structureIds, "ymmetry");
    if (proportions.length) parts.push("overall face proportions");
    if (lower.length) parts.push("jaw width and lower-face height");
    if (features.length) parts.push("nose and mouth width");
    if (balance.length) parts.push("left-to-right comparisons");
    structureStatements.push(
      st(
        `Your front photo provided measurements of ${list(parts.length > 0 ? parts : ["facial proportions"])}. These give your clinician structural context; they are not a judgement of your face.`,
        structureIds.slice(0, 4).map(vis),
        "observed",
        "partial",
      ),
    );
  }
  if (contourIds.length > 0) {
    const views = new Set(contourIds.map((id) => id.split(".")[3]));
    structureStatements.push(
      st(
        views.size > 1
          ? "The outline of your jaw and cheeks could be measured in more than one of your submitted views, which adds contour context."
          : "The outline of your jaw and cheeks could be measured in your front view.",
        contourIds.slice(0, 4).map(vis),
        "observed",
        "partial",
      ),
    );
  }
  const structureGoal = input.goals.find((g) => !g.isDetail && (g.area === "facial_definition" || g.area === "facial_balance"));
  if (structureGoal && structureStatements.length > 0) {
    structureStatements.push(
      st(
        structureGoal.area === "facial_definition"
          ? "Together, these measurements give some structural context for your goal of a more defined appearance."
          : "Together, these measurements give some structural context for your interest in facial balance.",
        [q(structureGoal.sourceId), ...structureIds.slice(0, 2).map(vis), ...contourIds.slice(0, 2).map(vis)],
        "observed",
        "partial",
      ),
    );
  }
  const facialStructure = section(
    structureStatements,
    "No reliable visual evidence was available for facial structure in the submitted photos.",
    [],
    "Based on facial landmarks detected across your submitted views.",
  );

  // ---- eye area ----
  const eyeIds = usableIds((id) => id.startsWith("eyeArea.") && !id.startsWith("eyeArea.underEye") && !id.startsWith("eyeArea.visible"));
  const eyeStatements: ReportStatement[] = [];
  if (eyeIds.length > 0) {
    const eyeParts: string[] = [];
    if (has(eyeIds, "EyeWidth").length) eyeParts.push("the width of each eye");
    if (has(eyeIds, "interocular").length) eyeParts.push("the distance between the eyes");
    if (has(eyeIds, "ymmetry").length) eyeParts.push("left-to-right comparisons of the eye area");
    eyeStatements.push(st(`Your front photo allowed ${list(eyeParts.length > 0 ? eyeParts : ["the proportions of the eye area"])} to be measured.`, eyeIds.slice(0, 4).map(vis), "observed", "partial"));
  }
  const underEyeGoals = input.goals.filter((g) => g.area === "under_eye").map((g) => q(g.sourceId));
  const underEye = oppOf("under_eye");
  if (underEye?.status === "observation_only") {
    eyeStatements.push(
      st(
        "Your assessment identified a visible difference in under-eye appearance relative to nearby facial skin. Your submitted images allow us to record how this area looks, but they do not provide enough evidence to determine whether it relates to volume, pigmentation, puffiness or another factor.",
        underEye.evidence,
        "observed",
        "partial",
      ),
    );
  } else if (underEyeGoals.length > 0) {
    eyeStatements.push(noEvidence("Your assessment identified under-eye appearance as a concern, but your images do not provide enough evidence to characterize it.", underEyeGoals));
  }
  const eyeArea = section(eyeStatements, "No reliable visual evidence was available for the eye area in the submitted photos.", [], "Based on facial landmarks detected in your front photo.");

  // ---- expression (only with valid, consumer-usable evidence) ----
  const patternRegion: Record<string, string> = {
    "expression.visibleForeheadLinePattern": "in the forehead area",
    "expression.visibleGlabellarLinePattern": "between the brows",
    "expression.visibleLateralEyeLinePattern": "around the outer corners of the eyes",
  };
  const patternIds = measuredUsable.filter((o) => o.id in patternRegion && o.value === true).map((o) => o.id);
  const movementIds = usableIds((id) => id.startsWith("expression.") && /MovementPct$/.test(id));
  const linesOpp = oppOf("facial_lines");
  const expressionStatements: ReportStatement[] = [];
  if (patternIds.length > 0) {
    expressionStatements.push(st(`During the recorded expressions, visible line patterns were observed ${list(patternIds.map((id) => patternRegion[id]))}.`, patternIds.map(vis), "observed", "partial"));
  } else if (movementIds.length > 0) {
    const kinds = movementIds.map((id) => id.split(".")[1].replace(/([A-Z])/g, " $1").toLowerCase());
    expressionStatements.push(st(`Your recorded expressions captured movement for: ${list(kinds)}.`, movementIds.map(vis), "observed", "partial"));
  }
  if (expressionStatements.length > 0 && linesOpp?.status === "discuss") {
    const opp = input.opportunities.find((o) => linesOpp.evidence.some((e) => e.sourceType === "treatment_opportunity" && e.sourceId === o.id));
    expressionStatements.push(
      st(
        "Because expression-related changes are involved, this may be an area worth discussing with your clinician.",
        linesOpp.evidence,
        "opportunity",
        (opp?.confidence && LEVEL_OF[opp.confidence]) || "partial",
      ),
    );
  }
  const expression = expressionStatements.length > 0 ? section(expressionStatements, "", [], "Based on sampled frames from your expression video compared with a neutral baseline.") : null;

  // ---- skin (questionnaire only: no skin computer vision exists) ----
  const skinGoals = input.goals.filter((g) => g.area === "skin");
  const skinConcerns = [...new Set(skinGoals.filter((g) => !g.isDetail).map((g) => g.label.toLowerCase()))];
  const skinRefs = [...new Set(skinGoals.map((g) => g.sourceId))].slice(0, 4).map(q);
  const skin = section(
    skinGoals.length > 0
      ? [
          st(`Your assessment reports skin-related concerns: ${list(skinConcerns.length > 0 ? skinConcerns : ["skin appearance"])}.`, skinRefs, "user_reported", "complete"),
          noEvidence("MogaFace does not yet analyze skin from photographs, so the current analysis cannot characterize the cause or extent of these concerns. Your clinician can assess your skin in person.", skinRefs),
        ]
      : [],
    "You didn't select skin-related concerns, and MogaFace does not yet analyze skin from photographs.",
  );

  // ---- hair (questionnaire only) ----
  const hairStatements: ReportStatement[] = [];
  const hairParts = [word("hairLength", "hair.length"), word("hairTexture", "hair.texture")].filter((v): v is string => !!v);
  const density = word("hairDensity", "hair.density");
  if (hairParts.length > 0 || density) {
    const description = hairParts.length > 0 ? `${list(hairParts)} hair` : "your hair";
    hairStatements.push(
      st(`You described your hair as ${description}${density ? ` with ${density} density` : ""}.`, ["hair.length", "hair.texture", "hair.density"].filter((id) => value(id).length > 0).map(q), "user_reported", "complete"),
    );
  }
  const hairConcerns = words("hairConcern", "hair.concerns");
  if (hairConcerns.length > 0) hairStatements.push(st(`You noted hair concerns: ${list(hairConcerns)}.`, [q("hair.concerns")], "user_reported", "complete"));
  const cut = word("haircut", "hair.haircutFrequency");
  if (cut) hairStatements.push(st(`You reported getting your hair cut ${cut}.`, [q("hair.haircutFrequency")], "user_reported", "complete"));
  const hair = section(hairStatements, "You didn't share hair details in your assessment, and MogaFace does not analyze hair from photographs.");

  // ---- facial hair (questionnaire only) ----
  const fhStatements: ReportStatement[] = [];
  const fhStyle = word("facialHairStyle", "facialHair.currentStyle");
  if (fhStyle) fhStatements.push(st(`You described your current facial hair as ${fhStyle}.`, [q("facialHair.currentStyle")], "user_reported", "complete"));
  const fhGoals = words("facialHairGoal", "facialHair.improvements");
  if (fhGoals.length > 0) fhStatements.push(st(`You noted facial hair goals: ${list(fhGoals)}.`, [q("facialHair.improvements")], "user_reported", "complete"));
  const facialHair = section(fhStatements, "You didn't share facial hair details in your assessment, and MogaFace does not analyze facial hair from photographs.");

  // ---- lifestyle (descriptive only — no conclusions) ----
  const lifeStatements: ReportStatement[] = [];
  const sleep = word("sleep", "lifestyle.sleepHours");
  if (sleep) lifeStatements.push(st(`You reported sleeping ${sleep} per night.`, [q("lifestyle.sleepHours")], "user_reported", "complete"));
  const exercise = word("exercise", "lifestyle.exerciseFrequency");
  const training = words("training", "lifestyle.trainingTypes");
  if (exercise) {
    lifeStatements.push(st(`You reported that you ${exercise}${training.length > 0 ? `, including ${list(training)}` : ""}.`, ["lifestyle.exerciseFrequency", "lifestyle.trainingTypes"].filter((id) => value(id).length > 0).map(q), "user_reported", "complete"));
  }
  const activity = word("activity", "lifestyle.dailyActivity");
  if (activity) lifeStatements.push(st(`You described your day-to-day activity as ${activity}.`, [q("lifestyle.dailyActivity")], "user_reported", "complete"));
  const water = word("water", "lifestyle.waterIntake");
  if (water) lifeStatements.push(st(`You reported drinking ${water} of water per day.`, [q("lifestyle.waterIntake")], "user_reported", "complete"));
  const lifestyle = section(lifeStatements, "You didn't share lifestyle details in your assessment.");

  // ---- style ----
  const styleStatements: ReportStatement[] = [];
  const cur = word("style", "style.currentStyle");
  if (cur) styleStatements.push(st(`You described your current style as ${cur}.`, [q("style.currentStyle")], "user_reported", "complete"));
  const goals = words("styleGoal", "style.styleGoals");
  if (goals.length > 0) styleStatements.push(st(`You would like your appearance to feel ${list(goals)}.`, [q("style.styleGoals")], "user_reported", "complete"));
  const style = section(styleStatements, "You didn't share style details in your assessment.");

  // ---- priorities ----
  const structural = structureIds.length > 0 ? structureIds.slice(0, 3).map(vis) : [];
  const priorities: ReportPriority[] = base.priorities.map((p, i) => {
    const ref = p.evidence[0];
    const goal = goalOf(ref.sourceId);
    const details = goal ? input.goals.filter((g) => g.isDetail && g.area === goal.area && g.area !== null) : [];
    const opp = goal?.area ? oppOf(goal.area) : undefined;
    const why = st(
      `You selected this ${goal?.isPriority === false ? "as an area of interest" : "as one of your main priorities"}${details.length > 0 ? `, noting ${list([...new Set(details.map((d) => d.label.toLowerCase()))])}` : ""}.`,
      [ref, ...details.map((d) => q(d.sourceId))],
      "user_reported",
      "complete",
    );

    let evidence: ReportStatement;
    let status: ReportPriority["status"] = "recorded";
    if (opp?.status === "discuss") {
      status = "discuss";
      const oppRecord = input.opportunities.find((o) => opp.evidence.some((e) => e.sourceType === "treatment_opportunity" && e.sourceId === o.id));
      const text: Partial<Record<InterpretationArea, string>> = {
        facial_definition: "Available facial measurements provide structural context for this goal.",
        facial_lines: "Visible expression-related line patterns were recorded during your video.",
        facial_volume: "Available contour measurements provide some context for this goal.",
        skin: "This priority comes from your own answers; it is not measured from your photos.",
      };
      const fromAnswers = opp.area === "skin";
      evidence = st(
        text[opp.area] ?? "Available evidence provides some context for this goal.",
        fromAnswers ? opp.evidence.filter((e) => e.sourceType === "questionnaire") : opp.evidence,
        fromAnswers ? "user_reported" : "opportunity",
        (oppRecord?.confidence && LEVEL_OF[oppRecord.confidence]) || "partial",
      );
    } else if (opp?.status === "observation_only") {
      status = "observation_only";
      evidence = st("A visible difference in under-eye appearance was recorded in your front photo.", opp.evidence, "observed", "partial");
    } else if (goal?.area === "facial_balance" && structural.length > 0) {
      status = "observation_only";
      evidence = st("Your front-photo measurements provide structural context for facial balance.", [ref, ...structural], "observed", "partial");
    } else if (goal?.area === "skin") {
      evidence = noEvidence("This priority is recorded from your answers; MogaFace does not analyze skin from photographs.", [ref]);
    } else if (goal?.area === null || goal?.area === "overall" || goal?.area === "facial_balance") {
      evidence = noEvidence("This is recorded as context from your answers rather than assessed from your images.", [ref]);
    } else {
      evidence = noEvidence("Not enough visual evidence was available to assess this area.", [ref]);
    }
    return { id: p.id || `priority.${i + 1}`, concern: p.label, why, evidence, status };
  });

  // ---- areas to discuss ----
  const CAN_EVALUATE: Record<string, string> = {
    facial_lines: "Whether and how expression-related lines are relevant to you, and which options, if any, exist.",
    facial_definition: "How your facial contour relates to your goal, and which options, if any, are relevant.",
    facial_volume: "Whether facial fullness is an area of interest in person, and what options, if any, exist.",
    under_eye: "What may be contributing to the under-eye appearance you described, which needs an in-person assessment.",
    skin: "Your skin in person, including the concerns you listed.",
  };
  const DISCUSS: Partial<Record<InterpretationArea, string>> = {
    facial_lines: "Visible expression-related line patterns were identified alongside your selected concern. This may be an area worth discussing with your clinician.",
    facial_definition: "Your selected goal includes greater facial definition, and the available facial measurements provide structural evidence relevant to this goal. This may be worth discussing with your clinician.",
    facial_volume: "Your goals and the available facial contour evidence suggest facial fullness may be an area to explore with your clinician.",
    skin: "Your assessment reports skin-related concerns. This may be an area to explore with your clinician, who can assess your skin in person.",
  };

  const opportunities: ReportOpportunity[] = base.opportunities.map((o) => {
    const oppRecord = input.opportunities.find((r) => o.evidence.some((e) => e.sourceType === "treatment_opportunity" && e.sourceId === r.id));
    const supported = o.status === "discuss" && DISCUSS[o.area];
    const text = o.status === "discuss" && supported ? DISCUSS[o.area]! : o.statement;
    const sourceType: ReportSourceType = o.status === "insufficient_evidence" ? "limitation" : o.status === "observation_only" ? "observed" : o.area === "skin" ? "user_reported" : "opportunity";
    const refs = sourceType === "user_reported" ? o.evidence.filter((e) => e.sourceType === "questionnaire") : o.evidence;
    const lines = new Set<string>();
    for (const e of o.evidence) {
      if (e.sourceType === "questionnaire") {
        const g = goalOf(e.sourceId);
        if (g && !g.isDetail) lines.add(`You selected: ${g.label}`);
      } else if (e.sourceType === "visual_observation") {
        const d = describeVisual(e.sourceId);
        if (d) lines.add(d);
      } else if (e.sourceType === "treatment_opportunity") lines.add("Matched to your goal by MogaFace's opportunity analysis");
    }
    return {
      id: o.id,
      area: o.area,
      title: o.title,
      status: o.status,
      why: st(text, refs, sourceType, sourceType === "limitation" ? "limited" : (oppRecord?.confidence && LEVEL_OF[oppRecord.confidence]) || "partial"),
      evidenceLines: [...lines],
      clinicianCanEvaluate: o.status === "insufficient_evidence" ? "Additional clinical assessment would be needed." : (CAN_EVALUATE[o.area] ?? "An in-person assessment."),
      category: o.category,
    };
  });

  // ---- overview ----
  const discussed = base.opportunities.filter((o) => o.status === "discuss");
  const focus = base.priorities.map((p) => p.label.toLowerCase());
  const focusSentence = focus.length > 0 ? `Your assessment focused primarily on ${list(focus)}. ` : "";
  let overview: ReportStatement;
  if (discussed.length > 0) {
    overview = st(
      `${focusSentence}Based on the available visual evidence and the concerns you selected, MogaFace identified ${discussed.length === 1 ? "one area" : `${discussed.length} areas`} that may be worth discussing with your clinician: ${list(discussed.map((o) => o.title.toLowerCase()))}.`,
      [...base.priorities.flatMap((p) => p.evidence), ...discussed.flatMap((o) => o.evidence.filter((e) => e.sourceType === "treatment_opportunity"))],
      "opportunity",
      "partial",
    );
  } else if (focus.length > 0) {
    overview = st(
      `${focusSentence}The available visual evidence does not yet point to specific areas to discuss, but your priorities are still a useful starting point for a conversation with your clinician.`,
      base.priorities.flatMap((p) => p.evidence),
      "user_reported",
      "limited",
    );
  } else {
    overview = noEvidence("There isn't enough information yet to highlight specific areas. Adding your priorities and photos will make this report more personal.");
  }

  // Limitations that reflect THIS report: what was missing or not assessed, in addition to the standing ones.
  const notAssessed = base.opportunities.filter((o) => o.status === "insufficient_evidence").map((o) => o.title.toLowerCase());
  const limitations = [
    ...REPORT_LIMITATIONS,
    ...(structureIds.length === 0 ? ["No reliable facial measurements were available from the submitted photos, so facial structure is not described in this report."] : []),
    ...(expression === null ? ["Expression and facial-line evidence is not included in this report."] : []),
    ...(notAssessed.length > 0 ? [`You told us about ${list(notAssessed)}, but there was not enough visual evidence to assess ${notAssessed.length === 1 ? "it" : "them"}.`] : []),
  ];

  return {
    overview,
    priorities,
    sections: { facialStructure, eyeArea, expression, skin, hair, facialHair, lifestyle, style },
    opportunities,
    limitations,
    clinicianReview: REPORT_CLINICIAN_REVIEW,
    cta: { ...REPORT_CTA },
  };
}
