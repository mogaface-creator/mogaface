interface StepIndicatorProps {
  steps: string[];
  currentStep: number; // 0-indexed
}

export function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
  return (
    <ol className="flex items-center gap-4 text-sm" aria-label="Progress">
      {steps.map((label, index) => {
        const state = index < currentStep ? "done" : index === currentStep ? "current" : "upcoming";
        return (
          <li key={label} className="flex items-center gap-2" aria-current={state === "current" ? "step" : undefined}>
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                state === "upcoming"
                  ? "border border-border text-muted"
                  : "bg-accent text-accent-foreground"
              }`}
            >
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className={state === "upcoming" ? "text-muted" : "text-foreground"}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}
