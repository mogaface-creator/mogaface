"use client";

import { StepNav } from "./StepNav";
import { SingleChoiceGroup, MultiChoiceGroup } from "./ChoiceGroup";
import type { FacialHairProfile } from "@/lib/assessment/types.ts";

export const STYLE_OPTIONS: { value: NonNullable<FacialHairProfile["currentStyle"]>; label: string }[] = [
  { value: "cleanShaven", label: "Clean shaven" },
  { value: "stubble", label: "Stubble" },
  { value: "shortBeard", label: "Short beard" },
  { value: "mediumBeard", label: "Medium beard" },
  { value: "longBeard", label: "Long beard" },
  { value: "mustache", label: "Mustache" },
  { value: "varies", label: "Varies" },
];

export const IMPROVEMENT_OPTIONS: { value: FacialHairProfile["improvements"][number]; label: string }[] = [
  { value: "shape", label: "Shape" },
  { value: "density", label: "Density" },
  { value: "length", label: "Length" },
  { value: "cheekLine", label: "Cheek line" },
  { value: "neckline", label: "Neckline" },
  { value: "grooming", label: "Grooming" },
  { value: "notApplicable", label: "Not applicable" },
];

interface FacialHairStepProps {
  value: FacialHairProfile;
  onChange: (next: FacialHairProfile) => void;
  onNext: () => void;
  onBack: () => void;
}

export function FacialHairStep({ value, onChange, onNext, onBack }: FacialHairStepProps) {
  return (
    <div>
      <h2 className="font-serif text-2xl tracking-tight">Facial hair</h2>

      <div className="mt-8 space-y-8">
        <SingleChoiceGroup
          label="How do you currently wear your facial hair?"
          options={STYLE_OPTIONS}
          value={value.currentStyle}
          onChange={(currentStyle) => onChange({ ...value, currentStyle })}
        />
        <MultiChoiceGroup
          label="What would you like to improve?"
          options={IMPROVEMENT_OPTIONS}
          value={value.improvements}
          onChange={(improvements) => onChange({ ...value, improvements })}
        />
      </div>

      <StepNav onBack={onBack} onNext={onNext} />
    </div>
  );
}
