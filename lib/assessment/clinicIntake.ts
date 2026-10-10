/**
 * Clinic intake. These answers are what the person told us. They are not a
 * diagnosis, not a treatment recommendation, and they are never copied into
 * an image prompt. The after image still follows appearanceConcerns and hair
 * concerns only — see projectPlaces.
 */

import { createEmptyAppearanceConcerns, parentOfDetail, toggleConcern, toggleDetail, type AppearanceConcernId } from "./appearanceConcerns.ts";
import { allAsks, INTAKE_QUESTIONS, type Ask } from "./intakeQuestions.ts";
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

export const TRAINING_PHASE = ["heavy", "steady", "burntOut", "neither"] as const;
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
  /** One answer per ask id. Older intakes load with an empty map. */
  reply: Record<string, string>;
  /** Multi-select asks, keyed by ask id. */
  picked: Record<string, string[]>;
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
    reply: {},
    picked: {},
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

function sanitizeReply(value: unknown): Record<string, string> {
  const source = isObject(value) ? value : {};
  const reply: Record<string, string> = {};
  for (const ask of allAsks()) {
    if (ask.kind === "multi" || ask.kind === "dislikes" || ask.kind === "places" || ask.kind === "details" || ask.kind === "height" || ask.kind === "weight") continue;
    const raw = source[ask.id];
    if (ask.kind === "yesno") reply[ask.id] = oneOf(raw, YES_NO) ?? "";
    else if (ask.kind === "choice") reply[ask.id] = oneOf(raw, (ask.options ?? []).map((option) => option.value)) ?? "";
    else if (ask.kind === "score") {
      const n = typeof raw === "string" ? Number(raw) : raw;
      const s = score(n);
      reply[ask.id] = s === null ? "" : String(s);
    } else reply[ask.id] = text(raw);
  }
  return reply;
}

function sanitizePicked(value: unknown): Record<string, string[]> {
  const source = isObject(value) ? value : {};
  const picked: Record<string, string[]> = {};
  for (const ask of allAsks()) {
    if (ask.kind !== "multi") continue;
    picked[ask.id] = listOf(source[ask.id], (ask.options ?? []).map((option) => option.value), ask.max ?? (ask.options?.length ?? 0));
  }
  return picked;
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
    reply: sanitizeReply(value.reply),
    picked: sanitizePicked(value.picked),
  };
}

export function replyOf(intake: ClinicIntake, id: string): string {
  const stored = intake.reply?.[id];
  if (typeof stored === "string" && stored.length > 0) return stored;
  if (id === "ageConfirmed") return intake.ageConfirmed ?? "";
  if (id === "directWordsOk") return intake.directWordsOk ?? "";
  if (id === "toldWorriesMore") return intake.toldWorriesMore ?? "";
  if (id === "botherScore") return intake.botherScore === null ? "" : String(intake.botherScore);
  if (id === "stressOutOf10") return intake.stressOutOf10 === null ? "" : String(intake.stressOutOf10);
  if (id === "mirrorTime") return intake.mirrorTime;
  if (id === "reportWant") return intake.reportWant ?? "";
  if (id === "event") return intake.event;
  if (id === "spendNext12Months") return intake.spendNext12Months;
  if (id === "maxWilling") return intake.maxWilling ?? "";
  if (id === "downtime") return intake.downtime ?? "";
  if (id === "priorTreatments") return intake.priorTreatments;
  if (id === "reportTone") return intake.reportTone ?? "";
  if (id === "reportOrder") return intake.reportOrder ?? "";
  if (id === "wantAfterPhoto") return intake.wantAfterPhoto ?? "";
  if (id === "morningPuffiness") return intake.morningPuffiness ?? "";
  if (id === "trainingPhase") return intake.trainingPhase ?? "";
  if (id === "pregnantOrBreastfeeding") return intake.pregnantOrBreastfeeding ?? "";
  return "";
}

export function pickedOf(intake: ClinicIntake, id: string): string[] {
  const stored = intake.picked?.[id];
  if (Array.isArray(stored) && stored.length > 0) return stored;
  if (id === "lookDirections") return intake.lookDirections;
  if (id === "skinProblems") return intake.skinProblems;
  return [];
}

function answerMatches(intake: ClinicIntake, id: string, when: NonNullable<Ask["when"]>): boolean {
  if (when.filled) return replyOf(intake, id).trim().length > 0 || pickedOf(intake, id).length > 0;
  const expected = when.is ?? "";
  return replyOf(intake, id) === expected || pickedOf(intake, id).includes(expected);
}

export function askVisible(intake: ClinicIntake, ask: Ask): boolean {
  if (!ask.when) return true;
  if (ask.when.id) return answerMatches(intake, ask.when.id, ask.when);
  return (ask.when.any ?? []).some((id) => answerMatches(intake, id, ask.when!));
}

/** Writes one ask, and keeps the older single fields the rest of the app already reads. */
export function setAnswer(assessment: Assessment, id: string, value: string): Assessment {
  const reply = { ...assessment.clinicIntake.reply, [id]: value };
  const partial: Partial<ClinicIntake> = { reply };
  if ((id === "ageConfirmed" || id === "directWordsOk" || id === "wantAfterPhoto") && (value === "yes" || value === "no" || value === "")) {
    partial[id] = value === "" ? null : value;
  }
  if (id === "toldWorriesMore" && (value === "yes" || value === "no" || value === "")) partial.toldWorriesMore = value === "" ? null : value;
  if (id === "botherScore" || id === "stressOutOf10") {
    const scored = value === "" ? null : score(Number(value));
    partial.reply = { ...reply, [id]: scored === null ? "" : String(scored) };
    if (id === "botherScore") partial.botherScore = scored;
    else partial.stressOutOf10 = scored;
  }
  if (id === "mirrorTime") partial.mirrorTime = value;
  if (id === "event") partial.event = value;
  if (id === "spendNext12Months") partial.spendNext12Months = value;
  if (id === "priorTreatments") partial.priorTreatments = value;
  if (id === "reportWant") partial.reportWant = oneOf(value, REPORT_WANTS);
  if (id === "maxWilling") partial.maxWilling = oneOf(value, MAX_WILLING);
  if (id === "downtime") partial.downtime = oneOf(value, DOWNTIME);
  if (id === "reportTone") partial.reportTone = oneOf(value, REPORT_TONE);
  if (id === "reportOrder") partial.reportOrder = oneOf(value, REPORT_ORDER);
  if (id === "morningPuffiness") partial.morningPuffiness = oneOf(value, PUFFINESS);
  if (id === "trainingPhase") partial.trainingPhase = oneOf(value, TRAINING_PHASE);
  if (id === "pregnantOrBreastfeeding") partial.pregnantOrBreastfeeding = oneOf(value, PREGNANCY);
  if (id === "dislikeDuration") {
    const ask = allAsks().find((item) => item.id === id);
    const label = ask?.options?.find((option) => option.value === value)?.label ?? "";
    const dislikes = assessment.clinicIntake.dislikes.map((item, index) => (index === 0 ? { ...item, duration: label } : item)) as ClinicIntake["dislikes"];
    partial.dislikes = dislikes;
  }
  return withIntake(assessment, partial);
}

export function setPicked(assessment: Assessment, id: string, values: string[]): Assessment {
  const ask = allAsks().find((item) => item.id === id);
  const allowed = (ask?.options ?? []).map((option) => option.value);
  let nextValues = listOf(values, allowed, ask?.max ?? allowed.length);
  if (id === "clinicFlags") {
    const hadNone = (assessment.clinicIntake.picked.clinicFlags ?? []).includes("none");
    nextValues = nextValues.includes("none") && !hadNone ? ["none"] : nextValues.filter((value) => value !== "none");
  }
  const picked = { ...assessment.clinicIntake.picked, [id]: nextValues };
  const partial: Partial<ClinicIntake> = { picked };
  if (id === "lookDirections") partial.lookDirections = nextValues as LookDirection[];
  if (id === "skinProblems") partial.skinProblems = nextValues as SkinProblem[];
  if (id === "clinicFlags") partial.pregnantOrBreastfeeding = nextValues.includes("pregnant") ? "yes" : "no";
  return withIntake(assessment, partial);
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
    clinicIntake: {
      ...assessment.clinicIntake,
      heightCm: typeof heightCm === "number" && Number.isFinite(heightCm) && heightCm > 0 ? heightCm : null,
      weightKg: typeof weightKg === "number" && Number.isFinite(weightKg) && weightKg > 0 ? weightKg : null,
    },
    profile: { ...assessment.profile, heightCm: height, weightKg: weight },
  };
}

export function withIntake(assessment: Assessment, partial: Partial<ClinicIntake>): Assessment {
  const intake = { ...assessment.clinicIntake, ...partial };
  const areas = hasAGoal(intake) && assessment.goals.areas.length === 0 ? (["face"] as const) : assessment.goals.areas;
  return { ...assessment, clinicIntake: intake, goals: { ...assessment.goals, areas: [...areas] } };
}

function labelFor(ask: Ask, value: string): string {
  if (!value) return "Not answered";
  return ask.options?.find((option) => option.value === value)?.label ?? (value === "yes" ? "Yes" : value === "no" ? "No" : value);
}

const SECTION_TITLES: Record<string, string> = {
  about: "About you and your goals",
  comfort: "What you are comfortable with",
  breathing: "Breathing, teeth and jaw",
  body: "Body, fitness and weight",
  skin: "Skin and health",
  recovery: "Sleep, recovery and inflammation",
  report: "How you want the report",
};

export function intakeReviewSections(intake: ClinicIntake): { title: string; rows: { label: string; value: string }[]; stack: true }[] {
  return (["about", "comfort", "breathing", "body", "skin", "recovery", "report"] as const).map((section) => {
    const rows: { label: string; value: string }[] = [];
    for (const question of INTAKE_QUESTIONS.filter((item) => item.section === section)) {
      for (const ask of question.asks) {
        if (!askVisible(intake, ask)) continue;
        if (ask.kind === "dislikes") {
          const filled = intake.dislikes.filter((dislike) => dislike.words.trim().length > 0);
          rows.push({
            label: ask.prompt,
            value: filled.length
              ? filled.map((dislike) => (dislike.duration ? `${dislike.words} — for ${dislike.duration}` : dislike.words)).join("; ")
              : "Not answered",
          });
        } else if (ask.kind === "details") {
          continue;
        } else if (ask.kind === "places") {
          const labels = intake.places.map((place) => ask.options?.find((option) => option.value === place)?.label ?? place);
          rows.push({ label: ask.prompt, value: labels.length ? labels.join(", ") : "Not answered" });
        } else if (ask.kind === "height") {
          rows.push({ label: ask.prompt, value: intake.heightCm === null ? "Not answered" : `${intake.heightCm} cm` });
        } else if (ask.kind === "weight") {
          rows.push({ label: ask.prompt, value: intake.weightKg === null ? "Not answered" : `${intake.weightKg} kg` });
        } else if (ask.kind === "multi") {
          const values = pickedOf(intake, ask.id);
          rows.push({ label: ask.prompt, value: values.length ? values.map((value) => labelFor(ask, value)).join(", ") : "Not answered" });
        } else {
          rows.push({ label: ask.prompt, value: labelFor(ask, replyOf(intake, ask.id)) });
        }
      }
    }
    return { title: SECTION_TITLES[section], rows, stack: true as const };
  }).filter((section) => section.rows.length > 0);
}
