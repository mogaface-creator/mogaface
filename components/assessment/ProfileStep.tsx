"use client";

import { StepNav } from "./StepNav";
import { SingleChoiceGroup } from "./ChoiceGroup";
import type { Profile } from "@/lib/assessment/types.ts";

export const GENDER_OPTIONS: { value: NonNullable<Profile["genderPresentation"]>; label: string }[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "nonBinary", label: "Non-binary" },
  { value: "preferNotToSay", label: "Prefer not to say" },
];

function numberOrNull(raw: string): number | null {
  if (raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function isValid(value: Profile): boolean {
  return (
    value.ageYears !== null &&
    value.ageYears >= 13 &&
    value.ageYears <= 100 &&
    value.heightCm !== null &&
    value.heightCm >= 100 &&
    value.heightCm <= 250 &&
    value.weightKg !== null &&
    value.weightKg >= 30 &&
    value.weightKg <= 250
  );
}

interface ProfileStepProps {
  value: Profile;
  onChange: (next: Profile) => void;
  onNext: () => void;
  onBack: () => void;
}

export function ProfileStep({ value, onChange, onNext, onBack }: ProfileStepProps) {
  return (
    <div>
      <h2 className="font-serif text-2xl tracking-tight">Basic profile</h2>
      <p className="mt-2 text-sm text-muted">Used only to give your future protocol useful context.</p>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium">Age (years)</span>
          <input
            type="number"
            inputMode="numeric"
            min={13}
            max={100}
            value={value.ageYears ?? ""}
            onChange={(e) => onChange({ ...value, ageYears: numberOrNull(e.target.value) })}
            className="mt-2 w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Height (cm)</span>
          <input
            type="number"
            inputMode="numeric"
            min={100}
            max={250}
            value={value.heightCm ?? ""}
            onChange={(e) => onChange({ ...value, heightCm: numberOrNull(e.target.value) })}
            className="mt-2 w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium">Weight (kg)</span>
          <input
            type="number"
            inputMode="numeric"
            min={30}
            max={250}
            value={value.weightKg ?? ""}
            onChange={(e) => onChange({ ...value, weightKg: numberOrNull(e.target.value) })}
            className="mt-2 w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </label>
      </div>

      <div className="mt-8">
        <SingleChoiceGroup
          label="Gender presentation (optional, only if relevant to your goals)"
          options={GENDER_OPTIONS}
          value={value.genderPresentation}
          onChange={(genderPresentation) => onChange({ ...value, genderPresentation })}
        />
      </div>

      <StepNav onBack={onBack} onNext={onNext} nextDisabled={!isValid(value)} />
    </div>
  );
}
