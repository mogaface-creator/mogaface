import type { ConsultationCta } from "@/lib/results/config.ts";
import type { ReportSectionView, ReportView } from "@/lib/results/reportView.ts";
import { VisualizationPanel } from "./VisualizationPanel";

/**
 * The MogaFace report. Presentation only: it receives plain copy from
 * toReportView() and has no access to observations, evidence ids, thresholds,
 * calibration state or versions, so it cannot show them.
 */

const EYEBROW = "text-xs font-medium uppercase tracking-[0.18em] text-muted";

function Section({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="border-t border-border pt-12">
      <p className={EYEBROW}>{eyebrow}</p>
      <h2 id={id} className="mt-3 font-serif text-3xl tracking-tight sm:text-4xl">
        {title}
      </h2>
      <div className="mt-10">{children}</div>
    </section>
  );
}

const STATUS_DOT = { discuss: "bg-accent", observation_only: "bg-muted", recorded: "border border-muted" } as const;

function StatusBadge({ status, label }: { status: keyof typeof STATUS_DOT; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-muted">
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} />
      {label}
    </span>
  );
}

function DomainRow({ section }: { section: ReportSectionView }) {
  return (
    <div className="grid gap-4 py-8 sm:grid-cols-[13rem_1fr] sm:gap-10">
      <div>
        <h3 className="font-serif text-xl tracking-tight">{section.title}</h3>
        <p className="mt-2 inline-block rounded-full border border-border px-3 py-1 text-xs text-muted">{section.basisLabel}</p>
      </div>
      <div className="max-w-2xl space-y-4 text-base leading-7">
        {section.statements.map((s) => (
          <p key={s.text} className={s.kind === "limitation" ? "text-muted" : undefined}>
            {s.text}
          </p>
        ))}
        {section.howAssessed && (
          <details className="text-sm text-muted">
            <summary className="cursor-pointer">How we assessed this</summary>
            <p className="mt-2">{section.howAssessed}</p>
          </details>
        )}
      </div>
    </div>
  );
}

function DomainGroup({ sections }: { sections: ReportSectionView[] }) {
  return (
    <div className="divide-y divide-border">
      {sections.map((s) => (
        <DomainRow key={s.key} section={s} />
      ))}
    </div>
  );
}

export function Report({ view, cta }: { view: ReportView; cta: ConsultationCta }) {
  const external = /^https?:/i.test(cta.href);
  const observed = view.sections.filter((s) => s.key === "facialStructure" || s.key === "eyeArea" || s.key === "expression");
  const aboutYou = view.sections.filter((s) => !observed.includes(s));

  return (
    <article className="space-y-20 sm:space-y-28">
      <header className="pb-4">
        <div className="flex items-center justify-between gap-4">
          <p className={EYEBROW}>{view.cover.eyebrow}</p>
          <span className="rounded-full border border-border px-3 py-1 text-xs text-muted">{view.cover.badge}</span>
        </div>
        <h1 className="mt-14 font-serif text-4xl leading-[1.05] tracking-tight sm:text-6xl">{view.cover.title}</h1>
        <p className="mt-8 max-w-2xl text-lg leading-8 text-muted">{view.cover.intro}</p>
        {view.cover.dateLabel && <p className="mt-10 text-sm text-muted">Prepared {view.cover.dateLabel}</p>}
      </header>

      <Section id="overview" eyebrow="Your MogaFace overview" title="At a glance">
        <p className="max-w-3xl font-serif text-2xl leading-10 tracking-tight sm:text-3xl sm:leading-[1.5]">{view.overview}</p>
      </Section>

      {view.priorities.length > 0 && (
        <Section id="priorities" eyebrow="Your top priorities" title="What matters most to you">
          <ol className="grid gap-px overflow-hidden rounded-3xl border border-border bg-border sm:grid-cols-3">
            {view.priorities.map((p) => (
              <li key={p.number} className="flex flex-col gap-4 bg-background p-7">
                <span className="font-serif text-4xl text-muted">{p.number}</span>
                <h3 className="font-serif text-xl leading-snug tracking-tight">{p.concern}</h3>
                <p className="text-sm leading-6">{p.why}</p>
                <p className="text-sm leading-6 text-muted">{p.evidence}</p>
                <div className="mt-auto pt-2">
                  <StatusBadge status={p.status} label={p.statusLabel} />
                </div>
              </li>
            ))}
          </ol>
        </Section>
      )}

      <Section id="observed" eyebrow="What MogaFace observed" title="Structure, eyes and expression">
        <DomainGroup sections={observed} />
      </Section>

      <Section id="about-you" eyebrow="In your own words" title="Skin, hair, lifestyle and style">
        <DomainGroup sections={aboutYou} />
      </Section>

      <Section id="areas" eyebrow="Areas to discuss with your clinician" title="Where a conversation may help">
        {view.areas.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2">
            {view.areas.map((a) => (
              <article key={a.title} className="flex flex-col rounded-3xl border border-border bg-surface p-7 sm:p-8">
                <StatusBadge status={a.status === "discuss" ? "discuss" : "observation_only"} label={a.statusLabel} />
                <h3 className="mt-4 font-serif text-2xl tracking-tight">{a.title}</h3>
                <dl className="mt-6 space-y-5 text-sm leading-6">
                  <div>
                    <dt className={EYEBROW}>Why it appeared</dt>
                    <dd className="mt-1.5">{a.why}</dd>
                  </div>
                  {a.evidence.length > 0 && (
                    <div>
                      <dt className={EYEBROW}>Evidence</dt>
                      <dd className="mt-1.5">
                        <ul className="space-y-1 text-muted">
                          {a.evidence.map((e) => (
                            <li key={e}>{e}</li>
                          ))}
                        </ul>
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt className={EYEBROW}>What your clinician can evaluate</dt>
                    <dd className="mt-1.5 text-muted">{a.clinicianCanEvaluate}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        ) : (
          <p className="max-w-2xl text-lg leading-8 text-muted">
            The available visual evidence does not yet point to specific areas. Your priorities above are still a good starting point for a conversation with your clinician.
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
      </Section>

      <Section id="visualization" eyebrow="Illustrative visualization" title="Before and illustrative after">
        <VisualizationPanel view={view.visualization} />
      </Section>

      <Section id="limits" eyebrow="What MogaFace can and cannot tell you" title="Good to know">
        <ul className="max-w-2xl divide-y divide-border text-base leading-7">
          {view.limitations.map((l) => (
            <li key={l} className="py-4">
              {l}
            </li>
          ))}
        </ul>
      </Section>

      <section aria-labelledby="next-step" className="rounded-[2rem] bg-accent px-7 py-14 text-accent-foreground sm:px-14 sm:py-20">
        <p className="text-xs font-medium uppercase tracking-[0.18em] opacity-70">Your next step</p>
        <h2 id="next-step" className="mt-4 max-w-2xl font-serif text-3xl leading-tight tracking-tight sm:text-5xl">
          {view.cta.heading}
        </h2>
        <p className="mt-6 max-w-xl text-lg leading-8 opacity-85">{view.cta.supportingText}</p>
        <p className="mt-4 max-w-xl text-sm leading-6 opacity-70">{view.clinicianReview}</p>
        <a
          href={cta.href}
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          className="mt-10 inline-flex items-center justify-center rounded-full bg-accent-foreground px-8 py-4 text-sm font-medium text-accent transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-foreground"
        >
          {cta.label}
        </a>
      </section>

      <footer className="border-t border-border pt-8 text-sm text-muted">
        <p className="font-serif text-lg text-foreground">MogaFace</p>
        <p className="mt-2">{view.footer.tagline}</p>
        <p className="mt-1">{view.footer.disclaimer}</p>
      </footer>
    </article>
  );
}
