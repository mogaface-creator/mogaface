"use client";

import { useRef, useState } from "react";
import { requestDevIllustrationTest } from "@/lib/image-generation/devClient.ts";
import { createSingleFlight } from "@/lib/image-generation/singleFlight.ts";
import { DEV_MULTI_AREA_PREVIEW, DEV_SINGLE_AREA_PREVIEW } from "@/lib/image-generation/devIllustrationFixture.ts";
import { ILLUSTRATIVE_AFTER } from "@/lib/visualization/types.ts";
import type { PhotoVisualizationConsent } from "@/lib/visualization/consent.ts";
import type { VisualizedArea } from "@/lib/visualization/present.ts";
import { BeforeAfterFrames, VisualizedAreaCards } from "./IllustrationPanel";

/**
 * Developer-only supervised test of the REAL illustration pipeline (see
 * lib/image-generation/devTestHandler.ts): the actual front photo already in
 * this session, the actual consent gate, and one real image-editing call —
 * against a fixed, hardcoded fixture, never a real user's own evidence.
 * Two fixtures: "single" (one expression_lines change, the same category
 * production can already approve) and "multi" (all five areas, previewing
 * the product's target reference-style experience — see
 * devIllustrationFixture.ts's DEV_FULL_ILLUSTRATION_POLICY comment for why
 * that fixture alone needs a policy override, not just a calibration one).
 *
 * Rendered only outside a production build (NODE_ENV !== "production" is
 * inlined at build time, so a production bundle never includes this branch),
 * and even then it does nothing unless the server independently has
 * NODE_ENV=development AND DEV_ILLUSTRATION_TEST=1 — this component cannot
 * open the calibration gate, the policy gate, or bypass consent on its own.
 */

type Fixture = "single" | "multi";
type Phase =
  | { kind: "idle" }
  | { kind: "confirming"; fixture: Fixture }
  | { kind: "generating"; fixture: Fixture }
  | { kind: "ready"; url: string; fixture: Fixture }
  | { kind: "error"; message: string };

const DISABLED_MESSAGE = "The developer test path isn't enabled on this server. Set DEV_ILLUSTRATION_TEST=1 for a development server.";
const CONSENT_MESSAGE = "Consent wasn't granted, so nothing was sent.";
const FAILED_MESSAGE = "The developer test call failed — check the server logs.";

function outcomeMessage(status: "consent_required" | "disabled" | "failed"): string {
  if (status === "disabled") return DISABLED_MESSAGE;
  if (status === "consent_required") return CONSENT_MESSAGE;
  return FAILED_MESSAGE;
}

function previewFor(fixture: Fixture): VisualizedArea[] {
  return fixture === "multi" ? DEV_MULTI_AREA_PREVIEW : DEV_SINGLE_AREA_PREVIEW;
}

export function DevIllustrationTest({ photoUrl, photoQualityValid }: { photoUrl: string | null; photoQualityValid: boolean }) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  // One request per click no matter how React re-renders or how fast a second click lands.
  const guarded = useRef(createSingleFlight(requestDevIllustrationTest)).current;
  const madeUrl = useRef<string | null>(null);

  if (process.env.NODE_ENV === "production" || !photoUrl) return null;

  const run = async (fixture: Fixture, consent: PhotoVisualizationConsent) => {
    setPhase({ kind: "generating", fixture });
    const outcome = await guarded({ photoUrl, photoQualityValid, consent, fixture });
    if (!outcome) return; // a call was already in flight — this click was dropped, not queued
    if (outcome.status === "ready") {
      madeUrl.current = outcome.afterUrl;
      setPhase({ kind: "ready", url: outcome.afterUrl, fixture });
    } else {
      setPhase({ kind: "error", message: outcomeMessage(outcome.status) });
    }
  };

  const idle = phase.kind === "idle" || phase.kind === "error";

  return (
    <div className="mt-12 rounded-2xl border-2 border-dashed border-amber-400 bg-amber-50/40 p-6 dark:border-amber-700 dark:bg-amber-950/10">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-amber-700 dark:text-amber-400">Developer test — not a production feature</p>
      <h3 className="mt-2 font-serif text-xl tracking-tight">Developer test: Generate Illustrative After</h3>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Calls the real image-editing pipeline once, using your actual front photo and a fixed, hardcoded test fixture — never your
        real evidence or eligibility, and never a substitute for it.
      </p>

      {phase.kind === "confirming" && (
        <div className="mt-4 max-w-2xl rounded-xl border border-border bg-surface p-4 text-sm">
          <p>Your photo will be sent to OpenAI to create this illustrative visualization.</p>
          <div className="mt-3 flex gap-3">
            <button
              type="button"
              onClick={() => void run(phase.fixture, "granted")}
              className="rounded-full bg-accent px-5 py-2 text-xs font-medium text-accent-foreground"
            >
              Continue
            </button>
            <button type="button" onClick={() => setPhase({ kind: "idle" })} className="rounded-full border border-border px-5 py-2 text-xs font-medium">
              Cancel
            </button>
          </div>
        </div>
      )}

      {idle && (
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setPhase({ kind: "confirming", fixture: "single" })}
            className="rounded-full bg-amber-600 px-5 py-2 text-xs font-medium text-white hover:opacity-90"
          >
            Developer test: Generate Illustrative After
          </button>
          <button
            type="button"
            onClick={() => setPhase({ kind: "confirming", fixture: "multi" })}
            className="rounded-full border border-amber-600 px-5 py-2 text-xs font-medium text-amber-700 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-950/40"
          >
            Developer test: Multi-area composite (reference-style)
          </button>
        </div>
      )}

      {phase.kind === "generating" && (
        <p role="status" className="mt-4 text-sm text-muted">
          Generating your illustrative visualization… this can take up to a minute.
        </p>
      )}

      {phase.kind === "error" && (
        <p role="alert" className="mt-3 text-sm text-red-700 dark:text-red-400">
          {phase.message}
        </p>
      )}

      {phase.kind === "ready" && (
        <div className="mt-4 max-w-xl">
          <BeforeAfterFrames before={photoUrl} after={{ kind: "image", url: phase.url }} />
          <VisualizedAreaCards areas={previewFor(phase.fixture)} title="What this illustrates (dev fixture, not real evidence)" />
          <p className="mt-3 max-w-xl text-xs text-muted">{ILLUSTRATIVE_AFTER.notice}</p>
        </div>
      )}
    </div>
  );
}
