"use client";

import { useEffect, useRef, useState } from "react";
import { ILLUSTRATION_FAILED_MESSAGE } from "@/lib/visualization/eligibility.ts";
import { ILLUSTRATIVE_AFTER } from "@/lib/visualization/types.ts";
import { DEFAULT_PHOTO_VISUALIZATION_CONSENT, PHOTO_VISUALIZATION_CONSENT_SENTENCE, type PhotoVisualizationConsent } from "@/lib/visualization/consent.ts";
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

/** One secondary angle's (left 45°/right 45°) own result — never fabricated for an angle that wasn't actually requested or that failed. "not_requested" means the person never had a real photo for that angle; it never gets an invented one. */
export type SecondaryAngleOutcome = { status: "ready"; afterUrl: string } | { status: "not_eligible" | "unavailable" | "failed" | "not_requested" };

export type IllustrationRequestOutcome =
  | {
      status: "ready";
      afterUrl: string;
      isMock: boolean;
      secondaryAngles?: { leftFortyFive: SecondaryAngleOutcome; rightFortyFive: SecondaryAngleOutcome };
      /** Which areas were actually illustrated, from the real trusted plan — when absent (mock/demo/devPreview paths), the panel falls back to the pipeline's own precomputed `view.areas`. */
      areas?: VisualizedArea[];
    }
  | { status: "consent_required" | "not_eligible" | "unavailable" | "failed" };

export interface IllustrationControls {
  /** False → a real-photo generation is not switched on, so the section shows its placeholder. */
  generationEnabled: boolean;
  /** True only for the development demo (a mock image; nothing is sent anywhere). */
  isDemo: boolean;
  initialConsent?: PhotoVisualizationConsent;
  /**
   * True exactly once: only when this render is the direct continuation of the
   * person's own "Analyze My Face" click (consent was just granted there — see
   * AssessmentReview.tsx/ResultsExperience.tsx's one-shot ?autogenerate=1
   * handling). Never true on a plain page load, a refresh, or a revisit — those
   * always require the explicit button below, even when consent is already on
   * record, so a reload can never silently re-trigger generation.
   */
  autoStart?: boolean;
  /**
   * The server already stored a planned illustration for this visit and the
   * person agreed to it. The on-page calibration gate can still say
   * "not eligible" — that gate is not the prediction plan. When this is set,
   * the panel asks the server for the image instead of stopping on that note.
   */
  trustedSession?: boolean;
  /** The person's own real left 45°/right 45° "before" photo, resolved the same way the front one is — absent when they never captured one. Never a stand-in image. */
  leftFortyFiveBeforeUrl?: string | null;
  rightFortyFiveBeforeUrl?: string | null;
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

/** A card per visualized area — area name and a concise, consumer-facing description of what changed, never a suitability or need claim. Exported so the dev-only composite test (DevIllustrationTest.tsx) can preview the same card design. */
export function VisualizedAreaCards({ areas, title }: { areas: VisualizedArea[]; title: string }) {
  if (areas.length === 0) return null;
  return (
    <div className="mt-8">
      <h3 className="text-xs font-medium uppercase tracking-[0.18em] text-muted">{title}</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {areas.map((a) => (
          <div key={a.area} className="rounded-2xl border border-border bg-surface p-5">
            <h4 className="font-serif text-lg tracking-tight">{a.area}</h4>
            <p className="mt-2 text-sm leading-6 text-muted">{a.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

type Phase = "idle" | "confirming" | "pending" | "failed" | { ready: { afterUrl: string; isMock: boolean; secondaryAngles?: { leftFortyFive: SecondaryAngleOutcome; rightFortyFive: SecondaryAngleOutcome }; areas?: VisualizedArea[] } };
type AngleKey = "front" | "leftFortyFive" | "rightFortyFive";
const ANGLE_LABELS: Record<AngleKey, string> = { front: "Front", leftFortyFive: "Left 45°", rightFortyFive: "Right 45°" };

/** Front/left 45°/right 45° selector — shown only once there is more than one angle's worth of information to show (never for a single-angle result). */
function AngleSelector({ selected, onSelect, available }: { selected: AngleKey; onSelect: (a: AngleKey) => void; available: AngleKey[] }) {
  if (available.length <= 1) return null;
  return (
    <div role="tablist" aria-label="Photo angle" className="mb-4 inline-flex rounded-full border border-border p-1">
      {available.map((a) => (
        <button key={a} type="button" role="tab" aria-selected={selected === a} onClick={() => onSelect(a)} className={`${TAB_BUTTON} ${selected === a ? "bg-accent text-accent-foreground" : "text-muted"}`}>
          {ANGLE_LABELS[a]}
        </button>
      ))}
    </div>
  );
}

/** The calm, non-alarming line for a secondary angle that isn't ready — never a broken image, never an invented one. */
function secondaryAngleUnavailableNote(label: string, outcome: SecondaryAngleOutcome | undefined): string | null {
  if (!outcome || outcome.status === "ready" || outcome.status === "not_requested") return null;
  return `${label} visualization unavailable.`;
}

export function IllustrationPanel({ view, controls }: { view: ReportVisualization; controls: IllustrationControls }) {
  const [consent, setConsent] = useState<PhotoVisualizationConsent>(controls.initialConsent ?? DEFAULT_PHOTO_VISUALIZATION_CONSENT);
  const [phase, setPhase] = useState<Phase>("idle");
  const [selectedAngle, setSelectedAngle] = useState<AngleKey>("front");
  const madeUrl = useRef<string | null>(null);
  const secondaryUrls = useRef<string[]>([]);

  // The generated image(s) live only in memory: release them when the panel goes away.
  useEffect(
    () => () => {
      if (madeUrl.current?.startsWith("blob:")) URL.revokeObjectURL(madeUrl.current);
      for (const u of secondaryUrls.current) if (u.startsWith("blob:")) URL.revokeObjectURL(u);
    },
    [],
  );

  const run = async (granted: PhotoVisualizationConsent) => {
    setPhase("pending");
    const outcome = await controls.onGenerate(granted);
    if (outcome.status === "ready") {
      madeUrl.current = outcome.afterUrl;
      secondaryUrls.current = outcome.secondaryAngles ? [outcome.secondaryAngles.leftFortyFive, outcome.secondaryAngles.rightFortyFive].filter((a): a is { status: "ready"; afterUrl: string } => a.status === "ready").map((a) => a.afterUrl) : [];
      setPhase({ ready: { afterUrl: outcome.afterUrl, isMock: outcome.isMock, secondaryAngles: outcome.secondaryAngles, areas: outcome.areas } });
    } else setPhase("failed");
  };

  // Fires at most once per mount, and only for the one-shot continuation of the
  // person's own "Analyze My Face" click — never on a plain load/refresh/revisit.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (controls.autoStart && controls.generationEnabled && !autoStarted.current && consent === "granted" && (view.state === "eligible" || controls.trustedSession)) {
      autoStarted.current = true;
      void run("granted");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const trusted = controls.trustedSession === true && controls.generationEnabled;
  if (!trusted && (view.state === "not_eligible" || view.state === "failed" || !controls.generationEnabled)) {
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

  // A trusted session can reach here while the calibration view is still
  // not_eligible. Only the eligible view carries a preview of areas.
  const previewAreas = view.state === "eligible" ? view.areas : [];

  // eligible
  if (typeof phase === "object") {
    const secondary = phase.ready.secondaryAngles;
    const available: AngleKey[] = ["front", ...(secondary?.leftFortyFive.status === "ready" ? (["leftFortyFive"] as const) : []), ...(secondary?.rightFortyFive.status === "ready" ? (["rightFortyFive"] as const) : [])];
    const angleBefore: Record<AngleKey, string | null> = { front: view.beforeUrl, leftFortyFive: controls.leftFortyFiveBeforeUrl ?? null, rightFortyFive: controls.rightFortyFiveBeforeUrl ?? null };
    const angleAfter: Record<AngleKey, { url: string; isMock: boolean } | null> = {
      front: { url: phase.ready.afterUrl, isMock: phase.ready.isMock },
      leftFortyFive: secondary?.leftFortyFive.status === "ready" ? { url: secondary.leftFortyFive.afterUrl, isMock: false } : null,
      rightFortyFive: secondary?.rightFortyFive.status === "ready" ? { url: secondary.rightFortyFive.afterUrl, isMock: false } : null,
    };
    const shownAngle = available.includes(selectedAngle) ? selectedAngle : "front";
    const after = angleAfter[shownAngle];
    const unavailableNotes = secondary
      ? [secondaryAngleUnavailableNote(ANGLE_LABELS.leftFortyFive, secondary.leftFortyFive), secondaryAngleUnavailableNote(ANGLE_LABELS.rightFortyFive, secondary.rightFortyFive)].filter((n): n is string => n !== null)
      : [];
    return (
      <div>
        <AngleSelector selected={shownAngle} onSelect={setSelectedAngle} available={available} />
        <BeforeAfterFrames before={angleBefore[shownAngle]} after={after ? { kind: "image", url: after.url, isMock: after.isMock } : { kind: "empty", content: "Not available for this angle." }} />
        {unavailableNotes.length > 0 && <p className="mt-3 text-xs text-muted">{unavailableNotes.join(" ")}</p>}
        {/* areas from the actual generation (the real, trusted plan) take precedence — view.areas is only
            a pre-generation preview computed from the calibration-gated pathway, which can disagree with
            what a PredictionPlan-driven generation actually shows. */}
        <VisualizedAreaCards areas={phase.ready.areas ?? previewAreas} title="What changed" />
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

      <VisualizedAreaCards areas={previewAreas} title="What an illustration would show" />

      <div className="mt-8" aria-live="polite">
        {phase === "confirming" && (
          <div className="max-w-2xl rounded-2xl border border-border bg-surface p-6">
            <p className="text-base leading-7">{PHOTO_VISUALIZATION_CONSENT_SENTENCE}</p>
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
