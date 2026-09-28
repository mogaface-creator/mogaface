"use client";

import { useEffect, useRef, useState } from "react";
import { ILLUSTRATION_FAILED_MESSAGE } from "@/lib/visualization/eligibility.ts";
import { ILLUSTRATIVE_AFTER } from "@/lib/visualization/types.ts";
import { DEFAULT_PHOTO_VISUALIZATION_CONSENT, type PhotoVisualizationConsent } from "@/lib/visualization/consent.ts";
import type { VisualizedArea } from "@/lib/visualization/present.ts";
import type { ReportVisualization } from "@/lib/results/reportView.ts";

/**
 * Before → Illustrative After.
 *
 * Nothing is generated when this renders, refreshes or re-renders: an image is
 * requested ONLY from the button below, and — for a real photo — only after the
 * person agrees to send it to an external AI service. The states are distinct
 * on purpose: not eligible (a calm note), eligible (button), consent, pending,
 * failed (the same calm note) and ready. The generated image is held in memory
 * only. It is an illustration: labelled as AI-generated, never as a result.
 */

export type IllustrationRequestOutcome = { status: "ready"; afterUrl: string; isMock: boolean } | { status: "consent_required" | "not_eligible" | "unavailable" | "failed" };

export interface IllustrationControls {
  /** False → a real-photo generation is not switched on, so the section shows its placeholder. */
  generationEnabled: boolean;
  /** True only for the development demo (a mock image; nothing is sent anywhere). */
  isDemo: boolean;
  initialConsent?: PhotoVisualizationConsent;
  onGenerate: (consent: PhotoVisualizationConsent) => Promise<IllustrationRequestOutcome>;
}

const FRAME = "relative aspect-[4/5] overflow-hidden rounded-3xl";
const CAPTION = "mt-3 text-xs font-medium uppercase tracking-[0.18em] text-muted";

function Arrow() {
  return (
    <span aria-hidden className="flex items-center justify-center text-muted sm:px-2">
      <svg viewBox="0 0 24 24" className="h-6 w-6 rotate-90 sm:rotate-0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </span>
  );
}

function BeforeFrame({ url }: { url: string | null }) {
  return (
    <figure>
      <div className={`${FRAME} border border-border bg-surface`}>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="Your front photo" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center px-8 text-center text-sm text-muted">Your front photo will appear here.</div>
        )}
      </div>
      <figcaption className={CAPTION}>Before</figcaption>
    </figure>
  );
}

function EmptyAfter({ children }: { children: React.ReactNode }) {
  return (
    <figure>
      <div className={`${FRAME} flex items-center justify-center border border-dashed border-border bg-surface/60 px-8 text-center`} role="img" aria-label="Illustrative after: not available yet">
        <div className="font-serif text-xl leading-snug tracking-tight text-muted">{children}</div>
      </div>
      <figcaption className={CAPTION}>{ILLUSTRATIVE_AFTER.label}</figcaption>
    </figure>
  );
}

export type AfterSlot = { kind: "image"; url: string; isMock?: boolean } | { kind: "empty"; content: React.ReactNode };

function AfterFrame({ slot }: { slot: AfterSlot }) {
  if (slot.kind === "empty") return <EmptyAfter>{slot.content}</EmptyAfter>;
  return (
    <figure>
      <div className={`${FRAME} border border-border bg-surface`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={slot.url} alt="Illustrative after (AI-generated visualization)" className="h-full w-full object-cover" />
        <span className="absolute left-3 top-3 rounded-full bg-background/90 px-3 py-1 text-xs font-medium text-foreground">{ILLUSTRATIVE_AFTER.aiLabel}</span>
        {slot.isMock && <span className="absolute bottom-3 left-3 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900">Mock image — development only</span>}
      </div>
      <figcaption className={CAPTION}>{ILLUSTRATIVE_AFTER.label}</figcaption>
      <p className="mt-1 text-xs text-muted">{ILLUSTRATIVE_AFTER.shortNotice}</p>
    </figure>
  );
}

const TAB_BUTTON = "rounded-full px-5 py-2.5 text-sm font-medium transition-colors";

/**
 * Before/After, from the SAME beforeUrl/afterUrl (or empty-state) data: side
 * by side at sm: and up (unchanged desktop layout), a tap-to-switch toggle
 * below it — comparing two stacked images on a narrow phone means scrolling
 * back and forth, so a toggle reads better than a stack there.
 */
/** Exported so other development-only tools (e.g. IllustrationPreviewWorkbench) can reuse the exact same premium, mobile-first presentation instead of a separate implementation. */
export function BeforeAfterFrames({ before, after }: { before: string | null; after: AfterSlot }) {
  const [tab, setTab] = useState<"before" | "after">("before");
  return (
    <div>
      <div className="hidden items-center gap-4 sm:grid sm:grid-cols-[1fr_auto_1fr]">
        <BeforeFrame url={before} />
        <Arrow />
        <AfterFrame slot={after} />
      </div>

      <div className="sm:hidden">
        <div role="tablist" aria-label="Before or illustrative after" className="inline-flex rounded-full border border-border p-1">
          <button type="button" role="tab" aria-selected={tab === "before"} onClick={() => setTab("before")} className={`${TAB_BUTTON} ${tab === "before" ? "bg-accent text-accent-foreground" : "text-muted"}`}>
            Before
          </button>
          <button type="button" role="tab" aria-selected={tab === "after"} onClick={() => setTab("after")} className={`${TAB_BUTTON} ${tab === "after" ? "bg-accent text-accent-foreground" : "text-muted"}`}>
            After
          </button>
        </div>
        <div className="mt-4">{tab === "before" ? <BeforeFrame url={before} /> : <AfterFrame slot={after} />}</div>
      </div>
    </div>
  );
}

function Notice({ isMock }: { isMock?: boolean }) {
  return (
    <div className="mt-8 space-y-2 text-sm text-muted">
      <p>{ILLUSTRATIVE_AFTER.notice}</p>
      <p>A qualified clinician decides what, if anything, is appropriate for you.</p>
      {isMock && <p className="text-amber-800 dark:text-amber-300">Demo: a placeholder image, not a generated one. Nothing was sent anywhere.</p>}
    </div>
  );
}

/** A card per visualized area — area name, what was illustrated, and (where one applies) a neutral treatment-family name to discuss, never a suitability or need claim. Exported so the dev-only composite test (DevIllustrationTest.tsx) can preview the same card design. */
export function VisualizedAreaCards({ areas, title }: { areas: VisualizedArea[]; title: string }) {
  if (areas.length === 0) return null;
  return (
    <div className="mt-8">
      <h3 className="text-xs font-medium uppercase tracking-[0.18em] text-muted">{title}</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {areas.map((a) => (
          <div key={a.area} className="rounded-2xl border border-border bg-surface p-5">
            <p className="text-xs font-medium uppercase tracking-wide text-accent">Illustrative visualization</p>
            <h4 className="mt-2 font-serif text-lg tracking-tight">{a.area}</h4>
            <p className="mt-2 text-sm leading-6 text-muted">{a.description}</p>
            {a.treatmentFamily && <p className="mt-3 text-xs text-muted">Possible treatment category to discuss with your clinician: {a.treatmentFamily}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

type Phase = "idle" | "confirming" | "pending" | "failed" | { ready: { afterUrl: string; isMock: boolean } };

export function IllustrationPanel({ view, controls }: { view: ReportVisualization; controls: IllustrationControls }) {
  const [consent, setConsent] = useState<PhotoVisualizationConsent>(controls.initialConsent ?? DEFAULT_PHOTO_VISUALIZATION_CONSENT);
  const [phase, setPhase] = useState<Phase>("idle");
  const madeUrl = useRef<string | null>(null);

  // The generated image lives only in memory: release it when the panel goes away.
  useEffect(
    () => () => {
      if (madeUrl.current?.startsWith("blob:")) URL.revokeObjectURL(madeUrl.current);
    },
    [],
  );

  const run = async (granted: PhotoVisualizationConsent) => {
    setPhase("pending");
    const outcome = await controls.onGenerate(granted);
    if (outcome.status === "ready") {
      madeUrl.current = outcome.afterUrl;
      setPhase({ ready: { afterUrl: outcome.afterUrl, isMock: outcome.isMock } });
    } else setPhase("failed");
  };

  // Already-rendered result (e.g. supplied by the pipeline in tests).
  if (view.state === "ready") {
    return (
      <div>
        <BeforeAfterFrames before={view.beforeUrl} after={{ kind: "image", url: view.afterUrl, isMock: view.isMock }} />
        <VisualizedAreaCards areas={view.areas} title="What changed" />
        <Notice isMock={view.isMock} />
      </div>
    );
  }

  if (view.state === "not_eligible" || view.state === "failed" || !controls.generationEnabled) {
    const title = view.state === "eligible" ? "Illustrative visualization" : view.title;
    const body = view.state === "eligible" ? "An illustrative view isn't available right now." : view.body;
    const detail = view.state === "not_eligible" ? view.detail : null;
    return (
      <div>
        <BeforeAfterFrames before={view.beforeUrl} after={{ kind: "empty", content: body }} />
        <div className="mt-8 max-w-2xl">
          <h3 className="font-serif text-xl tracking-tight">{title}</h3>
          {detail && <p className="mt-2 text-base leading-7 text-muted">{detail}</p>}
        </div>
      </div>
    );
  }

  // eligible
  if (typeof phase === "object") {
    return (
      <div>
        <BeforeAfterFrames before={view.beforeUrl} after={{ kind: "image", url: phase.ready.afterUrl, isMock: phase.ready.isMock }} />
        <VisualizedAreaCards areas={view.areas} title="What this illustrates" />
        <Notice isMock={phase.ready.isMock} />
      </div>
    );
  }

  return (
    <div>
      <BeforeAfterFrames
        before={view.beforeUrl}
        after={{
          kind: "empty",
          content: phase === "pending" ? "Creating your illustrative view…" : phase === "failed" ? ILLUSTRATION_FAILED_MESSAGE : "Your illustrative view will appear here.",
        }}
      />

      <VisualizedAreaCards areas={view.areas} title="What an illustration would show" />

      <div className="mt-8" aria-live="polite">
        {phase === "confirming" && (
          <div className="max-w-2xl rounded-2xl border border-border bg-surface p-6">
            <p className="text-base leading-7">
              To create this illustration, your front photo will be sent to an external AI image service (OpenAI). It is sent only if you continue, only for this request, and it does not change your analysis.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button type="button" onClick={() => { setConsent("granted"); void run("granted"); }} className="rounded-full bg-accent px-6 py-3 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                Continue
              </button>
              <button type="button" onClick={() => { setConsent("declined"); setPhase("idle"); }} className="rounded-full border border-border px-6 py-3 text-sm font-medium hover:bg-surface">
                Not now
              </button>
            </div>
          </div>
        )}

        {(phase === "idle" || phase === "failed") && consent !== "declined" && (
          <button
            type="button"
            onClick={() => (controls.isDemo || consent === "granted" ? void run("granted") : setPhase("confirming"))}
            className="rounded-full bg-accent px-8 py-4 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Generate My Illustrative View
          </button>
        )}

        {phase === "idle" && consent === "declined" && (
          <p className="text-sm text-muted">
            You chose not to create an illustrative view.{" "}
            <button type="button" onClick={() => setConsent("pending")} className="underline">
              Change my mind
            </button>
          </p>
        )}

        {phase === "pending" && <p role="status" className="text-sm text-muted">This can take up to a minute.</p>}
      </div>
      <Notice />
    </div>
  );
}
