"use client";

import { StepNav } from "./StepNav";
import { SingleChoiceGroup, MultiChoiceGroup } from "./ChoiceGroup";
import type { StyleProfile } from "@/lib/assessment/types.ts";

export const CURRENT_STYLE_OPTIONS: { value: NonNullable<StyleProfile["currentStyle"]>; label: string }[] = [
  { value: "minimal", label: "Minimal" },
  { value: "casual", label: "Casual" },
  { value: "smartCasual", label: "Smart casual" },
  { value: "professional", label: "Professional" },
  { value: "streetwear", label: "Streetwear" },
  { value: "formal", label: "Formal" },
  { value: "sporty", label: "Sporty" },
  { value: "experimental", label: "Experimental" },
  { value: "notSure", label: "Not sure" },
];

export const STYLE_GOAL_OPTIONS: { value: StyleProfile["styleGoals"][number]; label: string }[] = [
  { value: "clean", label: "Clean" },
  { value: "sophisticated", label: "Sophisticated" },
  { value: "masculine", label: "Masculine" },
  { value: "feminine", label: "Feminine" },
  { value: "sharp", label: "Sharp" },
  { value: "relaxed", label: "Relaxed" },
  { value: "modern", label: "Modern" },
  { value: "professional", label: "Professional" },
  { value: "confident", label: "Confident" },
  { value: "notSure", label: "Not sure" },
];

export const SPEND_OPTIONS: { value: NonNullable<StyleProfile["monthlySpend"]>; label: string }[] = [
  { value: "under1000", label: "Under ₹1,000" },
  { value: "1000to3000", label: "₹1,000–₹3,000" },
  { value: "3000to10000", label: "₹3,000–₹10,000" },
  { value: "10000plus", label: "₹10,000+" },
];

interface StyleStepProps {
  value: StyleProfile;
  onChange: (next: StyleProfile) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StyleStep({ value, onChange, onNext, onBack }: StyleStepProps) {
  return (
    <div>
      <h2 className="font-serif text-2xl tracking-tight">Style profile</h2>
      <p className="mt-2 text-sm text-muted">Only used to personalize future recommendations.</p>

      <div className="mt-8 space-y-8">
        <SingleChoiceGroup
          label="How would you describe your current style?"
          options={CURRENT_STYLE_OPTIONS}
          value={value.currentStyle}
          onChange={(currentStyle) => onChange({ ...value, currentStyle })}
        />
        <MultiChoiceGroup
          label="What would you like your style to communicate?"
          options={STYLE_GOAL_OPTIONS}
          value={value.styleGoals}
          onChange={(styleGoals) => onChange({ ...value, styleGoals })}
        />
        <SingleChoiceGroup
          label="How much do you typically spend on appearance each month?"
          options={SPEND_OPTIONS}
          value={value.monthlySpend}
          onChange={(monthlySpend) => onChange({ ...value, monthlySpend })}
        />
      </div>

      <StepNav onBack={onBack} onNext={onNext} />
    </div>
  );
}
