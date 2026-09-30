import type { ConsultationCta } from "@/lib/results/config.ts";
import type { ReportSectionView, ReportView } from "@/lib/results/reportView.ts";
import { IllustrationPanel, type IllustrationControls } from "./IllustrationPanel";
import { DevIllustrationTest } from "./DevIllustrationTest";
import { ResultsSummary } from "./ResultsSummary";
import { StickyMobileCta } from "./StickyMobileCta";

/**
 * The MogaFace report. Presentation only: it receives plain copy from
 * toReportView() and has no access to observations, evidence ids, thresholds,
 * calibration state or versions, so it cannot show them.
 */

const EYEBROW = "text-[11px] font-medium uppercase tracking-[0.28em] text-gold-text";
const UNDERLINE = "mx-auto mt-5 h-px w-14 bg-accent";

function Section({ id, eyebrow, title, children }: { id: string; eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="border-t border-border pt-16 text-center">
      <p className={EYEBROW}>{eyebrow}</p>
      <h2 id={id} className="mt-4 font-serif text-4xl tracking-tight sm:text-5xl">
        {title}
      </h2>
      <div aria-hidden className={UNDERLINE} />
      <div className="mt-12 text-left">{children}</div>
    </section>
  );
}

/**
 * A jump-to index for the report: it is long enough (8+ sections) that a
 * quick contents list earns its place, not just decoration.
 */
function Contents({ entries }: { entries: { id: string; title: string }[] }) {
  return (
    <nav aria-label="Report contents" className="border-t border-border pt-10">
      <ol className="divide-y divide-border">
        {entries.map((entry, i) => (
          <li key={entry.id}>
            <a href={`#${entry.id}`} className="flex items-baseline gap-4 py-3 text-sm hover:text-accent">
              <span className="font-mono text-xs text-muted">{String(i + 1).padStart(2, "0")}</span>
              <span className="flex-1 truncate">{entry.title}</span>
              <span aria-hidden className="hidden flex-1 border-b border-dotted border-border sm:block" />
            </a>
          </li>
        ))}
      </ol>
    </nav>
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
    <div className="grid gap-4 py-10 sm:grid-cols-[14rem_1fr] sm:gap-16">
      <div>
        <h3 className="font-serif text-2xl tracking-tight">{section.title}</h3>
        <p className="mt-3 text-[11px] uppercase tracking-[0.18em] text-muted">{section.basisLabel}</p>
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

export function Report({
  view,
  cta,
  illustration,
  devIllustrationTest,
}: {
  view: ReportView;
  cta: ConsultationCta;
  illustration: IllustrationControls;
  /** Development-only supervised test fixture (see DevIllustrationTest.tsx). Null outside the results page's own dev flow. */
  devIllustrationTest?: { photoUrl: string; photoQualityValid: boolean } | null;
}) {
  const external = /^https?:/i.test(cta.href);
  const observed = view.sections.filter((s) => s.key === "facialStructure" || s.key === "eyeArea" || s.key === "expression");
  const aboutYou = view.sections.filter((s) => !observed.includes(s));

  const contentsEntries = [
    { id: "overview", title: "At a glance" },
    ...(view.priorities.length > 0 ? [{ id: "priorities", title: "What matters most to you" }] : []),
    { id: "observed", title: "Structure, eyes and expression" },
    { id: "about-you", title: "Skin, hair, lifestyle and style" },
    { id: "areas", title: "Where a conversation may help" },
    { id: "limits", title: "Good to know" },
    { id: "next-step-section", title: "Your next step" },
  ];

  return (
    <>
      <article>
        <ResultsSummary view={view} />

        <section id="visualization" aria-label="Your look" className="mt-12">
          <IllustrationPanel view={view.visualization} controls={illustration} />
          {view.visualization.state === "ready" && (
            <div className="mx-auto mt-10 max-w-xl text-center">
              <h3 className="font-serif text-2xl tracking-tight">Ready to explore your options?</h3>
              <p className="mt-3 text-sm leading-6 text-muted">Discuss your results with a clinician to talk through what&apos;s realistic for you.</p>
              <a
                href={cta.href}
                {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="mt-6 inline-flex items-center justify-center rounded-full bg-accent px-6 py-3 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {cta.label}
              </a>
            </div>
          )}
          {devIllustrationTest && <DevIllustrationTest photoUrl={devIllustrationTest.photoUrl} photoQualityValid={devIllustrationTest.photoQualityValid} />}
        </section>

        <div id="full-report" className="mt-20">
          <div id="overview">
            <p className={`${EYEBROW} text-center`}>Your report</p>
            <p className="mx-auto mt-5 max-w-3xl text-center font-serif text-2xl leading-snug tracking-tight sm:text-3xl">{view.overview}</p>
            <div aria-hidden className={UNDERLINE} />
          </div>
        </div>

        <div className="mt-12">
          <Contents entries={contentsEntries} />
        </div>

      {view.priorities.length > 0 && (
        <Section id="priorities" eyebrow="Your top priorities" title="What matters most to you">
          <ol className="mx-auto max-w-3xl divide-y divide-border">
            {view.priorities.map((p) => (
              <li key={p.number} className="grid gap-3 py-8 sm:grid-cols-[4rem_1fr] sm:gap-8">
                <span className="font-serif text-3xl text-muted">{p.number}</span>
                <div>
                  <h3 className="font-serif text-2xl leading-snug tracking-tight">{p.concern}</h3>
                  <p className="mt-3 text-base leading-7">{p.why}</p>
                  <p className="mt-2 text-sm leading-6 text-muted">{p.evidence}</p>
                  <div className="mt-4">
                    <StatusBadge status={p.status} label={p.statusLabel} />
                  </div>
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
          <div className="mx-auto max-w-3xl divide-y divide-border">
            {view.areas.map((a, i) => (
              <article key={a.title} className="py-10">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="font-serif text-3xl text-muted">{String(i + 1).padStart(2, "0")}</span>
                  <StatusBadge status={a.status === "discuss" ? "discuss" : "observation_only"} label={a.statusLabel} />
                </div>
                <h3 className="mt-3 font-serif text-2xl tracking-tight">{a.title}</h3>
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

      <Section id="limits" eyebrow="What MogaFace can and cannot tell you" title="Good to know">
        <ul className="mx-auto max-w-2xl divide-y divide-border text-base leading-7">
          {view.limitations.map((l) => (
            <li key={l} className="py-4">
              {l}
            </li>
          ))}
        </ul>
      </Section>

      <section id="next-step-section" aria-labelledby="next-step" className="mt-20 rounded-[2rem] bg-dark-surface px-7 py-14 text-dark-foreground sm:px-14 sm:py-20">
        <p className="text-xs font-medium uppercase tracking-[0.18em] opacity-70">Your next step</p>
        <h2 id="next-step" className="mt-4 max-w-2xl font-serif text-3xl leading-tight tracking-tight sm:text-5xl">
          {view.cta.heading}
        </h2>
        <p className="mt-6 max-w-xl text-lg leading-8 opacity-85">{view.cta.supportingText}</p>
        <p className="mt-4 max-w-xl text-sm leading-6 opacity-70">{view.clinicianReview}</p>
        <a
          href={cta.href}
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          className="mt-10 inline-flex items-center justify-center rounded-full bg-dark-foreground px-8 py-4 text-sm font-medium text-dark-surface transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dark-foreground"
        >
          {cta.label}
        </a>
      </section>

      <footer className="mt-16 border-t border-border pt-8 text-center text-sm text-muted">
        <p className="font-serif text-lg text-foreground">MogaFace</p>
        <p className="mt-2">{view.footer.tagline}</p>
        <p className="mt-1">{view.footer.disclaimer}</p>
      </footer>
      </article>

      {/*
        Rendered as a sibling AFTER </article>, not inside it: its own
        space-reserving spacer (see StickyMobileCta.tsx) must sit after
        next-step-section in the DOM, so appearing/disappearing never shifts
        the getBoundingClientRect() position that component measures against
        to decide its own visibility (which would otherwise be a feedback
        loop: show → spacer added → sentinel moves → recompute → jump).
        position: fixed on the CTA bar itself is unaffected by DOM order, so
        moving it here doesn't change where it visually renders.
      */}
      <StickyMobileCta cta={cta} />
    </>
  );
}
