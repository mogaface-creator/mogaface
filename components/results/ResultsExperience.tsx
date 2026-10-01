"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { requestIllustration } from "@/lib/image-generation/client.ts";
import { requestDevE2EIllustration } from "@/lib/image-generation/devE2EClient.ts";
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
import { getMedia } from "@/lib/assessment/mediaStore.ts";
import { loadAnalysisResult } from "@/lib/facial-analysis/resultStore.ts";
import type { AssessmentSnapshot, ResultStage } from "@/lib/results/types.ts";
import { Report } from "./Report";
import type { IllustrationControls } from "./IllustrationPanel";
import { LegacyResults } from "./LegacyResults";
import { LoadingState } from "./LoadingState";

type Mode =
  | { kind: "running"; stage: ResultStage }
  | { kind: "done"; view: ReportView; isDemo: boolean; isDevPreview: boolean; illustration: IllustrationControls; devIllustrationTest: { photoUrl: string; photoQualityValid: boolean } | null }
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
 *   ?devPreview=1      REAL assessment snapshot (never synthetic), with the pending
 *                      expression-calibration milestone bypassed for THIS render only —
 *                      see devE2EHandler.ts for the server-side half of this. Ignored
 *                      together with ?demo=1.
 *
 * A REAL, production feature (not development-only): ?autogenerate=1 is set once,
 * by AssessmentReview.tsx's own navigation, only immediately after the person's
 * own "Analyze My Face" click already obtained fresh photo-visualization consent
 * for an eligible result. It is read and stripped from the URL on this one
 * render, so a later refresh or revisit of the same /results URL never
 * re-triggers generation — see IllustrationPanel.tsx's autoStart handling.
 */
export function ResultsExperience() {
  const [mode, setMode] = useState<Mode>({ kind: "running", stage: "analyzing" });
  const cta = getConsultationCta();
  // The fresh object URL resolved for the front photo (see
  // lib/results/store.ts's resolveStoredFrontPhoto), created in THIS
  // document — revoked below. Never the stored reference itself: a stored
  // snapshot only carries a stable IndexedDB key, never a blob: URL.
  const frontPhotoUrlRef = useRef<string | null>(null);
  // Same pattern for the person's own real left 45°/right 45° photo, when
  // they actually captured one — resolved directly from IndexedDB (see
  // lib/assessment/mediaStore.ts), never invented when absent.
  const leftFortyFiveUrlRef = useRef<string | null>(null);
  const rightFortyFiveUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const set = (m: Mode) => {
      if (!cancelled) setMode(m);
    };

    async function run() {
      const params = new URLSearchParams(window.location.search);
      const demo = !IS_PRODUCTION && params.get("demo") === "1";
      const devPreview = !IS_PRODUCTION && !demo && params.get("devPreview") === "1";
      // The developer supervised-fixture test (DevIllustrationTest.tsx) must never appear in the
      // normal consumer flow — even in a dev server, which is otherwise indistinguishable from a
      // real visit. Same explicit-opt-in pattern as demo/devPreview above.
      const devToolsRequested = !IS_PRODUCTION && params.get("devTools") === "1";
      const imageMode = IS_PRODUCTION ? null : params.get("image");
      const autoGenerateRequested = !demo && params.get("autogenerate") === "1";
      if (autoGenerateRequested) window.history.replaceState(null, "", window.location.pathname);

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

      // Same-document, fresh object URLs for the person's own real left/right
      // 45° photos, when they actually captured one — resolved once, here,
      // exactly like the front photo. Missing media resolves to null: never
      // a stand-in image, never a reason to fail the rest of the page.
      if (!demo) {
        const [leftBlob, rightBlob] = await Promise.all([getMedia("leftFortyFive"), getMedia("rightFortyFive")]);
        if (cancelled) {
          return;
        }
        if (leftBlob) leftFortyFiveUrlRef.current = URL.createObjectURL(leftBlob);
        if (rightBlob) rightFortyFiveUrlRef.current = URL.createObjectURL(rightBlob);
      }

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
          calibrated: demo || devPreview ? true : undefined, // the demo and the isolated dev/clinic e2e preview are the only two callers that override this — see lib/results/demo.ts and devE2EHandler.ts
          onStage: (stage) => set({ kind: "running", stage }),
        });

        const front = snapshot.frontPhoto;
        const afterPhotoDeclined = snapshot.assessment.clinicIntake?.wantAfterPhoto === "no";
        const illustration: IllustrationControls = {
          generationEnabled: afterPhotoDeclined ? false : demo ? imageMode !== "none" : devPreview ? true : process.env.NEXT_PUBLIC_ILLUSTRATION_GENERATION === "1",
          afterPhotoDeclined,
          isDemo: demo && imageMode !== "consent", // only controls whether the consent step is shown; a demo never sends anything
          initialConsent: isPhotoVisualizationConsent(snapshot.photoVisualizationConsent) ? snapshot.photoVisualizationConsent : undefined,
          autoStart: autoGenerateRequested,
          trustedSession: !!snapshot.analysisSession,
          leftFortyFiveBeforeUrl: leftFortyFiveUrlRef.current,
          rightFortyFiveBeforeUrl: rightFortyFiveUrlRef.current,
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
            // devPreview sends the REAL opportunities to the isolated dev/clinic e2e route
            // (devE2EHandler.ts), which alone may bypass the pending calibration milestone,
            // and only for real, evidence-backed expression_lines opportunities. A normal
            // real visit never submits opportunities at all: it references the trusted
            // analysis-session record AssessmentReview.tsx created once, at analysis time (see
            // lib/analysis-session/) — the server resolves its OWN opportunities from that,
            // never trusting anything this request body claims.
            if (devPreview) {
              const made = await requestDevE2EIllustration({ photoUrl: front.ref, photoQualityValid: front.qualityValid, opportunities: snapshot.opportunities, consent });
              return made.status === "ready" ? { status: "ready", afterUrl: made.afterUrl, isMock: false } : { status: made.status };
            }
            if (!snapshot.analysisSession) return { status: "not_eligible" };
            const made = await requestIllustration({
              photoUrl: front.ref,
              photoQualityValid: front.qualityValid,
              leftFortyFivePhotoUrl: leftFortyFiveUrlRef.current ?? undefined,
              rightFortyFivePhotoUrl: rightFortyFiveUrlRef.current ?? undefined,
              analysisId: snapshot.analysisSession.analysisId,
              sessionToken: snapshot.analysisSession.sessionToken,
              consent,
            });
            return made.front.status === "ready" ? { status: "ready", afterUrl: made.front.afterUrl, isMock: false, secondaryAngles: { leftFortyFive: made.leftFortyFive, rightFortyFive: made.rightFortyFive }, areas: made.areas } : { status: made.front.status };
          },
        };
        const devIllustrationTest = devToolsRequested && front ? { photoUrl: front.ref, photoQualityValid: front.qualityValid } : null;
        set({ kind: "done", view: toReportView(result, front?.ref ?? null), isDemo: snapshot.isDemo === true, isDevPreview: devPreview, illustration, devIllustrationTest });
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
      if (leftFortyFiveUrlRef.current) {
        URL.revokeObjectURL(leftFortyFiveUrlRef.current);
        leftFortyFiveUrlRef.current = null;
      }
      if (rightFortyFiveUrlRef.current) {
        URL.revokeObjectURL(rightFortyFiveUrlRef.current);
        rightFortyFiveUrlRef.current = null;
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
          {mode.isDevPreview && (
            <p role="note" className="mb-12 rounded-2xl border border-amber-300 bg-amber-50 px-5 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
              DEVELOPER / CLINIC TESTING ONLY. This preview is for evaluating the MogaFace experience and is not a calibrated clinical result.
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
