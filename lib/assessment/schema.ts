/**
 * Runtime validation for the Assessment data model.
 *
 * `sanitizeAssessment` is the single gate between "whatever was in
 * localStorage" and code that trusts an `Assessment` shape — malformed or
 * schema-mismatched data is discarded (returns null) rather than crashing
 * the app or silently coercing bad data.
 */

import { createEmptyAppearanceConcerns, sanitizeAppearanceConcerns } from "./appearanceConcerns.ts";
import { ASSESSMENT_VERSION, PHOTO_SLOTS, REQUIRED_PHOTO_SLOTS, type Assessment } from "./types.ts";

const GENDER_PRESENTATIONS = ["male", "female", "nonBinary", "preferNotToSay"] as const;
const GOAL_AREAS = [
  "face",
  "skin",
  "hair",
  "facialHair",
  "jawDefinition",
  "bodyComposition",
  "posture",
  "style",
  "overallAppearance",
] as const;
const GOAL_PRIORITIES = [
  "lookMoreDefined",
  "improveSkin",
  "improveHair",
  "improveFacialFraming",
  "improveGrooming",
  "improvePersonalStyle",
  "lookMorePolished",
  "buildHealthierAppearance",
  "overallGlowUp",
] as const;
const HAIR_LENGTHS = ["veryShort", "short", "medium", "long"] as const;
const HAIR_TEXTURES = ["straight", "wavy", "curly", "coily", "notSure"] as const;
const HAIR_DENSITIES = ["low", "medium", "high", "notSure"] as const;
const HAIR_CONCERNS = ["hairline", "thinning", "dryness", "frizz", "scalp", "styling", "haircut", "none", "other"] as const;
const HAIRCUT_FREQUENCIES = ["every2to4Weeks", "every1to2Months", "every2to3Months", "rarely"] as const;
const FACIAL_HAIR_STYLES = [
  "cleanShaven",
  "stubble",
  "shortBeard",
  "mediumBeard",
  "longBeard",
  "mustache",
  "varies",
] as const;
const FACIAL_HAIR_IMPROVEMENTS = ["shape", "density", "length", "cheekLine", "neckline", "grooming", "notApplicable"] as const;
const SLEEP_HOURS = ["lessThan5", "5to6", "6to7", "7to8", "8plus"] as const;
const EXERCISE_FREQUENCIES = ["none", "1to2PerWeek", "3to4PerWeek", "5plusPerWeek"] as const;
const TRAINING_TYPES = ["strength", "cardio", "sports", "walking", "other"] as const;
const DAILY_ACTIVITIES = ["sedentary", "lightlyActive", "moderatelyActive", "veryActive"] as const;
const WATER_INTAKES = ["lessThan1L", "1to2L", "2to3L", "3LPlus"] as const;
const CURRENT_STYLES = [
  "minimal",
  "casual",
  "smartCasual",
  "professional",
  "streetwear",
  "formal",
  "sporty",
  "experimental",
  "notSure",
] as const;
const STYLE_GOALS = [
  "clean",
  "sophisticated",
  "masculine",
  "feminine",
  "sharp",
  "relaxed",
  "modern",
  "professional",
  "confident",
  "notSure",
] as const;
const MONTHLY_SPENDS = ["under1000", "1000to3000", "3000to10000", "10000plus"] as const;
const PHOTO_SLOT_VALUES = PHOTO_SLOTS.map((p) => p.slot);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

function isNullableOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T | null {
  return value === null || isOneOf(value, allowed);
}

function isArrayOf<T extends string>(value: unknown, allowed: readonly T[]): value is T[] {
  return Array.isArray(value) && value.every((v) => isOneOf(v, allowed));
}

function isNullableFiniteNumber(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function sanitizeProfile(value: unknown): Assessment["profile"] | null {
  if (!isObject(value)) return null;
  if (!isNullableFiniteNumber(value.ageYears)) return null;
  if (!isNullableOneOf(value.genderPresentation, GENDER_PRESENTATIONS)) return null;
  if (!isNullableFiniteNumber(value.heightCm)) return null;
  if (!isNullableFiniteNumber(value.weightKg)) return null;
  return {
    ageYears: value.ageYears as number | null,
    genderPresentation: value.genderPresentation as Assessment["profile"]["genderPresentation"],
    heightCm: value.heightCm as number | null,
    weightKg: value.weightKg as number | null,
  };
}

function sanitizeGoals(value: unknown): Assessment["goals"] | null {
  if (!isObject(value)) return null;
  if (!isArrayOf(value.areas, GOAL_AREAS)) return null;
  if (!isArrayOf(value.priorities, GOAL_PRIORITIES)) return null;
  return { areas: value.areas, priorities: value.priorities.slice(0, 3) };
}

function sanitizeHair(value: unknown): Assessment["hair"] | null {
  if (!isObject(value)) return null;
  if (!isNullableOneOf(value.length, HAIR_LENGTHS)) return null;
  if (!isNullableOneOf(value.texture, HAIR_TEXTURES)) return null;
  if (!isNullableOneOf(value.density, HAIR_DENSITIES)) return null;
  if (!isArrayOf(value.concerns, HAIR_CONCERNS)) return null;
  if (typeof value.currentStyle !== "string") return null;
  if (!isNullableOneOf(value.haircutFrequency, HAIRCUT_FREQUENCIES)) return null;
  return {
    length: value.length,
    texture: value.texture,
    density: value.density,
    concerns: value.concerns,
    currentStyle: value.currentStyle,
    haircutFrequency: value.haircutFrequency,
  };
}

function sanitizeFacialHair(value: unknown): Assessment["facialHair"] | null {
  if (!isObject(value)) return null;
  if (!isNullableOneOf(value.currentStyle, FACIAL_HAIR_STYLES)) return null;
  if (!isArrayOf(value.improvements, FACIAL_HAIR_IMPROVEMENTS)) return null;
  return { currentStyle: value.currentStyle, improvements: value.improvements };
}

function sanitizeLifestyle(value: unknown): Assessment["lifestyle"] | null {
  if (!isObject(value)) return null;
  if (!isNullableOneOf(value.sleepHours, SLEEP_HOURS)) return null;
  if (!isNullableOneOf(value.exerciseFrequency, EXERCISE_FREQUENCIES)) return null;
  if (!isArrayOf(value.trainingTypes, TRAINING_TYPES)) return null;
  if (!isNullableOneOf(value.dailyActivity, DAILY_ACTIVITIES)) return null;
  if (!isNullableOneOf(value.waterIntake, WATER_INTAKES)) return null;
  return {
    sleepHours: value.sleepHours,
    exerciseFrequency: value.exerciseFrequency,
    trainingTypes: value.trainingTypes,
    dailyActivity: value.dailyActivity,
    waterIntake: value.waterIntake,
  };
}

function sanitizeStyle(value: unknown): Assessment["style"] | null {
  if (!isObject(value)) return null;
  if (!isNullableOneOf(value.currentStyle, CURRENT_STYLES)) return null;
  if (!isArrayOf(value.styleGoals, STYLE_GOALS)) return null;
  if (!isNullableOneOf(value.monthlySpend, MONTHLY_SPENDS)) return null;
  return { currentStyle: value.currentStyle, styleGoals: value.styleGoals, monthlySpend: value.monthlySpend };
}

function sanitizePhotos(value: unknown): Assessment["photos"] | null {
  if (!Array.isArray(value)) return null;
  const photos: Assessment["photos"] = [];
  for (const entry of value) {
    if (!isObject(entry)) return null;
    if (!isOneOf(entry.slot, PHOTO_SLOT_VALUES)) return null;
    if (!isNonEmptyString(entry.fileName)) return null;
    if (typeof entry.sizeBytes !== "number" || !Number.isFinite(entry.sizeBytes)) return null;
    if (!isNonEmptyString(entry.uploadedAt)) return null;
    photos.push({
      slot: entry.slot,
      fileName: entry.fileName,
      sizeBytes: entry.sizeBytes,
      uploadedAt: entry.uploadedAt,
    });
  }
  return photos;
}

/** Returns a valid Assessment, or null if `raw` is malformed or from an incompatible schema version. */
export function sanitizeAssessment(raw: unknown): Assessment | null {
  if (!isObject(raw)) return null;
  if (raw.assessmentVersion !== ASSESSMENT_VERSION) return null;
  if (!isNonEmptyString(raw.id) || !isNonEmptyString(raw.createdAt) || !isNonEmptyString(raw.updatedAt)) return null;

  const profile = sanitizeProfile(raw.profile);
  const goals = sanitizeGoals(raw.goals);
  // Absent on assessments saved before this field existed → empty. Present
  // but malformed → the whole assessment is discarded, like every other section.
  const appearanceConcerns =
    raw.appearanceConcerns === undefined ? createEmptyAppearanceConcerns() : sanitizeAppearanceConcerns(raw.appearanceConcerns);
  const hair = sanitizeHair(raw.hair);
  const facialHair = sanitizeFacialHair(raw.facialHair);
  const lifestyle = sanitizeLifestyle(raw.lifestyle);
  const style = sanitizeStyle(raw.style);
  const photos = sanitizePhotos(raw.photos);

  if (!profile || !goals || !appearanceConcerns || !hair || !facialHair || !lifestyle || !style || !photos) return null;

  return {
    id: raw.id,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    assessmentVersion: ASSESSMENT_VERSION,
    profile,
    goals,
    appearanceConcerns,
    hair,
    facialHair,
    lifestyle,
    style,
    photos,
  };
}

export interface AssessmentValidation {
  isComplete: boolean;
  missing: string[];
}

/** Human-friendly gate for the "Start Analysis" action on the review screen. */
export function validateAssessment(assessment: Assessment): AssessmentValidation {
  const missing: string[] = [];

  if (assessment.profile.ageYears === null) missing.push("Age");
  if (assessment.profile.heightCm === null) missing.push("Height");
  if (assessment.profile.weightKg === null) missing.push("Weight");
  if (assessment.goals.areas.length === 0) missing.push("At least one goal");

  const uploadedSlots = new Set(assessment.photos.map((p) => p.slot));
  for (const { slot, label } of PHOTO_SLOTS) {
    if (REQUIRED_PHOTO_SLOTS.includes(slot) && !uploadedSlots.has(slot)) missing.push(`${label} photo`);
  }

  return { isComplete: missing.length === 0, missing };
}
