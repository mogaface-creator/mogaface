"use client";

import { useEffect, useRef, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { AssessmentProgress } from "./AssessmentProgress";
import { AssessmentIntro } from "./AssessmentIntro";
import { ProfileStep } from "./ProfileStep";
import { GoalsStep } from "./GoalsStep";
import { AppearanceConcernsStep } from "./AppearanceConcernsStep";
import { HairStep } from "./HairStep";
import { FacialHairStep } from "./FacialHairStep";
import { LifestyleStep } from "./LifestyleStep";
import { StyleStep } from "./StyleStep";
import { PhotoInstructions } from "./PhotoInstructions";
import { PhotoCaptureStep } from "./PhotoCaptureStep";
import type { SessionFiles } from "./PhotoCollection";
import { AssessmentReview } from "./AssessmentReview";
import { createEmptyAssessment } from "@/lib/assessment/defaults.ts";
import { loadAssessment, saveAssessment, clearAssessment } from "@/lib/assessment/storage.ts";
import { clearAllMedia, deleteMedia, getMedia, putMedia } from "@/lib/assessment/mediaStore.ts";
import { mediaMetadataFor } from "@/lib/assessment/photoMeta.ts";
import { PHOTO_SLOTS, type Assessment } from "@/lib/assessment/types.ts";

const STEP_ORDER = [
  "intro",
  "profile",
  "goals",
  "appearanceConcerns",
  "hair",
  "facialHair",
  "lifestyle",
  "style",
  "photoInstructions",
  "photoCollection",
  "review",
] as const;
type StepId = (typeof STEP_ORDER)[number];

const PROGRESS_INDEX: Partial<Record<StepId, number>> = {
  profile: 0,
  goals: 1,
  appearanceConcerns: 2,
  hair: 3,
  facialHair: 4,
  lifestyle: 5,
  style: 6,
  photoInstructions: 7,
  photoCollection: 7,
  review: 8,
};

// This component is only ever mounted client-side (see app/assessment/page.tsx,
// which loads it with next/dynamic + ssr:false), so reading localStorage
// directly in the initializer is safe — there is no server render to mismatch.
function initialAssessment(): Assessment {
  return loadAssessment() ?? createEmptyAssessment();
}

export function AssessmentShell() {
  const [assessment, setAssessment] = useState<Assessment>(initialAssessment);
  const [stepId, setStepId] = useState<StepId>("intro");
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
    setStepId("intro");
  };

  const progressIndex = PROGRESS_INDEX[stepId];

  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-2xl px-6 py-16">
          {progressIndex !== undefined && (
            <div className="mb-10">
              <AssessmentProgress currentStep={progressIndex} />
            </div>
          )}

          {stepId === "intro" && <AssessmentIntro onBegin={goNext} />}

          {stepId === "profile" && (
            <ProfileStep value={assessment.profile} onChange={(profile) => patch({ profile })} onNext={goNext} onBack={goBack} />
          )}

          {stepId === "goals" && (
            <GoalsStep value={assessment.goals} onChange={(goals) => patch({ goals })} onNext={goNext} onBack={goBack} />
          )}

          {stepId === "appearanceConcerns" && (
            <AppearanceConcernsStep
              value={assessment.appearanceConcerns}
              onChange={(appearanceConcerns) => patch({ appearanceConcerns })}
              onNext={goNext}
              onBack={goBack}
            />
          )}

          {stepId === "hair" && (
            <HairStep value={assessment.hair} onChange={(hair) => patch({ hair })} onNext={goNext} onBack={goBack} />
          )}

          {stepId === "facialHair" && (
            <FacialHairStep
              value={assessment.facialHair}
              onChange={(facialHair) => patch({ facialHair })}
              onNext={goNext}
              onBack={goBack}
            />
          )}

          {stepId === "lifestyle" && (
            <LifestyleStep
              value={assessment.lifestyle}
              onChange={(lifestyle) => patch({ lifestyle })}
              onNext={goNext}
              onBack={goBack}
            />
          )}

          {stepId === "style" && (
            <StyleStep value={assessment.style} onChange={(style) => patch({ style })} onNext={goNext} onBack={goBack} />
          )}

          {stepId === "photoInstructions" && <PhotoInstructions onNext={goNext} onBack={goBack} />}

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
      <Footer />
    </>
  );
}
