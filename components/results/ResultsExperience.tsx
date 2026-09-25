"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { createMockProvider } from "@/lib/image-generation/mockProvider.ts";
import type { ImageGenerationProvider } from "@/lib/image-generation/types.ts";
import { DEFAULT_INTERPRETATION_CONSENT, isInterpretationConsent } from "@/lib/interpretation/consent.ts";
import { chooseInterpretationProvider } from "@/lib/interpretation/remote.ts";
import { toReportView, type ReportView } from "@/lib/results/reportView.ts";
import { getConsultationCta } from "@/lib/results/config.ts";
import { buildDemoSnapshot, demoAfterImage } from "@/lib/results/demo.ts";
import { runResultPipeline } from "@/lib/results/pipeline.ts";
import { chooseResultSource } from "@/lib/results/source.ts";
import { loadSnapshot } from "@/lib/results/store.ts";
import { loadAnalysisResult } from "@/lib/facial-analysis/resultStore.ts";
import type { ResultStage } from "@/lib/results/types.ts";
import { Report } from "./Report";
import { LegacyResults } from "./LegacyResults";
import { LoadingState } from "./LoadingState";

type Mode =
  | { kind: "running"; stage: ResultStage }
  | { kind: "done"; view: ReportView; isDemo: boolean }
  | { kind: "legacy" }
  | { kind: "empty" }
  | { kind: "error" };

const tick = () => new Promise<void>((r) => setTimeout(r, 0));
const IS_PRODUCTION = process.env.NODE_ENV === "production";

/**
 * Loads the assessment snapshot, runs interpretation → visualization plan →
 * (mock/none) image, and renders the MogaFace report. Development-only URL
 * switches, ignored in production builds:
 *   ?demo=1            synthetic demo assessment + mock image (never a real result)
 *   ?demo=1&image=none       no image provider configured (visualization "unavailable")
 *   ?demo=1&image=noevidence no front photo, so the plan is not eligible (the "not enough evidence" card)
 *   ?demo=1&image=fail the illustration provider fails (the non-blocking message)
 */
export function ResultsExperience() {
  const [mode, setMode] = useState<Mode>({ kind: "running", stage: "analyzing" });
  const cta = getConsultationCta();

  useEffect(() => {
    let cancelled = false;
    const set = (m: Mode) => {
      if (!cancelled) setMode(m);
    };

    async function run() {
      const params = new URLSearchParams(window.location.search);
      const demo = !IS_PRODUCTION && params.get("demo") === "1";
      const imageMode = IS_PRODUCTION ? null : params.get("image");

      const stored = demo ? null : loadSnapshot();
      const source = demo ? "snapshot" : chooseResultSource(stored?.createdAt ?? null, loadAnalysisResult()?.result.timestamp ?? null);
      if (source !== "snapshot") {
        set(source === "legacy" ? { kind: "legacy" } : { kind: "empty" });
        return;
      }
      const base = demo ? buildDemoSnapshot() : stored!;
      const snapshot = imageMode === "noevidence" ? { ...base, frontPhoto: null } : base;

      await tick();
      let provider: ImageGenerationProvider | null;
      if (imageMode === "none") provider = null;
      else if (imageMode === "fail") provider = createMockProvider({ behavior: "fail", latencyMs: 400 });
      else if (demo) provider = createMockProvider({ render: () => demoAfterImage() });
      else provider = null; // a real assessment never gets a mock image; the report shows the placeholder until a real provider is connected

      try {
        const result = await runResultPipeline(snapshot, {
          imageProvider: provider,
          // Local deterministic wording unless the operator opted in AND the person consented (see lib/interpretation/consent.ts).
          // Development only: ?consent=granted stands in for the consent screen that does not exist yet.
          interpretationProvider: chooseInterpretationProvider({
            demo,
            remoteEnabled: process.env.NEXT_PUBLIC_INTERPRETATION_REMOTE === "1",
            consent: !IS_PRODUCTION && params.get("consent") === "granted" ? "granted" : isInterpretationConsent(snapshot.interpretationConsent) ? snapshot.interpretationConsent : DEFAULT_INTERPRETATION_CONSENT,
          }),
          calibrated: demo ? true : undefined, // the demo alone opens the calibration gate — see lib/results/demo.ts
          onStage: (stage) => set({ kind: "running", stage }),
        });
        set({ kind: "done", view: toReportView(result, snapshot.frontPhoto?.ref ?? null), isDemo: snapshot.isDemo === true });
      } catch {
        set({ kind: "error" });
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      {mode.kind === "running" && <LoadingState stage={mode.stage} />}

      {mode.kind === "done" && (
        <>
          {mode.isDemo && (
            <p role="note" className="mb-12 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
              Demo data — development only. Synthetic evidence and placeholder images; this is not a real assessment.
            </p>
          )}
          <Report view={mode.view} cta={cta} />
        </>
      )}

      {mode.kind === "legacy" && <LegacyResults />}

      {mode.kind === "empty" && (
        <div className="space-y-4 text-center">
          <h1 className="font-serif text-3xl tracking-tight">No analysis found</h1>
          <p className="text-sm text-muted">Your results aren&apos;t stored between visits. Start a new assessment to see them here.</p>
          <Link href="/assessment">
            <Button>Start Your Assessment</Button>
          </Link>
        </div>
      )}

      {mode.kind === "error" && (
        <div role="alert" className="space-y-4 text-center">
          <h1 className="font-serif text-3xl tracking-tight">We couldn&apos;t prepare your results</h1>
          <p className="text-sm text-muted">Something went wrong on our side. Please go back and try again.</p>
          <Link href="/assessment">
            <Button variant="secondary">Back to your assessment</Button>
          </Link>
        </div>
      )}
    </>
  );
}
