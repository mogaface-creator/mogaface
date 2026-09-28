"use client";

import { useEffect, useRef, useState } from "react";
import { BeforeAfterFrames } from "@/components/results/IllustrationPanel";
import { requestLivePreviewGenerate, verifyLivePreviewCode } from "@/lib/image-generation/livePreviewClient.ts";
import { createSingleFlight } from "@/lib/image-generation/singleFlight.ts";
import { ILLUSTRATIVE_AFTER } from "@/lib/visualization/types.ts";
import type { PhotoVisualizationConsent } from "@/lib/visualization/consent.ts";

/**
 * TEMPORARY, production-accessible preview of Before -> Illustrative After,
 * for testers with a valid access code — reuses the exact same
 * image-generation pipeline as production (handler.ts, unmodified) via
 * livePreviewHandler.ts, restricted to the one expression_lines fixture the
 * real ILLUSTRATION_POLICY already approves. Never touches calibration state,
 * never builds a treatment opportunity, and is not wired into any other part
 * of the consumer product or its downstream systems.
 *
 * The access code lives only in this component's React state for the
 * lifetime of the tab — never written to any browser storage. The chosen
 * photo is an in-memory object URL only, revoked on replacement/unmount.
 */

type Gate = { kind: "locked" } | { kind: "checking" } | { kind: "unlocked" } | { kind: "denied"; message: string };
type Phase = { kind: "idle" } | { kind: "confirming" } | { kind: "generating" } | { kind: "ready"; url: string } | { kind: "error"; message: string };

const DISABLED_MESSAGE = "This preview isn't enabled right now.";
const DENIED_MESSAGE = "That access code isn't valid.";
const FAILED_MESSAGE = "The generation call failed. Please try again.";

export function LiveIllustrationPreview() {
  const [code, setCode] = useState("");
  const [gate, setGate] = useState<Gate>({ kind: "locked" });
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [qualityConfirmed, setQualityConfirmed] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const guarded = useRef(createSingleFlight(requestLivePreviewGenerate)).current;
  const photoUrlRef = useRef<string | null>(null);
  const generatedUrlRef = useRef<string | null>(null);

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

  const checkCode = async () => {
    setGate({ kind: "checking" });
    const outcome = await verifyLivePreviewCode(code);
    if (outcome === "ok") setGate({ kind: "unlocked" });
    else setGate({ kind: "denied", message: outcome === "disabled" ? DISABLED_MESSAGE : DENIED_MESSAGE });
  };

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
    const outcome = await guarded({ code, photoUrl, photoQualityValid: qualityConfirmed, consent });
    if (!outcome) return; // a call was already in flight — this click was dropped, not queued
    if (outcome.status === "ready") {
      generatedUrlRef.current = outcome.afterUrl;
      setPhase({ kind: "ready", url: outcome.afterUrl });
    } else {
      setPhase({ kind: "error", message: outcome.status === "disabled" || outcome.status === "unauthorized" ? DISABLED_MESSAGE : FAILED_MESSAGE });
    }
  };

  const idle = phase.kind === "idle" || phase.kind === "error";

  return (
    <div className="mx-auto max-w-md space-y-6 text-sm">
      <section className="rounded-2xl border-2 border-dashed border-amber-400 bg-amber-50/40 p-5 dark:border-amber-700 dark:bg-amber-950/10">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-amber-700 dark:text-amber-400">Developer / clinic testing only</p>
        <p className="mt-2 text-xs text-muted">
          This is a temporary visualization preview. It is not part of the normal consumer experience. It illustrates only expression-line
          changes — the one category MogaFace&apos;s visualization policy already approves — and does not establish treatment suitability, diagnosis,
          or clinical guidance of any kind.
        </p>
      </section>

      {gate.kind !== "unlocked" && (
        <section>
          <h2 className="text-sm font-semibold">Access code</h2>
          <p className="mt-1 text-xs text-muted">Ask the MogaFace team for the current preview code. It is never stored on this device.</p>
          <input
            type="password"
            inputMode="text"
            autoComplete="off"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Access code"
            className="mt-3 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={() => void checkCode()}
            disabled={code.length === 0 || gate.kind === "checking"}
            className="mt-3 rounded-full bg-accent px-5 py-2 text-xs font-medium text-accent-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            {gate.kind === "checking" ? "Checking…" : "Continue"}
          </button>
          {gate.kind === "denied" && (
            <p role="alert" className="mt-3 text-xs text-red-700 dark:text-red-400">
              {gate.message}
            </p>
          )}
        </section>
      )}

      {gate.kind === "unlocked" && (
        <>
          <section>
            <h2 className="text-sm font-semibold">1 · Upload a real front-facing photo</h2>
            <p className="mt-1 text-xs text-muted">Stays on this device as an in-memory reference only, unless you consent to send it below. Never written to any browser storage.</p>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-label="Preview photo"
              onChange={(e) => chooseFile(e.target.files?.[0] ?? null)}
              className="mt-3 block text-xs"
            />
          </section>

          {photoUrl && (
            <>
              <section>
                <h2 className="text-sm font-semibold">2 · Confirm photo quality</h2>
                <label className="mt-2 flex items-start gap-2 text-xs">
                  <input type="checkbox" checked={qualityConfirmed} onChange={(e) => setQualityConfirmed(e.target.checked)} className="mt-0.5" />
                  This is a clear, front-facing photo.
                </label>
              </section>

              <section>
                <h2 className="text-sm font-semibold">3 · Consent</h2>
                {phase.kind === "confirming" && (
                  <div className="mt-3 rounded-xl border border-border bg-surface p-4">
                    <p>Your photo will be sent to OpenAI to generate this illustrative visualization.</p>
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
                <h2 className="text-sm font-semibold">4 · Before → Illustrative After</h2>
                <div className="mt-3">
                  <BeforeAfterFrames before={photoUrl} after={phase.kind === "ready" ? { kind: "image", url: phase.url } : { kind: "empty", content: "Not generated yet." }} />
                </div>
                {phase.kind === "ready" && (
                  <>
                    <p className="mt-3 text-xs text-muted">{ILLUSTRATIVE_AFTER.notice}</p>
                    <p className="mt-1 text-xs text-muted">
                      Developer / clinic testing only — not a normal product result. Your actual results may differ. Treatment decisions should be
                      made with a qualified clinician.
                    </p>
                  </>
                )}
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
