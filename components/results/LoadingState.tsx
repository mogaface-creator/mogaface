import type { ResultStage } from "@/lib/results/types.ts";

const COPY: Partial<Record<ResultStage, { title: string; body: string }>> = {
  analyzing: { title: "Analyzing your assessment…", body: "Bringing together your answers and photos." },
  interpreting: { title: "Reviewing your goals and facial observations…", body: "Turning what was observed into something you can read." },
  preparing_visualization: { title: "Preparing your illustrative visualization…", body: "This can take a moment." },
};

export function LoadingState({ stage }: { stage: ResultStage }) {
  const copy = COPY[stage] ?? COPY.analyzing!;
  return (
    <div role="status" aria-live="polite" className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center text-center">
      <span className="h-1.5 w-24 overflow-hidden rounded-full bg-border">
        <span className="block h-full w-1/2 animate-pulse rounded-full bg-accent" />
      </span>
      <h1 className="mt-10 font-serif text-2xl tracking-tight">{copy.title}</h1>
      <p className="mt-3 text-sm text-muted">{copy.body}</p>
    </div>
  );
}
