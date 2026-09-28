"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { requestIllustration } from "@/lib/image-generation/client.ts";
import { createMockProvider } from "@/lib/image-generation/mockProvider.ts";
import { generateVisualization } from "@/lib/image-generation/provider.ts";
import { isPhotoVisualizationConsent } from "@/lib/visualization/consent.ts";
import { DEFAULT_INTERPRETATION_CONSENT, isInterpretationConsent } from "@/lib/interpretation/consent.ts";
import { chooseInterpretationProvider } from "@/lib/interpretation/remote.ts";
import { toReportView, type ReportView } from "@/lib/results/reportView.ts";
import { getConsultationCta } from "@/lib/results/config.ts";
import { buildDemoSnapshot, demoAfterImage } from "@/lib/results/demo.ts";
import { runResultPipeline } from "@/lib/results/pipeline.ts";
import { chooseResultSource } from "@/lib/results/source.ts";
import { loadSnapshot, resolveStoredFrontPhoto } from "@/lib/results/store.ts";
import { loadAnalysisResult } from "@/lib/facial-analysis/resultStore.ts";
import type { AssessmentSnapshot, ResultStage } from "@/lib/results/types.ts";
import { Report } from "./Report";
import type { IllustrationControls } from "./IllustrationPanel";
import { LegacyResults } from "./LegacyResults";
import { LoadingState } from "./LoadingState";

type Mode =
  | { kind: "running"; stage: ResultStage }
  | { kind: "done"; view: ReportView; isDemo: boolean; illustration: IllustrationControls; devIllustrationTest: { photoUrl: string; photoQualityValid: boolean } | null }
  | { kind: "legacy" }
  | { kind: "empty" }
  | { kind: "error" };

const tick = () => new Promise<void>((r) => setTimeout(r, 0));
const IS_PRODUCTION = process.env.NODE_ENV === "production";

/**
 * Loads the assessment snapshot, runs interpretation → visualization plan →
 * illustration eligibility, and renders the MogaFace report. NO image is
 * generated here: the pipeline gets no image provider, and generation happens
 * only from the button in IllustrationPanel (never on render, refresh or a timer).
 * Development-only URL switches, ignored in production builds:
 *   ?demo=1            synthetic demo assessment; its button produces a MOCK image, nothing is sent anywhere
 *   ?demo=1&image=none       illustration generation is switched off (placeholder only)
 *   ?demo=1&image=noevidence no front photo, so it is not eligible
 *   ?demo=1&image=fail the (mock) generation fails when the button is pressed
 *   ?demo=1&image=consent the demo asks for photo consent first, like a real photo would (still a mock; nothing is sent)
 */
export function ResultsExperience() {
  const [mode, setMode] = useState<Mode>({ kind: "running", stage: "analyzing" });
  const cta = getConsultationCta();
  // The fresh object URL resolved for the front photo (see
  // lib/results/store.ts's resolveStoredFrontPhoto), created in THIS
  // document — revoked below. Never the stored reference itself: a stored
  // snapshot only carries a stable IndexedDB key, never a blob: URL.
  const frontPhotoUrlRef = useRef<string | null>(null);

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

      // The demo fixture's front photo is already a self-contained data: URI
      // (see lib/results/demo.ts) — nothing to resolve. A real snapshot only
      // carries a stable IndexedDB key (see lib/results/store.ts): resolve it
      // into a fresh object URL, created here, now, in this document. Missing
      // media (private browsing, quota, a device that never persisted it)
      // resolves to null — the report's existing "no photo" state, not a
      // broken image.
      let base: AssessmentSnapshot;
      if (demo) {
        base = buildDemoSnapshot();
      } else {
        const frontPhoto = await resolveStoredFrontPhoto(stored!.frontPhoto);
        if (cancelled) {
          if (frontPhoto) URL.revokeObjectURL(frontPhoto.ref);
          return;
        }
        if (frontPhoto) frontPhotoUrlRef.current = frontPhoto.ref;
        base = { ...stored!, frontPhoto };
      }
      const snapshot = imageMode === "noevidence" ? { ...base, frontPhoto: null } : base;

      await tick();

      try {
        const result = await runResultPipeline(snapshot, {
          imageProvider: null, // never generate on render — see IllustrationPanel
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

        const front = snapshot.frontPhoto;
        const illustration: IllustrationControls = {
          generationEnabled: demo ? imageMode !== "none" : process.env.NEXT_PUBLIC_ILLUSTRATION_GENERATION === "1",
          isDemo: demo && imageMode !== "consent", // only controls whether the consent step is shown; a demo never sends anything
          initialConsent: isPhotoVisualizationConsent(snapshot.photoVisualizationConsent) ? snapshot.photoVisualizationConsent : undefined,
          onGenerate: async (consent) => {
            if (!front) return { status: "not_eligible" };
            if (demo) {
              // A mock image from the browser: no network, no photo leaves the page.
              const made = await generateVisualization({
                sourceImage: { url: front.ref, slot: "front" },
                plan: { ...result.visualizationPlan, changes: result.illustration.approvedChanges },
                provider: createMockProvider({ behavior: imageMode === "fail" ? "fail" : "success", latencyMs: 600, render: () => demoAfterImage() }),
                opportunities: snapshot.opportunities,
              });
              return made.status === "ready" && made.imageUrl ? { status: "ready", afterUrl: made.imageUrl, isMock: true } : { status: "failed" };
            }
            const made = await requestIllustration({ photoUrl: front.ref, photoQualityValid: front.qualityValid, opportunities: snapshot.opportunities, consent });
            return made.status === "ready" ? { status: "ready", afterUrl: made.afterUrl, isMock: false } : { status: made.status };
          },
        };
        const devIllustrationTest = front ? { photoUrl: front.ref, photoQualityValid: front.qualityValid } : null;
        set({ kind: "done", view: toReportView(result, front?.ref ?? null), isDemo: snapshot.isDemo === true, illustration, devIllustrationTest });
      } catch {
        set({ kind: "error" });
      }
    }

    void run();
    return () => {
      cancelled = true;
      if (frontPhotoUrlRef.current) {
        URL.revokeObjectURL(frontPhotoUrlRef.current);
        frontPhotoUrlRef.current = null;
      }
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
          <Report view={mode.view} cta={cta} illustration={mode.illustration} devIllustrationTest={mode.devIllustrationTest} />
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
