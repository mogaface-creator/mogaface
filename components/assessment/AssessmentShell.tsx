"use client";

import { useEffect, useState } from "react";
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
import { PhotoCollection, type SessionFiles } from "./PhotoCollection";
import { AssessmentReview } from "./AssessmentReview";
import { createEmptyAssessment } from "@/lib/assessment/defaults.ts";
import { loadAssessment, saveAssessment, clearAssessment } from "@/lib/assessment/storage.ts";
import type { Assessment } from "@/lib/assessment/types.ts";

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

  useEffect(() => {
    saveAssessment(assessment);
  }, [assessment]);

  useEffect(() => {
    return () => {
      Object.values(sessionFiles).forEach((f) => f && URL.revokeObjectURL(f.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cleanup only runs on unmount
  }, []);

  const patch = (partial: Partial<Assessment>) => {
    setAssessment((prev) => ({ ...prev, ...partial, updatedAt: new Date().toISOString() }));
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
    Object.values(sessionFiles).forEach((f) => f && URL.revokeObjectURL(f.previewUrl));
    setSessionFiles({});
    setAssessment(createEmptyAssessment());
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
            <PhotoCollection
              photos={assessment.photos}
              sessionFiles={sessionFiles}
              onSessionFilesChange={setSessionFiles}
              onPhotosChange={(photos) => patch({ photos })}
              onNext={goNext}
              onBack={goBack}
            />
          )}

          {stepId === "review" && (
            <AssessmentReview assessment={assessment} sessionFiles={sessionFiles} onBack={goBack} onStartOver={handleStartOver} />
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
