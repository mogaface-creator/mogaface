import type { ConsumerResultView } from "@/lib/results/consumer.ts";
import type { ConsultationCta } from "@/lib/results/config.ts";

/**
 * The consumer-facing result. Presentation only: it receives plain copy from
 * toConsumerView() and has no access to observations, evidence, thresholds,
 * calibration state, versions, or debug data — so it cannot show them.
 */

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-serif text-2xl tracking-tight sm:text-3xl">{children}</h2>;
}

function Visualization({ view }: { view: ConsumerResultView["visualization"] }) {
  if (view.state !== "ready") {
    return (
      <div className="rounded-3xl border border-border bg-surface px-8 py-14 text-center sm:px-16">
        <h3 className="font-serif text-2xl tracking-tight">{view.title}</h3>
        <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-muted">{view.body}</p>
      </div>
    );
  }
  return (
    <div>
      <div className="grid gap-6 sm:grid-cols-2">
        <figure>
          <div className="aspect-[4/5] overflow-hidden rounded-3xl border border-border bg-surface">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={view.beforeUrl} alt="Your front photo" className="h-full w-full object-cover" />
          </div>
          <figcaption className="mt-3 text-xs font-medium uppercase tracking-wide text-muted">Before</figcaption>
        </figure>
        <figure>
          <div className="relative aspect-[4/5] overflow-hidden rounded-3xl border border-border bg-surface">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={view.afterUrl} alt="Illustrative visualization" className="h-full w-full object-cover" />
            {view.isMock && (
              <span className="absolute left-3 top-3 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900">Mock image — development only</span>
            )}
          </div>
          <figcaption className="mt-3 text-xs font-medium uppercase tracking-wide text-muted">Illustrative after</figcaption>
        </figure>
      </div>

      <p className="mt-6 text-sm text-muted">
        <span className="font-medium text-foreground">{view.label}.</span> {view.notice}
      </p>

      {view.changes.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-medium uppercase tracking-wide text-muted">What changed</h3>
          <ul className="mt-3 space-y-2 text-base leading-7">
            {view.changes.map((c) => (
              <li key={c} className="flex gap-3">
                <span aria-hidden className="mt-3 h-1 w-1 shrink-0 rounded-full bg-accent" />
                {c}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function ConsumerResult({ view, cta }: { view: ConsumerResultView; cta: ConsultationCta }) {
  const external = /^https?:/i.test(cta.href);
  return (
    <div className="space-y-24 sm:space-y-28">
      <header>
        <p className="text-sm font-medium uppercase tracking-wide text-muted">{view.headline}</p>
        <h1 className="mt-4 max-w-2xl font-serif text-4xl leading-tight tracking-tight sm:text-5xl">{view.intro}</h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-muted">{view.summary}</p>
      </header>

      {view.priorities.length > 0 && (
        <section aria-labelledby="priorities">
          <div id="priorities">
            <SectionTitle>Your priorities</SectionTitle>
          </div>
          <ol className="mt-8 divide-y divide-border border-y border-border">
            {view.priorities.map((p, i) => (
              <li key={p} className="flex items-baseline gap-6 py-5">
                <span className="w-10 shrink-0 font-serif text-2xl text-muted">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-lg">{p}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {view.keyObservations.length > 0 && (
        <section aria-labelledby="observations">
          <div id="observations">
            <SectionTitle>Key observations</SectionTitle>
          </div>
          <ul className="mt-8 space-y-4 text-lg leading-8">
            {view.keyObservations.map((o) => (
              <li key={o} className="max-w-2xl">
                {o}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="areas">
        <div id="areas">
          <SectionTitle>Areas to discuss</SectionTitle>
        </div>
        {view.areas.length > 0 ? (
          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {view.areas.map((a) => (
              <article key={a.title} className="rounded-3xl border border-border bg-surface p-8">
                <h3 className="font-serif text-xl tracking-tight">{a.title}</h3>
                <p className="mt-3 text-base leading-7 text-muted">{a.body}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-8 max-w-2xl text-lg leading-8 text-muted">
            There aren&apos;t enough visual observations yet to point to specific areas. Your priorities above are still a good starting point for a conversation with your clinician.
          </p>
        )}

        {view.notEstablished.length > 0 && (
          <details className="mt-8 rounded-2xl border border-border px-6 py-5">
            <summary className="cursor-pointer text-sm font-medium">What we couldn&apos;t assess from these images</summary>
            <ul className="mt-4 space-y-4 text-sm leading-6 text-muted">
              {view.notEstablished.map((n) => (
                <li key={n.title}>
                  <span className="font-medium text-foreground">{n.title}.</span> {n.body}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      <section aria-labelledby="visualization">
        <div id="visualization">
          <SectionTitle>Illustrative visualization</SectionTitle>
        </div>
        <div className="mt-8">
          <Visualization view={view.visualization} />
        </div>
      </section>

      <section aria-labelledby="clinician" className="rounded-3xl bg-surface px-8 py-12 sm:px-14">
        <div id="clinician">
          <SectionTitle>Clinician review</SectionTitle>
        </div>
        <p className="mt-6 max-w-2xl text-lg leading-8">{view.clinicianNote}</p>
        <div className="mt-10">
          <a
            href={cta.href}
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            className="inline-flex items-center justify-center rounded-full bg-accent px-8 py-4 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {cta.label}
          </a>
        </div>
      </section>

      <details className="text-sm text-muted">
        <summary className="cursor-pointer">About this assessment</summary>
        <ul className="mt-4 list-disc space-y-2 pl-5">
          {view.limitations.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
