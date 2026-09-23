export const ANALYSIS_STEPS = [
  "Uploading",
  "Checking photo",
  "Detecting face",
  "Mapping landmarks",
  "Calculating measurements",
  "Preparing results",
] as const;

export type AnalysisStep = (typeof ANALYSIS_STEPS)[number];

export function AnalysisProgress({ currentStep }: { currentStep: AnalysisStep }) {
  const currentIndex = ANALYSIS_STEPS.indexOf(currentStep);

  return (
    <div role="status" aria-live="polite" className="mx-auto max-w-sm">
      <ul className="space-y-3">
        {ANALYSIS_STEPS.map((step, index) => {
          const state = index < currentIndex ? "done" : index === currentIndex ? "active" : "pending";
          return (
            <li key={step} className="flex items-center gap-3 text-sm">
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${
                  state === "pending" ? "bg-border" : state === "active" ? "animate-pulse bg-accent" : "bg-accent"
                }`}
              />
              <span className={state === "pending" ? "text-muted" : "text-foreground"}>{step}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
