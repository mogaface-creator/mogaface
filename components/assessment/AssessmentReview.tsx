"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { StepNav } from "./StepNav";
import { GENDER_OPTIONS } from "./ProfileStep";
import { GOAL_AREA_OPTIONS, GOAL_PRIORITY_OPTIONS } from "./GoalsStep";
import { LENGTH_OPTIONS, TEXTURE_OPTIONS, DENSITY_OPTIONS, FREQUENCY_OPTIONS } from "./HairStep";
import { STYLE_OPTIONS as FACIAL_HAIR_STYLE_OPTIONS } from "./FacialHairStep";
import { SLEEP_OPTIONS, EXERCISE_OPTIONS, ACTIVITY_OPTIONS } from "./LifestyleStep";
import { CURRENT_STYLE_OPTIONS } from "./StyleStep";
import type { SessionFiles } from "./PhotoCollection";
import { PHOTO_SLOTS, type Assessment } from "@/lib/assessment/types.ts";
import { validateAssessment } from "@/lib/assessment/schema.ts";
import { APPEARANCE_CONCERN_CATALOG, normalizeAppearanceConcerns } from "@/lib/assessment/appearanceConcerns.ts";
import { MultiPhotoDevResults } from "@/components/facial-analysis/MultiPhotoDevResults";
import { analyzeSinglePhoto, buildMultiPhotoAnalysis } from "@/lib/facial-analysis/multiPhoto/coordinator.ts";
import type { MultiPhotoFacialAnalysis, PhotoAnalysisRecord, PhotoSlot } from "@/lib/facial-analysis/multiPhoto/types.ts";
import { buildMogaFaceAnalysis } from "@/lib/observation/build.ts";
import type { MogaFaceAnalysis } from "@/lib/observation/types.ts";
import { analyzeVideoFile } from "@/lib/facial-analysis/video/capture.ts";
import type { VideoExpressionAnalysis } from "@/lib/facial-analysis/video/types.ts";
import { saveSnapshot } from "@/lib/results/store.ts";
import { SNAPSHOT_VERSION } from "@/lib/results/types.ts";
import { evaluateTreatmentOpportunities } from "@/lib/treatment-opportunities/evaluate.ts";
import type { TreatmentOpportunity } from "@/lib/treatment-opportunities/types.ts";

function labelFor<T extends string>(options: { value: T; label: string }[], value: T | null): string {
  if (value === null) return "Not provided";
  return options.find((o) => o.value === value)?.label ?? value;
}

function labelsFor<T extends string>(options: { value: T; label: string }[], values: T[]): string {
  if (values.length === 0) return "None selected";
  return values.map((v) => options.find((o) => o.value === v)?.label ?? v).join(", ");
}

interface SummarySection {
  title: string;
  rows: { label: string; value: string }[];
}

function buildSections(assessment: Assessment): SummarySection[] {
  return [
    {
      title: "Profile",
      rows: [
        { label: "Age", value: assessment.profile.ageYears !== null ? `${assessment.profile.ageYears} years` : "Not provided" },
        { label: "Height", value: assessment.profile.heightCm !== null ? `${assessment.profile.heightCm} cm` : "Not provided" },
        { label: "Weight", value: assessment.profile.weightKg !== null ? `${assessment.profile.weightKg} kg` : "Not provided" },
        { label: "Gender presentation", value: labelFor(GENDER_OPTIONS, assessment.profile.genderPresentation) },
      ],
    },
    {
      title: "Goals",
      rows: [
        { label: "Areas", value: labelsFor(GOAL_AREA_OPTIONS, assessment.goals.areas) },
        { label: "Top priorities", value: labelsFor(GOAL_PRIORITY_OPTIONS, assessment.goals.priorities) },
      ],
    },
    {
      title: "Face & skin concerns",
      rows: [
        {
          label: "Concerns",
          value: labelsFor(
            APPEARANCE_CONCERN_CATALOG.map((c) => ({ value: c.id, label: c.label })),
            assessment.appearanceConcerns.selected,
          ),
        },
        {
          label: "Most important",
          value: labelsFor(
            APPEARANCE_CONCERN_CATALOG.map((c) => ({ value: c.id, label: c.label })),
            assessment.appearanceConcerns.priorities,
          ),
        },
      ],
    },
    {
      title: "Hair",
      rows: [
        { label: "Length", value: labelFor(LENGTH_OPTIONS, assessment.hair.length) },
        { label: "Texture", value: labelFor(TEXTURE_OPTIONS, assessment.hair.texture) },
        { label: "Density", value: labelFor(DENSITY_OPTIONS, assessment.hair.density) },
        { label: "Haircut frequency", value: labelFor(FREQUENCY_OPTIONS, assessment.hair.haircutFrequency) },
      ],
    },
    {
      title: "Facial hair",
      rows: [{ label: "Current style", value: labelFor(FACIAL_HAIR_STYLE_OPTIONS, assessment.facialHair.currentStyle) }],
    },
    {
      title: "Lifestyle",
      rows: [
        { label: "Sleep", value: labelFor(SLEEP_OPTIONS, assessment.lifestyle.sleepHours) },
        { label: "Exercise", value: labelFor(EXERCISE_OPTIONS, assessment.lifestyle.exerciseFrequency) },
        { label: "Daily activity", value: labelFor(ACTIVITY_OPTIONS, assessment.lifestyle.dailyActivity) },
      ],
    },
    {
      title: "Style",
      rows: [{ label: "Current style", value: labelFor(CURRENT_STYLE_OPTIONS, assessment.style.currentStyle) }],
    },
    {
      title: "Photos",
      rows: [{ label: "Uploaded", value: `${assessment.photos.length} / ${PHOTO_SLOTS.length}` }],
    },
  ];
}

interface AssessmentReviewProps {
  assessment: Assessment;
  sessionFiles: SessionFiles;
  /** The optional expression video (from the camera recorder or a chosen file) — held in memory by the shell, never persisted. */
  videoFile: File | null;
  onVideoFileChange: (file: File | null) => void;
  onBack: () => void;
  onStartOver: () => void;
}

export function AssessmentReview({ assessment, sessionFiles, videoFile, onVideoFileChange, onBack, onStartOver }: AssessmentReviewProps) {
  const router = useRouter();
  const validation = validateAssessment(assessment);
  const uploadedSlots = new Set(assessment.photos.map((p) => p.slot));

  const [records, setRecords] = useState<PhotoAnalysisRecord[]>([]);
  const [analysis, setAnalysis] = useState<MultiPhotoFacialAnalysis | null>(null);
  const [mogaFaceAnalysis, setMogaFaceAnalysis] = useState<MogaFaceAnalysis | null>(null);
  // The optional expression video lives in memory only, like the photo files — never persisted.
  const [videoAnalysis, setVideoAnalysis] = useState<VideoExpressionAnalysis | null>(null);
  const [videoProgress, setVideoProgress] = useState<{ done: number; total: number } | null>(null);
  const analyzedVideoRef = useRef<File | null>(null);
  const [treatmentOpportunities, setTreatmentOpportunities] = useState<TreatmentOpportunity[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<{ slot: PhotoSlot; index: number; total: number } | null>(null);
  // Tracks which File object each current record was produced from, so a
  // second "Start Analysis" click only reprocesses slots whose photo
  // actually changed (Step 14) while retrying any that previously errored
  // (Step 15) — completed/blocked results for an unchanged file are kept.
  const analyzedFileRef = useRef<Partial<Record<PhotoSlot, File>>>({});

  const missingSessionFiles = PHOTO_SLOTS.filter(({ slot }) => uploadedSlots.has(slot) && !sessionFiles[slot]?.file);

  const runAnalysis = async () => {
    setIsRunning(true);
    const slotsWithFiles = PHOTO_SLOTS.filter(({ slot }) => sessionFiles[slot]?.file);
    const nextRecords: PhotoAnalysisRecord[] = [];

    for (let i = 0; i < slotsWithFiles.length; i++) {
      const { slot } = slotsWithFiles[i];
      const file = sessionFiles[slot]!.file;
      const previous = records.find((r) => r.slot === slot);
      const unchanged = analyzedFileRef.current[slot] === file;

      if (previous && unchanged && previous.status !== "error") {
        nextRecords.push(previous);
        continue;
      }

      setProgress({ slot, index: i, total: slotsWithFiles.length });
      const record = await analyzeSinglePhoto(slot, file);
      analyzedFileRef.current[slot] = file;
      nextRecords.push(record);
    }

    const nextAnalysis = buildMultiPhotoAnalysis(assessment.id, nextRecords);
    setRecords(nextRecords);
    setAnalysis(nextAnalysis);

    // Video is optional and never blocks the photo analysis: an unreadable video
    // simply comes back as an "insufficient evidence" analysis with notes.
    let nextVideo = videoFile && analyzedVideoRef.current === videoFile ? videoAnalysis : null;
    if (videoFile && analyzedVideoRef.current !== videoFile) {
      setProgress(null);
      nextVideo = await analyzeVideoFile(videoFile, { onProgress: (done, total) => setVideoProgress({ done, total }) });
      analyzedVideoRef.current = videoFile;
      setVideoProgress(null);
    }
    if (!videoFile) analyzedVideoRef.current = null;
    setVideoAnalysis(nextVideo);

    const nextMogaFaceAnalysis = buildMogaFaceAnalysis(assessment, nextAnalysis, nextVideo);
    setMogaFaceAnalysis(nextMogaFaceAnalysis);
    setTreatmentOpportunities(evaluateTreatmentOpportunities({ assessment, analysis: nextMogaFaceAnalysis }));
    setProgress(null);
    setIsRunning(false);
  };

  /**
   * Hands the analysis to the consumer results page. The front photo is passed
   * as a fresh blob URL (the assessment's own preview URLs are revoked when
   * this wizard unmounts); no image bytes are stored.
   */
  const openResults = () => {
    if (!mogaFaceAnalysis) return;
    const frontRecord = records.find((r) => r.slot === "front");
    const frontFile = sessionFiles.front?.file;
    const saved = saveSnapshot({
      version: SNAPSHOT_VERSION,
      createdAt: new Date().toISOString(),
      assessment,
      analysis: mogaFaceAnalysis,
      opportunities: treatmentOpportunities,
      frontPhoto: frontFile ? { ref: URL.createObjectURL(frontFile), qualityValid: frontRecord?.status === "complete" && frontRecord.quality?.valid === true } : null,
    });
    if (saved) router.push("/results");
  };

  return (
    <div>
      <h2 className="font-serif text-2xl tracking-tight">Your assessment</h2>

      <div className="mt-8 space-y-4">
        {buildSections(assessment).map((section) => (
          <div key={section.title} className="rounded-2xl border border-border bg-surface p-6">
            <h3 className="text-sm font-medium uppercase tracking-wide text-muted">{section.title}</h3>
            <dl className="mt-4 space-y-2">
              {section.rows.map((row) => (
                <div key={row.label} className="flex items-baseline justify-between gap-4">
                  <dt className="text-sm text-muted">{row.label}</dt>
                  <dd className="text-right text-sm">{row.value}</dd>
                </div>
              ))}
              {section.title === "Photos" && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {PHOTO_SLOTS.map(({ slot, label }) => (
                    <span
                      key={slot}
                      className={`rounded-full border px-3 py-1 text-xs ${
                        uploadedSlots.has(slot) ? "border-accent text-accent" : "border-border text-muted"
                      }`}
                    >
                      {label} {uploadedSlots.has(slot) ? "✓" : "—"}
                    </span>
                  ))}
                </div>
              )}
            </dl>
          </div>
        ))}
      </div>

      {!validation.isComplete && (
        <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          <p className="font-medium">Still needed before you can start:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {validation.missing.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {validation.isComplete && missingSessionFiles.length > 0 && (
        <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          <p>
            {missingSessionFiles.map((s) => s.label).join(", ")} {missingSessionFiles.length === 1 ? "was" : "were"} uploaded
            before this page reloaded, so the photo itself isn&apos;t available anymore — go back to Photos and re-select{" "}
            {missingSessionFiles.length === 1 ? "it" : "them"} to run analysis.
          </p>
        </div>
      )}

      {validation.isComplete && missingSessionFiles.length === 0 && (
        <p role="status" className="mt-6 text-sm font-medium text-accent">
          Assessment ready for analysis.
        </p>
      )}

      <div className="mt-6 rounded-2xl border border-border bg-surface p-6">
        <h3 className="text-sm font-medium uppercase tracking-wide text-muted">Expression video (optional)</h3>
        <p className="mt-2 text-sm text-muted">
          A short video (under 60 seconds) that starts with a still, relaxed face, then raises the eyebrows, frowns, smiles and squints. It stays on this device.
        </p>
        <input
          type="file"
          accept="video/*"
          aria-label="Expression video"
          disabled={isRunning}
          onChange={(e) => onVideoFileChange(e.target.files?.[0] ?? null)}
          className="mt-3 block text-sm"
        />
        {videoFile && (
          <p className="mt-2 text-xs text-muted">
            {videoFile.name.startsWith("expression.") ? "Expression video recorded with your camera." : `Selected: ${videoFile.name}`}{" "}
            <button type="button" onClick={() => onVideoFileChange(null)} className="underline">
              Remove
            </button>
          </p>
        )}
      </div>

      {videoProgress && (
        <p role="status" aria-live="polite" className="mt-4 text-sm text-muted">
          Reading video frame {videoProgress.done} of {videoProgress.total}…
        </p>
      )}

      <StepNav
        onBack={onBack}
        onNext={runAnalysis}
        nextDisabled={!validation.isComplete || missingSessionFiles.length > 0 || isRunning}
        nextLabel={isRunning ? "Analyzing…" : "Start Analysis"}
      />

      {(isRunning || analysis) && (
        <div className="mt-8">
          <MultiPhotoDevResults
            photos={records}
            analysis={analysis}
            mogaFaceAnalysis={mogaFaceAnalysis}
            treatmentOpportunities={treatmentOpportunities}
            userReportedSignals={normalizeAppearanceConcerns(assessment.appearanceConcerns)}
            videoAnalysis={videoAnalysis}
            isRunning={isRunning}
            progress={progress}
          />
        </div>
      )}

      {mogaFaceAnalysis && !isRunning && (
        <div className="mt-8 rounded-2xl border border-accent px-6 py-6 text-center">
          <p className="text-sm text-muted">Analysis complete. The section above is the developer view.</p>
          <div className="mt-4 flex justify-center">
            <Button type="button" onClick={openResults}>
              View My Results
            </Button>
          </div>
        </div>
      )}

      <div className="mt-6 flex justify-center">
        <Button type="button" variant="ghost" onClick={onStartOver}>
          Start over
        </Button>
      </div>
    </div>
  );
}
