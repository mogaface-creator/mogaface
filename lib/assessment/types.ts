/**
 * Data model for the MogaFace assessment/onboarding flow.
 *
 * This is purely user-provided context for a future personalization engine
 * (Step 22+ in the project roadmap) — nothing here is scored, diagnosed, or
 * interpreted. No field has a "correct" answer.
 */

export type GenderPresentation = "male" | "female" | "nonBinary" | "preferNotToSay";

export interface Profile {
  ageYears: number | null;
  genderPresentation: GenderPresentation | null;
  heightCm: number | null;
  weightKg: number | null;
}

export type GoalArea =
  | "face"
  | "skin"
  | "hair"
  | "facialHair"
  | "jawDefinition"
  | "bodyComposition"
  | "posture"
  | "style"
  | "overallAppearance";

export type GoalPriority =
  | "lookMoreDefined"
  | "improveSkin"
  | "improveHair"
  | "improveFacialFraming"
  | "improveGrooming"
  | "improvePersonalStyle"
  | "lookMorePolished"
  | "buildHealthierAppearance"
  | "overallGlowUp";

export interface Goals {
  areas: GoalArea[];
  /** Up to 3 — enforced by the UI, not this type. */
  priorities: GoalPriority[];
}

export type HairLength = "veryShort" | "short" | "medium" | "long";
export type HairTexture = "straight" | "wavy" | "curly" | "coily" | "notSure";
export type HairDensity = "low" | "medium" | "high" | "notSure";
export type HairConcern =
  | "hairline"
  | "thinning"
  | "dryness"
  | "frizz"
  | "scalp"
  | "styling"
  | "haircut"
  | "none"
  | "other";
export type HaircutFrequency = "every2to4Weeks" | "every1to2Months" | "every2to3Months" | "rarely";

export interface HairProfile {
  length: HairLength | null;
  texture: HairTexture | null;
  density: HairDensity | null;
  concerns: HairConcern[];
  currentStyle: string;
  haircutFrequency: HaircutFrequency | null;
}

export type FacialHairStyle =
  | "cleanShaven"
  | "stubble"
  | "shortBeard"
  | "mediumBeard"
  | "longBeard"
  | "mustache"
  | "varies";
export type FacialHairImprovement =
  | "shape"
  | "density"
  | "length"
  | "cheekLine"
  | "neckline"
  | "grooming"
  | "notApplicable";

export interface FacialHairProfile {
  currentStyle: FacialHairStyle | null;
  improvements: FacialHairImprovement[];
}

export type SleepHours = "lessThan5" | "5to6" | "6to7" | "7to8" | "8plus";
export type ExerciseFrequency = "none" | "1to2PerWeek" | "3to4PerWeek" | "5plusPerWeek";
export type TrainingType = "strength" | "cardio" | "sports" | "walking" | "other";
export type DailyActivity = "sedentary" | "lightlyActive" | "moderatelyActive" | "veryActive";
export type WaterIntake = "lessThan1L" | "1to2L" | "2to3L" | "3LPlus";

export interface LifestyleProfile {
  sleepHours: SleepHours | null;
  exerciseFrequency: ExerciseFrequency | null;
  trainingTypes: TrainingType[];
  dailyActivity: DailyActivity | null;
  waterIntake: WaterIntake | null;
}

export type CurrentStyle =
  | "minimal"
  | "casual"
  | "smartCasual"
  | "professional"
  | "streetwear"
  | "formal"
  | "sporty"
  | "experimental"
  | "notSure";
export type StyleGoal =
  | "clean"
  | "sophisticated"
  | "masculine"
  | "feminine"
  | "sharp"
  | "relaxed"
  | "modern"
  | "professional"
  | "confident"
  | "notSure";
export type MonthlySpend = "under1000" | "1000to3000" | "3000to10000" | "10000plus";

export interface StyleProfile {
  currentStyle: CurrentStyle | null;
  styleGoals: StyleGoal[];
  monthlySpend: MonthlySpend | null;
}

export type PhotoSlot = "front" | "leftFortyFive" | "rightFortyFive" | "leftProfile" | "rightProfile";

export const PHOTO_SLOTS: { slot: PhotoSlot; label: string }[] = [
  { slot: "front", label: "Front" },
  { slot: "leftFortyFive", label: "Left 45°" },
  { slot: "rightFortyFive", label: "Right 45°" },
  { slot: "leftProfile", label: "Left profile" },
  { slot: "rightProfile", label: "Right profile" },
];

/**
 * Persisted photo metadata only — never the image bytes (see lib/assessment/storage.ts
 * for why). The actual File/preview for the current session lives in
 * component state, keyed by slot, and does not survive a reload.
 */
export interface AssessmentPhoto {
  slot: PhotoSlot;
  fileName: string;
  sizeBytes: number;
  uploadedAt: string;
}

export const ASSESSMENT_VERSION = "0.1.0";

export interface Assessment {
  id: string;
  createdAt: string;
  updatedAt: string;
  assessmentVersion: typeof ASSESSMENT_VERSION;
  profile: Profile;
  goals: Goals;
  hair: HairProfile;
  facialHair: FacialHairProfile;
  lifestyle: LifestyleProfile;
  style: StyleProfile;
  photos: AssessmentPhoto[];
}
