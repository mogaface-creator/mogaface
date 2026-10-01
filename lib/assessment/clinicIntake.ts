/**
 * Clinic intake. These answers are what the person told us. They are not a
 * diagnosis, not a treatment recommendation, and they are never copied into
 * an image prompt. The after image still follows appearanceConcerns and hair
 * concerns only — see projectPlaces.
 */

import { createEmptyAppearanceConcerns, parentOfDetail, toggleConcern, toggleDetail, type AppearanceConcernId } from "./appearanceConcerns.ts";
import type { Assessment } from "./types.ts";

export const CLINIC_PLACES = [
  "FACIAL_LINES",
  "FACIAL_DEFINITION",
  "FACIAL_BALANCE",
  "FACIAL_VOLUME",
  "FACIAL_LIFTING",
  "UNDER_EYE",
  "SKIN_TEXTURE",
  "SKIN_TONE",
  "PIGMENTATION",
  "BLEMISHES",
  "OVERALL_APPEARANCE",
  "HAIR",
] as const;
export type ClinicPlace = (typeof CLINIC_PLACES)[number];

export const REPORT_WANTS = ["understand", "plan", "secondOpinion", "reassurance"] as const;
export type ReportWant = (typeof REPORT_WANTS)[number];

export const LOOK_DIRECTIONS = ["masculine", "feminine", "younger", "fresh", "friendly", "sharp"] as const;
export type LookDirection = (typeof LOOK_DIRECTIONS)[number];

export const MAX_WILLING = ["skincare", "laser", "injections", "threads", "surgery"] as const;
export type MaxWilling = (typeof MAX_WILLING)[number];

export const DOWNTIME = ["none", "days2to3", "oneWeek", "twoWeeksOrMore"] as const;
export type Downtime = (typeof DOWNTIME)[number];

export const SKIN_PROBLEMS = ["pimples", "darkMarks", "melasma", "redness", "roughTexture", "looseSkin", "darkCircles"] as const;
export type SkinProblem = (typeof SKIN_PROBLEMS)[number];

export const PUFFINESS = ["never", "sometimes", "daily"] as const;
export type Puffiness = (typeof PUFFINESS)[number];

export const TRAINING_PHASE = ["heavy", "steady", "burntOut"] as const;
export type TrainingPhase = (typeof TRAINING_PHASE)[number];

export const REPORT_TONE = ["blunt", "gentle"] as const;
export type ReportTone = (typeof REPORT_TONE)[number];

export const REPORT_ORDER = ["measurementsFirst", "planFirst"] as const;
export type ReportOrder = (typeof REPORT_ORDER)[number];

export const YES_NO = ["yes", "no"] as const;
export const YES_NO_UNSURE = ["yes", "no", "notSure"] as const;
export const PREGNANCY = ["no", "yes", "notApplicable"] as const;

export interface FaceDislike {
  words: string;
  duration: string;
}

export interface ClinicIntake {
  ageConfirmed: "yes" | "no" | null;
  directWordsOk: "yes" | "no" | null;
  botherScore: number | null;
  mirrorTime: string;
  toldWorriesMore: "yes" | "no" | "notSure" | null;
  reportWant: ReportWant | null;
  dislikes: [FaceDislike, FaceDislike, FaceDislike];
  /** Up to 3. These are the only intake answers that can change the after image, and only by mapping onto the existing concern and hair fields. */
  places: ClinicPlace[];
  lookDirections: LookDirection[];
  event: string;
  spendNext12Months: string;
  maxWilling: MaxWilling | null;
  downtime: Downtime | null;
  priorTreatments: string;
  breathing: string;
  teethAndJawHistory: string;
  jawNow: string;
  heightCm: number | null;
  weightKg: number | null;
  waist: string;
  bodyFat: string;
  familyHeightAndPuberty: string;
  exercise: string;
  weightHistory: string;
  skinProblems: SkinProblem[];
  marksEasily: "yes" | "no" | "notSure" | null;
  dailyProducts: string;
  acneTabletsOrSteroidCreams: string;
  healthConditions: string;
  medicines: string;
  pregnantOrBreastfeeding: "no" | "yes" | "notApplicable" | null;
  allergies: string;
  sleepHours: string;
  sleepSameTime: "yes" | "no" | null;
  morningPuffiness: Puffiness | null;
  heartRateTrend: string;
  tiredDays: string;
  illnessAndDigestion: string;
  flareUps: string;
  alcoholAndNicotine: string;
  waterAndSalt: string;
  stressOutOf10: number | null;
  sunAndSunscreen: string;
  trainingPhase: TrainingPhase | null;
  reportTone: ReportTone | null;
  reportOrder: ReportOrder | null;
  wantAfterPhoto: "yes" | "no" | null;
}

const emptyDislike = (): FaceDislike => ({ words: "", duration: "" });

export function createEmptyClinicIntake(): ClinicIntake {
  return {
    ageConfirmed: null,
    directWordsOk: null,
    botherScore: null,
    mirrorTime: "",
    toldWorriesMore: null,
    reportWant: null,
    dislikes: [emptyDislike(), emptyDislike(), emptyDislike()],
    places: [],
    lookDirections: [],
    event: "",
    spendNext12Months: "",
    maxWilling: null,
    downtime: null,
    priorTreatments: "",
    breathing: "",
    teethAndJawHistory: "",
    jawNow: "",
    heightCm: null,
    weightKg: null,
    waist: "",
    bodyFat: "",
    familyHeightAndPuberty: "",
    exercise: "",
    weightHistory: "",
    skinProblems: [],
    marksEasily: null,
    dailyProducts: "",
    acneTabletsOrSteroidCreams: "",
    healthConditions: "",
    medicines: "",
    pregnantOrBreastfeeding: null,
    allergies: "",
    sleepHours: "",
    sleepSameTime: null,
    morningPuffiness: null,
    heartRateTrend: "",
    tiredDays: "",
    illnessAndDigestion: "",
    flareUps: "",
    alcoholAndNicotine: "",
    waterAndSalt: "",
    stressOutOf10: null,
    sunAndSunscreen: "",
    trainingPhase: null,
    reportTone: null,
    reportOrder: null,
    wantAfterPhoto: null,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

function text(value: unknown, max = 800): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function score(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  if (rounded < 0 || rounded > 10) return null;
  return rounded;
}

function measure(value: unknown, min: number, max: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < min || value > max) return null;
  return value;
}

function listOf<T extends string>(value: unknown, allowed: readonly T[], max: number): T[] {
  if (!Array.isArray(value)) return [];
  const out: T[] = [];
  for (const item of value) {
    const picked = oneOf(item, allowed);
    if (picked && !out.includes(picked)) out.push(picked);
    if (out.length >= max) break;
  }
  return out;
}

function dislikesFrom(value: unknown): ClinicIntake["dislikes"] {
  const raw = Array.isArray(value) ? value : [];
  const three: FaceDislike[] = [0, 1, 2].map((index) => {
    const entry = raw[index];
    if (!isObject(entry)) return emptyDislike();
    return { words: text(entry.words, 240), duration: text(entry.duration, 120) };
  });
  return [three[0], three[1], three[2]];
}

/** Missing or unreadable intake becomes empty. It never rejects the rest of the assessment. */
export function sanitizeClinicIntake(value: unknown): ClinicIntake {
  const empty = createEmptyClinicIntake();
  if (!isObject(value)) return empty;
  return {
    ...empty,
    ageConfirmed: oneOf(value.ageConfirmed, YES_NO),
    directWordsOk: oneOf(value.directWordsOk, YES_NO),
    botherScore: score(value.botherScore),
    mirrorTime: text(value.mirrorTime, 240),
    toldWorriesMore: oneOf(value.toldWorriesMore, YES_NO_UNSURE),
    reportWant: oneOf(value.reportWant, REPORT_WANTS),
    dislikes: dislikesFrom(value.dislikes),
    places: listOf(value.places, CLINIC_PLACES, 3),
    lookDirections: listOf(value.lookDirections, LOOK_DIRECTIONS, 2),
    event: text(value.event, 240),
    spendNext12Months: text(value.spendNext12Months, 120),
    maxWilling: oneOf(value.maxWilling, MAX_WILLING),
    downtime: oneOf(value.downtime, DOWNTIME),
    priorTreatments: text(value.priorTreatments),
    breathing: text(value.breathing),
    teethAndJawHistory: text(value.teethAndJawHistory),
    jawNow: text(value.jawNow),
    heightCm: measure(value.heightCm, 100, 250),
    weightKg: measure(value.weightKg, 30, 300),
    waist: text(value.waist, 80),
    bodyFat: text(value.bodyFat, 160),
    familyHeightAndPuberty: text(value.familyHeightAndPuberty, 240),
    exercise: text(value.exercise),
    weightHistory: text(value.weightHistory),
    skinProblems: listOf(value.skinProblems, SKIN_PROBLEMS, SKIN_PROBLEMS.length),
    marksEasily: oneOf(value.marksEasily, YES_NO_UNSURE),
    dailyProducts: text(value.dailyProducts),
    acneTabletsOrSteroidCreams: text(value.acneTabletsOrSteroidCreams, 240),
    healthConditions: text(value.healthConditions),
    medicines: text(value.medicines),
    pregnantOrBreastfeeding: oneOf(value.pregnantOrBreastfeeding, PREGNANCY),
    allergies: text(value.allergies),
    sleepHours: text(value.sleepHours, 160),
    sleepSameTime: oneOf(value.sleepSameTime, YES_NO),
    morningPuffiness: oneOf(value.morningPuffiness, PUFFINESS),
    heartRateTrend: text(value.heartRateTrend, 240),
    tiredDays: text(value.tiredDays, 160),
    illnessAndDigestion: text(value.illnessAndDigestion),
    flareUps: text(value.flareUps),
    alcoholAndNicotine: text(value.alcoholAndNicotine, 240),
    waterAndSalt: text(value.waterAndSalt, 160),
    stressOutOf10: score(value.stressOutOf10),
    sunAndSunscreen: text(value.sunAndSunscreen, 240),
    trainingPhase: oneOf(value.trainingPhase, TRAINING_PHASE),
    reportTone: oneOf(value.reportTone, REPORT_TONE),
    reportOrder: oneOf(value.reportOrder, REPORT_ORDER),
    wantAfterPhoto: oneOf(value.wantAfterPhoto, YES_NO),
  };
}

function hasAGoal(intake: ClinicIntake): boolean {
  return intake.places.length > 0 || intake.dislikes.some((d) => d.words.length > 0);
}

/** Writes the picked places onto the fields the illustration already reads. Free text is left on the intake only. */
export function projectPlaces(assessment: Assessment, places: ClinicPlace[]): Assessment {
  const unique = listOf(places, CLINIC_PLACES, 3);
  const ids = unique.filter((place) => place !== "HAIR") as AppearanceConcernId[];
  let concerns = createEmptyAppearanceConcerns();
  for (const id of ids) concerns = toggleConcern(concerns, id);
  for (const detail of assessment.appearanceConcerns.details) {
    if (ids.includes(parentOfDetail(detail))) concerns = toggleDetail(concerns, detail);
  }
  concerns = { ...concerns, priorities: ids.slice(0, 3) };
  const hairOn = unique.includes("HAIR");
  const hairConcerns = hairOn
    ? assessment.hair.concerns.includes("thinning")
      ? assessment.hair.concerns
      : [...assessment.hair.concerns, "thinning" as const]
    : assessment.hair.concerns.filter((concern) => concern !== "thinning");
  const intake = { ...assessment.clinicIntake, places: unique };
  const areas = hasAGoal(intake) && assessment.goals.areas.length === 0 ? (["face"] as const) : assessment.goals.areas;
  return {
    ...assessment,
    clinicIntake: intake,
    appearanceConcerns: concerns,
    hair: { ...assessment.hair, concerns: hairConcerns },
    goals: { ...assessment.goals, areas: [...areas] },
  };
}

export function projectBody(assessment: Assessment, heightCm: number | null, weightKg: number | null): Assessment {
  const height = measure(heightCm, 100, 250);
  const weight = measure(weightKg, 30, 300);
  return {
    ...assessment,
    clinicIntake: { ...assessment.clinicIntake, heightCm: height, weightKg: weight },
    profile: { ...assessment.profile, heightCm: height, weightKg: weight },
  };
}

export function withIntake(assessment: Assessment, partial: Partial<ClinicIntake>): Assessment {
  const intake = { ...assessment.clinicIntake, ...partial };
  const areas = hasAGoal(intake) && assessment.goals.areas.length === 0 ? (["face"] as const) : assessment.goals.areas;
  return { ...assessment, clinicIntake: intake, goals: { ...assessment.goals, areas: [...areas] } };
}

function shown(value: string | null | undefined, labels?: Record<string, string>): string {
  if (value === null || value === undefined || value === "") return "Not answered";
  return labels?.[value] ?? value;
}

const YES_NO_LABELS = { yes: "Yes", no: "No", notSure: "Not sure", notApplicable: "Not applicable" };

export function intakeReviewSections(intake: ClinicIntake): { title: string; rows: { label: string; value: string }[]; stack: true }[] {
  const dislikeRows = intake.dislikes.map((dislike, index) => ({
    label: `Dislike ${index + 1}`,
    value: dislike.words ? `${dislike.words}${dislike.duration ? ` — ${dislike.duration}` : ""}` : "Not answered",
  }));
  return [
    {
      title: "About you and your goals",
      stack: true,
      rows: [
        { label: "18 or above", value: shown(intake.ageConfirmed, YES_NO_LABELS) },
        { label: "Plain, direct words", value: shown(intake.directWordsOk, YES_NO_LABELS) },
        { label: "How much the face bothers daily life", value: intake.botherScore === null ? "Not answered" : `${intake.botherScore} / 10` },
        { label: "Time on mirror, comparison, or photo editing", value: shown(intake.mirrorTime) },
        { label: "Told they worry more than needed", value: shown(intake.toldWorriesMore, YES_NO_LABELS) },
        { label: "Wants most from this", value: shown(intake.reportWant, { understand: "Understand my face", plan: "A step-by-step plan", secondOpinion: "A second opinion on a treatment already being considered", reassurance: "Honest reassurance" }) },
        ...dislikeRows,
        { label: "Places for the illustrative after", value: intake.places.length ? intake.places.join(", ") : "Not answered" },
        { label: "Want the face to look", value: intake.lookDirections.length ? intake.lookDirections.join(", ") : "Not answered" },
        { label: "Date or event", value: shown(intake.event) },
      ],
    },
    {
      title: "What you are comfortable with",
      stack: true,
      rows: [
        { label: "Spend in the next 12 months", value: shown(intake.spendNext12Months) },
        { label: "Maximum willing to do", value: shown(intake.maxWilling, { skincare: "Skincare and lifestyle only", laser: "Laser and machine treatments", injections: "Injections", threads: "Threads", surgery: "Surgery" }) },
        { label: "Visible downtime that can be managed", value: shown(intake.downtime, { none: "None", days2to3: "2–3 days", oneWeek: "1 week", twoWeeksOrMore: "2 weeks or more" }) },
        { label: "Already done", value: shown(intake.priorTreatments) },
      ],
    },
    {
      title: "Breathing, teeth and jaw",
      stack: true,
      rows: [
        { label: "Breathing and sleep", value: shown(intake.breathing) },
        { label: "Teeth and jaw history", value: shown(intake.teethAndJawHistory) },
        { label: "Jaw now", value: shown(intake.jawNow) },
      ],
    },
    {
      title: "Body, fitness and weight",
      stack: true,
      rows: [
        { label: "Height", value: intake.heightCm === null ? "Not answered" : `${intake.heightCm} cm` },
        { label: "Weight", value: intake.weightKg === null ? "Not answered" : `${intake.weightKg} kg` },
        { label: "Waist", value: shown(intake.waist) },
        { label: "Body fat", value: shown(intake.bodyFat) },
        { label: "Family height and puberty", value: shown(intake.familyHeightAndPuberty) },
        { label: "Exercise", value: shown(intake.exercise) },
        { label: "Weight history", value: shown(intake.weightHistory) },
      ],
    },
    {
      title: "Skin and health",
      stack: true,
      rows: [
        { label: "Skin problems", value: intake.skinProblems.length ? intake.skinProblems.join(", ") : "Not answered" },
        { label: "Marks or thick scars easily", value: shown(intake.marksEasily, YES_NO_LABELS) },
        { label: "Daily products", value: shown(intake.dailyProducts) },
        { label: "Acne tablets or steroid creams", value: shown(intake.acneTabletsOrSteroidCreams) },
        { label: "Health conditions", value: shown(intake.healthConditions) },
        { label: "Medicines and supplements", value: shown(intake.medicines) },
        { label: "Pregnant or breastfeeding", value: shown(intake.pregnantOrBreastfeeding, YES_NO_LABELS) },
        { label: "Allergies or anaesthesia reaction", value: shown(intake.allergies) },
      ],
    },
    {
      title: "Sleep, recovery and daily habits",
      stack: true,
      rows: [
        { label: "Sleep", value: shown(intake.sleepHours) },
        { label: "Same time daily", value: shown(intake.sleepSameTime, YES_NO_LABELS) },
        { label: "Morning puffiness", value: shown(intake.morningPuffiness, { never: "Never", sometimes: "Sometimes", daily: "Daily" }) },
        { label: "Resting heart rate or HRV", value: shown(intake.heartRateTrend) },
        { label: "Unusually tired days", value: shown(intake.tiredDays) },
        { label: "Illness and digestion", value: shown(intake.illnessAndDigestion) },
        { label: "Flare-ups", value: shown(intake.flareUps) },
        { label: "Alcohol and nicotine", value: shown(intake.alcoholAndNicotine) },
        { label: "Water and salt", value: shown(intake.waterAndSalt) },
        { label: "Stress", value: intake.stressOutOf10 === null ? "Not answered" : `${intake.stressOutOf10} / 10` },
        { label: "Sun and sunscreen", value: shown(intake.sunAndSunscreen) },
        { label: "Training phase", value: shown(intake.trainingPhase, { heavy: "Heavy training", steady: "Steady", burntOut: "Burnt out" }) },
      ],
    },
    {
      title: "How you want this written",
      stack: true,
      rows: [
        { label: "Tone", value: shown(intake.reportTone, { blunt: "Very blunt and direct", gentle: "Honest but gentle" }) },
        { label: "Order", value: shown(intake.reportOrder, { measurementsFirst: "Measurements first", planFirst: "Action plan first" }) },
        { label: "Example after photo", value: shown(intake.wantAfterPhoto, { yes: "Yes — an example of the direction, not a promise", no: "No" }) },
      ],
    },
  ];
}
