"use client";

import { useEffect, useRef, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { AssessmentProgress } from "./AssessmentProgress";
import { AssessmentIntro } from "./AssessmentIntro";
import { ClinicIntakeSection } from "./ClinicIntakeSection";
import { asksByIds, previewCanContinue, visibleScreens } from "@/lib/assessment/intakeFlow.ts";
import { PhotoInstructions } from "./PhotoInstructions";
import { PhotoCaptureStep } from "./PhotoCaptureStep";
import type { SessionFiles } from "./PhotoCollection";
import { AssessmentReview } from "./AssessmentReview";
import { createEmptyAssessment } from "@/lib/assessment/defaults.ts";
import { loadAssessment, saveAssessment, clearAssessment } from "@/lib/assessment/storage.ts";
import { clearAllMedia, deleteMedia, getMedia, putMedia } from "@/lib/assessment/mediaStore.ts";
import { mediaMetadataFor } from "@/lib/assessment/photoMeta.ts";
import { PHOTO_SLOTS, type Assessment } from "@/lib/assessment/types.ts";

const STEP_ORDER = ["intro", "preview", "photoInstructions", "photoCollection", "review"] as const;
type StepId = (typeof STEP_ORDER)[number];

const PROGRESS_INDEX: Partial<Record<StepId, number>> = {
  preview: 0,
  photoInstructions: 1,
  photoCollection: 1,
  review: 2,
};

// This component is only ever mounted client-side (see app/assessment/page.tsx,
// which loads it with next/dynamic + ssr:false), so reading localStorage
// directly in the initializer is safe — there is no server render to mismatch.
function checkNewRequested(): boolean {
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.get("new") === "1" || params.get("reset") === "1";
}

function initialAssessment(): Assessment {
  if (checkNewRequested()) {
    clearAssessment();
    void clearAllMedia();
    return createEmptyAssessment();
  }
  return loadAssessment() ?? createEmptyAssessment();
}

export function AssessmentShell() {
  const [assessment, setAssessment] = useState<Assessment>(initialAssessment);
  const [stepId, setStepId] = useState<StepId>("intro");
  const [cursor, setCursor] = useState(0);
  const [sessionFiles, setSessionFiles] = useState<SessionFiles>({});
  // The optional expression video (camera recording or a chosen file). Its bytes are
  // cached in IndexedDB (see mediaStore.ts) so it survives a reload like the photos do.
  const [sessionVideo, setSessionVideo] = useState<File | null>(null);
  // False until the initial restore-from-IndexedDB pass below has run — see mediaAvailability.ts.
  const [mediaHydrated, setMediaHydrated] = useState(false);

  useEffect(() => {
    saveAssessment(assessment);
  }, [assessment]);

  // Restores actual File objects cached from a previous session (see mediaStore.ts) using
  // the metadata loaded at mount. Runs once: later photo/video changes update sessionFiles
  // directly, they don't need to go through IndexedDB again.
  useEffect(() => {
    if (checkNewRequested()) {
      clearAssessment();
      void clearAllMedia();
      setSessionFiles({});
      setSessionVideo(null);
      setMediaHydrated(true);
      if (typeof window !== "undefined" && window.history?.replaceState) {
        window.history.replaceState({}, "", window.location.pathname);
      }
      return;
    }

    let cancelled = false;
    (async () => {
      const restoredFiles: SessionFiles = {};
      for (const { slot } of PHOTO_SLOTS) {
        const meta = assessment.photos.find((p) => p.slot === slot);
        if (!meta) continue;
        const blob = await getMedia(slot);
        if (!blob) continue;
        const file = new File([blob], meta.fileName, { type: blob.type, lastModified: Date.parse(meta.uploadedAt) || Date.now() });
        restoredFiles[slot] = { file, previewUrl: URL.createObjectURL(file) };
      }
      if (cancelled) return;
      if (Object.keys(restoredFiles).length > 0) setSessionFiles((prev) => ({ ...restoredFiles, ...prev }));

      if (assessment.video) {
        const blob = await getMedia("video");
        if (!cancelled && blob) {
          const meta = assessment.video;
          setSessionVideo(new File([blob], meta.fileName, { type: blob.type, lastModified: Date.parse(meta.uploadedAt) || Date.now() }));
        }
      }
      if (!cancelled) setMediaHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restore once, from the assessment loaded at mount
  }, []);

  // sessionFiles changes often; the unmount cleanup below needs the latest value without
  // re-running the effect (and its cleanup) on every change.
  const sessionFilesRef = useRef(sessionFiles);
  useEffect(() => {
    sessionFilesRef.current = sessionFiles;
  }, [sessionFiles]);

  useEffect(() => {
    return () => {
      Object.values(sessionFilesRef.current).forEach((f) => f && URL.revokeObjectURL(f.previewUrl));
    };
  }, []);

  const patch = (partial: Partial<Assessment>) => {
    setAssessment((prev) => ({ ...prev, ...partial, updatedAt: new Date().toISOString() }));
  };

  const handleVideoFileChange = (file: File | null) => {
    setSessionVideo(file);
    if (file) {
      void putMedia("video", file);
      patch({ video: mediaMetadataFor(file) });
    } else {
      void deleteMedia("video");
      patch({ video: null });
    }
  };

  const stepIndex = STEP_ORDER.indexOf(stepId);
  const goNext = () => {
    setStepId(STEP_ORDER[Math.min(stepIndex + 1, STEP_ORDER.length - 1)]);
    window.scrollTo({ top: 0 });
  };
  const goBack = () => {
    setStepId(STEP_ORDER[Math.max(stepIndex - 1, 0)]);
    window.scrollTo({ top: 0 });
  };
  const toTop = () => window.scrollTo({ top: 0 });
  const screens = visibleScreens(assessment.clinicIntake);
  const safeCursor = Math.min(cursor, Math.max(screens.length - 1, 0));
  const preview = screens[safeCursor];

  const begin = () => {
    clearAssessment();
    void clearAllMedia();
    Object.values(sessionFilesRef.current).forEach((f) => f && URL.revokeObjectURL(f.previewUrl));
    setSessionFiles({});
    setSessionVideo(null);
    const fresh = createEmptyAssessment();
    setAssessment(fresh);
    saveAssessment(fresh);
    setMediaHydrated(true);
    setCursor(0);
    setStepId("preview");
    toTop();
  };

  const resume = () => {
    setCursor(0);
    setStepId("preview");
    toTop();
  };
  const previewNext = (updated?: Assessment) => {
    const source = updated?.clinicIntake ? updated : assessment;
    const currentId = screens[safeCursor]?.id;
    const nextScreens = visibleScreens(source.clinicIntake);
    const index = currentId ? nextScreens.findIndex((screen) => screen.id === currentId) : -1;
    if (index >= 0 && index < nextScreens.length - 1) setCursor(index + 1);
    else setStepId("photoInstructions");
    toTop();
  };
  const previewBack = () => {
    if (safeCursor > 0) setCursor(safeCursor - 1);
    else setStepId("intro");
    toTop();
  };
  const backToQuestions = () => {
    const last = visibleScreens(assessment.clinicIntake);
    setCursor(Math.max(last.length - 1, 0));
    setStepId("preview");
    toTop();
  };

  const handleStartOver = () => {
    if (typeof window !== "undefined" && !window.confirm("Start over? This clears your saved assessment on this device.")) {
      return;
    }
    clearAssessment();
    void clearAllMedia();
    Object.values(sessionFiles).forEach((f) => f && URL.revokeObjectURL(f.previewUrl));
    setSessionFiles({});
    setSessionVideo(null);
    setAssessment(createEmptyAssessment());
    setMediaHydrated(true); // a fresh assessment has no metadata to restore, so there's nothing left to check
    setCursor(0);
    setStepId("intro");
  };

  const progressIndex = PROGRESS_INDEX[stepId];

  return (
    <>
      <Header />
      <main className="flex-1">
        <div className={`mx-auto max-w-2xl px-6 ${stepId === "preview" ? "py-10" : "py-16"}`}>
          {progressIndex !== undefined && (
            <div className="mb-10">
              <AssessmentProgress currentStep={progressIndex} />
            </div>
          )}

          {stepId === "intro" && (
            <AssessmentIntro
              onBegin={begin}
              hasExistingData={assessment.photos.length > 0 || (assessment.clinicIntake.places && assessment.clinicIntake.places.length > 0)}
              onResume={resume}
            />
          )}

          {stepId === "preview" && preview && (
            <ClinicIntakeSection
              asks={asksByIds(preview.askIds)}
              title={preview.title}
              counter={`${String(safeCursor + 1).padStart(2, "0")} / ${String(screens.length).padStart(2, "0")}`}
              assessment={assessment}
              onChange={(next) => patch(next)}
              onNext={previewNext}
              onBack={previewBack}
              nextDisabled={!previewCanContinue(preview.id, assessment.clinicIntake)}
              autoAdvance={preview.auto}
            />
          )}

          {stepId === "photoInstructions" && (
            <PhotoInstructions
              onNext={goNext}
              onBack={backToQuestions}
            />
          )}

          {stepId === "photoCollection" && (
            <PhotoCaptureStep
              photos={assessment.photos}
              sessionFiles={sessionFiles}
              mediaHydrated={mediaHydrated}
              onSessionFilesChange={setSessionFiles}
              onPhotosChange={(photos) => patch({ photos })}
              onVideoFileChange={handleVideoFileChange}
              onNext={goNext}
              onBack={goBack}
            />
          )}

          {stepId === "review" && (
            <AssessmentReview
              assessment={assessment}
              sessionFiles={sessionFiles}
              mediaHydrated={mediaHydrated}
              videoFile={sessionVideo}
              onVideoFileChange={handleVideoFileChange}
              onBack={goBack}
              onStartOver={handleStartOver}
            />
          )}
        </div>
      </main>
      {stepId !== "preview" && <Footer />}
    </>
  );
}
