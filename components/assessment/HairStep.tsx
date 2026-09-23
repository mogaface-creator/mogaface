"use client";

import { StepNav } from "./StepNav";
import { SingleChoiceGroup, MultiChoiceGroup } from "./ChoiceGroup";
import type { HairProfile } from "@/lib/assessment/types.ts";

export const LENGTH_OPTIONS: { value: NonNullable<HairProfile["length"]>; label: string }[] = [
  { value: "veryShort", label: "Very short" },
  { value: "short", label: "Short" },
  { value: "medium", label: "Medium" },
  { value: "long", label: "Long" },
];

export const TEXTURE_OPTIONS: { value: NonNullable<HairProfile["texture"]>; label: string }[] = [
  { value: "straight", label: "Straight" },
  { value: "wavy", label: "Wavy" },
  { value: "curly", label: "Curly" },
  { value: "coily", label: "Coily" },
  { value: "notSure", label: "Not sure" },
];

export const DENSITY_OPTIONS: { value: NonNullable<HairProfile["density"]>; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "notSure", label: "Not sure" },
];

export const CONCERN_OPTIONS: { value: HairProfile["concerns"][number]; label: string }[] = [
  { value: "hairline", label: "Hairline" },
  { value: "thinning", label: "Thinning" },
  { value: "dryness", label: "Dryness" },
  { value: "frizz", label: "Frizz" },
  { value: "scalp", label: "Scalp" },
  { value: "styling", label: "Styling" },
  { value: "haircut", label: "Haircut" },
  { value: "none", label: "None" },
  { value: "other", label: "Other" },
];

export const FREQUENCY_OPTIONS: { value: NonNullable<HairProfile["haircutFrequency"]>; label: string }[] = [
  { value: "every2to4Weeks", label: "Every 2–4 weeks" },
  { value: "every1to2Months", label: "Every 1–2 months" },
  { value: "every2to3Months", label: "Every 2–3 months" },
  { value: "rarely", label: "Rarely" },
];

interface HairStepProps {
  value: HairProfile;
  onChange: (next: HairProfile) => void;
  onNext: () => void;
  onBack: () => void;
}

export function HairStep({ value, onChange, onNext, onBack }: HairStepProps) {
  return (
    <div>
      <h2 className="font-serif text-2xl tracking-tight">Hair</h2>
      <p className="mt-2 text-sm text-muted">This helps shape a future hair section of your protocol.</p>

      <div className="mt-8 space-y-8">
        <SingleChoiceGroup
          label="Current length"
          options={LENGTH_OPTIONS}
          value={value.length}
          onChange={(length) => onChange({ ...value, length })}
        />
        <SingleChoiceGroup
          label="Texture"
          options={TEXTURE_OPTIONS}
          value={value.texture}
          onChange={(texture) => onChange({ ...value, texture })}
        />
        <SingleChoiceGroup
          label="Density"
          options={DENSITY_OPTIONS}
          value={value.density}
          onChange={(density) => onChange({ ...value, density })}
        />
        <MultiChoiceGroup
          label="Current concerns"
          options={CONCERN_OPTIONS}
          value={value.concerns}
          onChange={(concerns) => onChange({ ...value, concerns })}
        />
        <label className="block">
          <span className="text-sm font-medium">Current hairstyle</span>
          <input
            type="text"
            value={value.currentStyle}
            onChange={(e) => onChange({ ...value, currentStyle: e.target.value })}
            placeholder="e.g. textured crop, slicked back"
            className="mt-2 w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </label>
        <SingleChoiceGroup
          label="How often do you get a haircut?"
          options={FREQUENCY_OPTIONS}
          value={value.haircutFrequency}
          onChange={(haircutFrequency) => onChange({ ...value, haircutFrequency })}
        />
      </div>

      <StepNav onBack={onBack} onNext={onNext} />
    </div>
  );
}
