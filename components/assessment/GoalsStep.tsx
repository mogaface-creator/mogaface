"use client";

import { StepNav } from "./StepNav";
import { MultiChoiceGroup } from "./ChoiceGroup";
import type { Goals } from "@/lib/assessment/types.ts";

export const GOAL_AREA_OPTIONS: { value: Goals["areas"][number]; label: string }[] = [
  { value: "face", label: "Face" },
  { value: "skin", label: "Skin" },
  { value: "hair", label: "Hair" },
  { value: "facialHair", label: "Facial hair" },
  { value: "jawDefinition", label: "Jaw / facial definition" },
  { value: "bodyComposition", label: "Body composition" },
  { value: "posture", label: "Posture" },
  { value: "style", label: "Style" },
  { value: "overallAppearance", label: "Overall appearance" },
];

export const GOAL_PRIORITY_OPTIONS: { value: Goals["priorities"][number]; label: string }[] = [
  { value: "lookMoreDefined", label: "Look more defined" },
  { value: "improveSkin", label: "Improve skin appearance" },
  { value: "improveHair", label: "Improve hair" },
  { value: "improveFacialFraming", label: "Improve facial framing" },
  { value: "improveGrooming", label: "Improve grooming" },
  { value: "improvePersonalStyle", label: "Improve personal style" },
  { value: "lookMorePolished", label: "Look more polished" },
  { value: "buildHealthierAppearance", label: "Build a healthier-looking appearance" },
  { value: "overallGlowUp", label: "Overall glow-up" },
];

interface GoalsStepProps {
  value: Goals;
  onChange: (next: Goals) => void;
  onNext: () => void;
  onBack: () => void;
}

export function GoalsStep({ value, onChange, onNext, onBack }: GoalsStepProps) {
  return (
    <div>
      <h2 className="font-serif text-2xl tracking-tight">What would you like to improve?</h2>
      <p className="mt-2 text-sm text-muted">Select everything that applies — this shapes what we focus on.</p>

      <div className="mt-8">
        <MultiChoiceGroup
          label="Areas"
          options={GOAL_AREA_OPTIONS}
          value={value.areas}
          onChange={(areas) => onChange({ ...value, areas })}
        />
      </div>

      <div className="mt-8">
        <MultiChoiceGroup
          label="What matters most to you right now?"
          options={GOAL_PRIORITY_OPTIONS}
          value={value.priorities}
          onChange={(priorities) => onChange({ ...value, priorities })}
          max={3}
        />
      </div>

      <StepNav onBack={onBack} onNext={onNext} nextDisabled={value.areas.length === 0} />
    </div>
  );
}
