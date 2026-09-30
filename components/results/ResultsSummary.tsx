import type { ReportView } from "@/lib/results/reportView.ts";

/**
 * The opening of the results document: title, a short line, and the jump
 * into the written report. The faces sit in the section immediately below
 * this, so this block stays short enough that the pair is on the first screen.
 * Pure presentation — no new analysis.
 */
export function ResultsSummary({ view }: { view: ReportView }) {
  return (
    <header className="text-center">
      <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-gold-text">{view.cover.eyebrow}</p>
      <h1 id="summary-heading" className="mx-auto mt-5 max-w-2xl font-serif text-[2.6rem] leading-[1.02] tracking-tight sm:text-6xl">
        {view.cover.title}
      </h1>
      <div aria-hidden className="mx-auto mt-6 h-px w-14 bg-accent" />
      <p className="mx-auto mt-6 max-w-xl text-base leading-7 text-muted">{view.cover.intro}</p>
      <p className="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] uppercase tracking-[0.18em] text-muted">
        <span>MogaFace</span>
        {view.cover.dateLabel && <span>Prepared {view.cover.dateLabel}</span>}
        {view.cover.badge && <span>{view.cover.badge}</span>}
      </p>
      <a id="summary-cta" href="#full-report" className="mt-6 inline-block text-sm text-foreground underline decoration-accent decoration-1 underline-offset-4 hover:text-accent">
        See full results
      </a>
    </header>
  );
}
