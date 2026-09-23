export const ASSESSMENT_PROGRESS_STEPS = [
  "Profile",
  "Goals",
  "Hair",
  "Facial Hair",
  "Lifestyle",
  "Style",
  "Photos",
  "Review",
] as const;

interface AssessmentProgressProps {
  /** 0-indexed into ASSESSMENT_PROGRESS_STEPS. */
  currentStep: number;
}

export function AssessmentProgress({ currentStep }: AssessmentProgressProps) {
  const total = ASSESSMENT_PROGRESS_STEPS.length;
  const label = ASSESSMENT_PROGRESS_STEPS[currentStep] ?? "";
  const percent = ((currentStep + 1) / total) * 100;

  return (
    <div role="status" aria-live="polite">
      <div className="flex items-baseline justify-between text-xs text-muted">
        <span>
          {String(currentStep + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </span>
        <span>{label}</span>
      </div>
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-border">
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
