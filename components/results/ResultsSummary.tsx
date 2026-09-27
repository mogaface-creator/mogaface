import type { ReportView } from "@/lib/results/reportView.ts";
import { topPriorities } from "@/lib/results/summary.ts";

/**
 * The compact, mobile-first summary shown at the very top of the Results
 * experience: headline, the person's real front photo (when available —
 * never a demo or placeholder image), their top priorities, and a single
 * primary action that jumps to the full report below. Pure presentation over
 * data the full report already computes (view.priorities, view.visualization.beforeUrl)
 * — no new analysis, evidence, or eligibility logic.
 */
export function ResultsSummary({ view }: { view: ReportView }) {
  const priorities = topPriorities(view);
  const beforeUrl = view.visualization.beforeUrl;

  return (
    <section aria-labelledby="summary-heading" className="rounded-[2rem] border border-border bg-surface p-6 sm:p-10">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">{view.cover.eyebrow}</p>
      <h1 id="summary-heading" className="mt-3 font-serif text-3xl leading-[1.1] tracking-tight sm:text-4xl">
        {view.cover.title}
      </h1>

      {beforeUrl && (
        <div className="mt-6 overflow-hidden rounded-3xl border border-border bg-background">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={beforeUrl} alt="Your photo" className="aspect-[4/5] w-full object-cover" />
        </div>
      )}

      {priorities.length > 0 && (
        <div className="mt-8">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">What matters most to you</p>
          <ul className="mt-4 space-y-3">
            {priorities.map((p) => (
              <li key={p.number} className="rounded-2xl border border-border bg-background p-4">
                <h2 className="font-serif text-lg leading-snug tracking-tight">{p.concern}</h2>
                <p className="mt-1.5 text-sm leading-6 text-muted">{p.why}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <a
        id="summary-cta"
        href="#full-report"
        className="mt-8 flex w-full items-center justify-center rounded-full bg-accent px-8 py-4 text-base font-medium text-accent-foreground transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:w-auto"
      >
        See full results
      </a>
    </section>
  );
}
