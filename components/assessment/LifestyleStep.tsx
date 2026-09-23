"use client";

import { StepNav } from "./StepNav";
import { SingleChoiceGroup, MultiChoiceGroup } from "./ChoiceGroup";
import type { LifestyleProfile } from "@/lib/assessment/types.ts";

export const SLEEP_OPTIONS: { value: NonNullable<LifestyleProfile["sleepHours"]>; label: string }[] = [
  { value: "lessThan5", label: "Less than 5 hours" },
  { value: "5to6", label: "5–6" },
  { value: "6to7", label: "6–7" },
  { value: "7to8", label: "7–8" },
  { value: "8plus", label: "8+" },
];

export const EXERCISE_OPTIONS: { value: NonNullable<LifestyleProfile["exerciseFrequency"]>; label: string }[] = [
  { value: "none", label: "None" },
  { value: "1to2PerWeek", label: "1–2 days/week" },
  { value: "3to4PerWeek", label: "3–4 days/week" },
  { value: "5plusPerWeek", label: "5+ days/week" },
];

export const TRAINING_OPTIONS: { value: LifestyleProfile["trainingTypes"][number]; label: string }[] = [
  { value: "strength", label: "Strength" },
  { value: "cardio", label: "Cardio" },
  { value: "sports", label: "Sports" },
  { value: "walking", label: "Walking" },
  { value: "other", label: "Other" },
];

export const ACTIVITY_OPTIONS: { value: NonNullable<LifestyleProfile["dailyActivity"]>; label: string }[] = [
  { value: "sedentary", label: "Mostly sedentary" },
  { value: "lightlyActive", label: "Lightly active" },
  { value: "moderatelyActive", label: "Moderately active" },
  { value: "veryActive", label: "Very active" },
];

export const WATER_OPTIONS: { value: NonNullable<LifestyleProfile["waterIntake"]>; label: string }[] = [
  { value: "lessThan1L", label: "Less than 1L" },
  { value: "1to2L", label: "1–2L" },
  { value: "2to3L", label: "2–3L" },
  { value: "3LPlus", label: "3L+" },
];

interface LifestyleStepProps {
  value: LifestyleProfile;
  onChange: (next: LifestyleProfile) => void;
  onNext: () => void;
  onBack: () => void;
}

export function LifestyleStep({ value, onChange, onNext, onBack }: LifestyleStepProps) {
  return (
    <div>
      <h2 className="font-serif text-2xl tracking-tight">Lifestyle</h2>
      <p className="mt-2 text-sm text-muted">
        High-level context only — this doesn&apos;t produce medical advice.
      </p>

      <div className="mt-8 space-y-8">
        <SingleChoiceGroup
          label="Sleep"
          options={SLEEP_OPTIONS}
          value={value.sleepHours}
          onChange={(sleepHours) => onChange({ ...value, sleepHours })}
        />
        <SingleChoiceGroup
          label="Exercise"
          options={EXERCISE_OPTIONS}
          value={value.exerciseFrequency}
          onChange={(exerciseFrequency) => onChange({ ...value, exerciseFrequency })}
        />
        <MultiChoiceGroup
          label="Training type"
          options={TRAINING_OPTIONS}
          value={value.trainingTypes}
          onChange={(trainingTypes) => onChange({ ...value, trainingTypes })}
        />
        <SingleChoiceGroup
          label="Daily activity"
          options={ACTIVITY_OPTIONS}
          value={value.dailyActivity}
          onChange={(dailyActivity) => onChange({ ...value, dailyActivity })}
        />
        <SingleChoiceGroup
          label="Water intake"
          options={WATER_OPTIONS}
          value={value.waterIntake}
          onChange={(waterIntake) => onChange({ ...value, waterIntake })}
        />
      </div>

      <StepNav onBack={onBack} onNext={onNext} />
    </div>
  );
}
