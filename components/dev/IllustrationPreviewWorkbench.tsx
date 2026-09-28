"use client";

import { useEffect, useRef, useState } from "react";
import { BeforeAfterFrames, VisualizedAreaCards } from "@/components/results/IllustrationPanel";
import { requestDevIllustrationTest } from "@/lib/image-generation/devClient.ts";
import { createSingleFlight } from "@/lib/image-generation/singleFlight.ts";
import { DEV_SINGLE_AREA_PREVIEW } from "@/lib/image-generation/devIllustrationFixture.ts";
import { ILLUSTRATIVE_AFTER } from "@/lib/visualization/types.ts";
import type { PhotoVisualizationConsent } from "@/lib/visualization/consent.ts";

/**
 * Developer-only "Illustration Preview": pick ONE real front photo from
 * disk and generate a Before -> Illustrative After using the REAL
 * image-generation pipeline — the same route, handler, consent gate, safety
 * validator and output validation as production (see devTestHandler.ts,
 * completely unmodified here). Restricted to the "single" dev fixture
 * (expression_lines), the only category the real ILLUSTRATION_POLICY
 * already approves — nothing here opens contour/jawline/under-eye/skin.
 *
 * This is NOT calibration evidence:
 *  - it never touches the calibration state or any threshold;
 *  - it never builds or marks a treatment opportunity ready for consumers;
 *  - it never changes production visualization eligibility;
 *  - the chosen photo is an in-memory object URL for this page's lifetime
 *    only — never persisted to any browser storage, never added to the
 *    calibration dataset (lib/facial-analysis/calibration/), never given a
 *    REAL-XXX id.
 *
 * Rendered only outside a production build (mirrors DevIllustrationTest.tsx
 * and app/dev/illustration-preview/page.tsx's own server-side guard); the
 * server route itself still refuses with a 404 unless NODE_ENV=development
 * AND DEV_ILLUSTRATION_TEST=1 are both set, independent of this component.
 */

type Phase = { kind: "idle" } | { kind: "confirming" } | { kind: "generating" } | { kind: "ready"; url: string } | { kind: "error"; message: string };

const DISABLED_MESSAGE = "The developer test path isn't enabled on this server. Set DEV_ILLUSTRATION_TEST=1 for a development server.";
const FAILED_MESSAGE = "The generation call failed — check the server logs.";

export function IllustrationPreviewWorkbench() {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [qualityConfirmed, setQualityConfirmed] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const guarded = useRef(createSingleFlight(requestDevIllustrationTest)).current;
  const photoUrlRef = useRef<string | null>(null);
  const generatedUrlRef = useRef<string | null>(null);

  // Revoke whatever object URL is no longer in use, on replacement or unmount — never left dangling, never persisted anywhere.
  useEffect(() => {
    photoUrlRef.current = photoUrl;
  }, [photoUrl]);
  useEffect(
    () => () => {
      if (photoUrlRef.current) URL.revokeObjectURL(photoUrlRef.current);
      if (generatedUrlRef.current) URL.revokeObjectURL(generatedUrlRef.current);
    },
    [],
  );

  const chooseFile = (file: File | null) => {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    if (generatedUrlRef.current) {
      URL.revokeObjectURL(generatedUrlRef.current);
      generatedUrlRef.current = null;
    }
    setPhotoUrl(file ? URL.createObjectURL(file) : null);
    setQualityConfirmed(false);
    setPhase({ kind: "idle" });
  };

  const run = async (consent: PhotoVisualizationConsent) => {
    if (!photoUrl) return;
    setPhase({ kind: "generating" });
    const outcome = await guarded({ photoUrl, photoQualityValid: qualityConfirmed, consent, fixture: "single" });
    if (!outcome) return; // a call was already in flight — this click was dropped, not queued
    if (outcome.status === "ready") {
      generatedUrlRef.current = outcome.afterUrl;
      setPhase({ kind: "ready", url: outcome.afterUrl });
    } else {
      setPhase({ kind: "error", message: outcome.status === "disabled" ? DISABLED_MESSAGE : FAILED_MESSAGE });
    }
  };

  const idle = phase.kind === "idle" || phase.kind === "error";

  return (
    <div className="max-w-2xl space-y-6 text-sm">
      <section className="rounded-2xl border-2 border-dashed border-amber-400 bg-amber-50/40 p-5 dark:border-amber-700 dark:bg-amber-950/10">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-amber-700 dark:text-amber-400">Development only — not calibrated</p>
        <p className="mt-2 text-sm font-medium">Developer preview — manually selected visualization.</p>
        <p className="mt-2 text-xs text-muted">
          Illustrative visualization only. This preview does not establish treatment suitability, diagnosis, or clinical recommendation. It uses a fixed,
          hardcoded expression_lines fixture (the one category the real ILLUSTRATION_POLICY already approves) — never a real observation, never real
          calibration evidence. <code>expression</code>, <code>facialStructure.contour</code> and <code>eyeArea.underEye</code> calibration all remain{" "}
          <code>false</code> regardless of what happens here.
        </p>
      </section>

      <section>
        <h2 className="text-sm font-semibold">1 · Choose a real front-facing photo</h2>
        <p className="mt-1 text-xs text-muted">Stays on this device as an in-memory reference only, unless you consent to send it below. Never persisted to browser storage, never added to the calibration dataset.</p>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-label="Illustration preview photo"
          onChange={(e) => chooseFile(e.target.files?.[0] ?? null)}
          className="mt-3 block text-xs"
        />
      </section>

      {photoUrl && (
        <>
          <section>
            <h2 className="text-sm font-semibold">2 · Confirm and generate</h2>
            <label className="mt-2 flex items-start gap-2 text-xs">
              <input type="checkbox" checked={qualityConfirmed} onChange={(e) => setQualityConfirmed(e.target.checked)} className="mt-0.5" />
              This is a clear, front-facing photo (no automated quality check runs outside a real assessment — you are confirming this yourself).
            </label>

            {phase.kind === "confirming" && (
              <div className="mt-3 rounded-xl border border-border bg-surface p-4">
                <p>Your photo will be sent to OpenAI to create this illustrative visualization.</p>
                <div className="mt-3 flex gap-3">
                  <button type="button" onClick={() => void run("granted")} className="rounded-full bg-accent px-5 py-2 text-xs font-medium text-accent-foreground">
                    Continue
                  </button>
                  <button type="button" onClick={() => setPhase({ kind: "idle" })} className="rounded-full border border-border px-5 py-2 text-xs font-medium">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {idle && (
              <button
                type="button"
                onClick={() => setPhase({ kind: "confirming" })}
                disabled={!qualityConfirmed}
                className="mt-3 rounded-full bg-amber-600 px-5 py-2 text-xs font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Generate Illustrative After
              </button>
            )}

            {phase.kind === "generating" && (
              <p role="status" className="mt-3 text-xs text-muted">
                Generating your illustrative visualization… this can take up to a minute.
              </p>
            )}
            {phase.kind === "error" && (
              <p role="alert" className="mt-3 text-xs text-red-700 dark:text-red-400">
                {phase.message}
              </p>
            )}
          </section>

          <section>
            <h2 className="text-sm font-semibold">3 · Before → Illustrative After</h2>
            <div className="mt-3">
              <BeforeAfterFrames before={photoUrl} after={phase.kind === "ready" ? { kind: "image", url: phase.url } : { kind: "empty", content: "Not generated yet." }} />
            </div>
            {phase.kind === "ready" && (
              <>
                <VisualizedAreaCards areas={DEV_SINGLE_AREA_PREVIEW} title="What this illustrates (dev fixture, not real evidence)" />
                <p className="mt-3 text-xs text-muted">{ILLUSTRATIVE_AFTER.notice}</p>
                <p className="mt-1 text-xs text-muted">Your actual results may differ. Treatment decisions should be made with a qualified clinician. Discuss treatment options with your clinician.</p>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
