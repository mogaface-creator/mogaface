import { VISUALIZATION_DISCLAIMER } from "@/lib/visualization/types.ts";
import type { ConsumerVisualization } from "@/lib/results/consumer.ts";

/**
 * Before → Illustrative after. Presentation only. The "after" frame shows an
 * image only when a provider produced one; otherwise it is an honest,
 * clearly-empty placeholder — never a fake result.
 */

const FRAME = "relative aspect-[4/5] overflow-hidden rounded-3xl";

function Arrow() {
  return (
    <span aria-hidden className="flex items-center justify-center text-muted sm:px-2">
      <svg viewBox="0 0 24 24" className="h-6 w-6 rotate-90 sm:rotate-0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </span>
  );
}

export function VisualizationPanel({ view }: { view: ConsumerVisualization }) {
  const ready = view.state === "ready";
  const before = view.beforeUrl;

  return (
    <div>
      <div className="grid items-center gap-4 sm:grid-cols-[1fr_auto_1fr]">
        <figure>
          <div className={`${FRAME} border border-border bg-surface`}>
            {before ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={before} alt="Your front photo" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center px-8 text-center text-sm text-muted">Your front photo will appear here.</div>
            )}
          </div>
          <figcaption className="mt-3 text-xs font-medium uppercase tracking-[0.18em] text-muted">Before</figcaption>
        </figure>

        <Arrow />

        <figure>
          {view.state === "ready" ? (
            <div className={`${FRAME} border border-border bg-surface`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={view.afterUrl} alt="Illustrative visualization" className="h-full w-full object-cover" />
              {view.isMock && <span className="absolute left-3 top-3 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900">Mock image — development only</span>}
            </div>
          ) : (
            <div className={`${FRAME} flex items-center justify-center border border-dashed border-border bg-surface/60 px-8 text-center`} role="img" aria-label="Illustrative after: not yet available">
              <p className="font-serif text-xl leading-snug tracking-tight text-muted">{view.placeholder}</p>
            </div>
          )}
          <figcaption className="mt-3 text-xs font-medium uppercase tracking-[0.18em] text-muted">Illustrative after</figcaption>
        </figure>
      </div>

      {!ready && (
        <div className="mt-8 max-w-2xl">
          <h3 className="font-serif text-xl tracking-tight">{view.title}</h3>
          <p className="mt-2 text-base leading-7 text-muted">{view.body}</p>
        </div>
      )}

      {(view.state === "ready" ? view.changes : view.plannedChanges).length > 0 && (
        <div className="mt-8">
          <h3 className="text-xs font-medium uppercase tracking-[0.18em] text-muted">{ready ? "What changed" : "What an illustration would show"}</h3>
          <ul className="mt-3 space-y-2 text-base leading-7">
            {(view.state === "ready" ? view.changes : view.plannedChanges).map((c) => (
              <li key={c} className="flex gap-3">
                <span aria-hidden className="mt-3 h-1 w-1 shrink-0 rounded-full bg-accent" />
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-8 text-sm text-muted">
        <span className="font-medium text-foreground">{VISUALIZATION_DISCLAIMER.label}.</span> {VISUALIZATION_DISCLAIMER.notice}
      </p>
    </div>
  );
}
