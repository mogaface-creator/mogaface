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
import { PHOTO_SLOTS, REQUIRED_PHOTO_SLOTS, type Assessment } from "@/lib/assessment/types.ts";
import { validateAssessment } from "@/lib/assessment/schema.ts";
import { canStartAnalysis, slotsMissingActualFile } from "@/lib/assessment/mediaAvailability.ts";
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
import { createAnalysisSession } from "@/lib/analysis-session/client.ts";
import type { AnalysisSessionHandle } from "@/lib/analysis-session/types.ts";
import { PHOTO_VISUALIZATION_CONSENT_SENTENCE, type PhotoVisualizationConsent } from "@/lib/visualization/consent.ts";

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

function buildSections(assessment: Assessment, availablePhotoCount: number): SummarySection[] {
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
      // Counts actual available files, not just metadata — see mediaAvailability.ts.
      title: "Photos",
      rows: [{ label: "Uploaded", value: `${availablePhotoCount} / ${PHOTO_SLOTS.length}` }],
    },
  ];
}

interface AssessmentReviewProps {
  assessment: Assessment;
  sessionFiles: SessionFiles;
  /** Whether the initial restore-from-IndexedDB pass has finished — see AssessmentShell. */
  mediaHydrated: boolean;
  /** The optional expression video (from the camera recorder or a chosen file), cached in IndexedDB by the shell. */
  videoFile: File | null;
  onVideoFileChange: (file: File | null) => void;
  onBack: () => void;
  onStartOver: () => void;
}

export function AssessmentReview({ assessment, sessionFiles, mediaHydrated, videoFile, onVideoFileChange, onBack, onStartOver }: AssessmentReviewProps) {
  const router = useRouter();
  const validation = validateAssessment(assessment);
  const availableSlots = new Set(PHOTO_SLOTS.filter(({ slot }) => sessionFiles[slot]?.file).map((p) => p.slot));

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
  // Set only when the server's OWN, independently-computed eligibility decision (see
  // lib/analysis-session/) finds a genuine, evidence-backed visualization — the one moment this flow
  // asks for photo-visualization consent, as the direct continuation of the single "Analyze My Face"
  // click, never before or after it. Also carries the analysisId/sessionToken the Continue button needs.
  const [confirmingVisualization, setConfirmingVisualization] = useState<AnalysisSessionHandle | null>(null);
  const [creatingSession, setCreatingSession] = useState(false);
  // Tracks which File object each current record was produced from, so a
  // second "Start Analysis" click only reprocesses slots whose photo
  // actually changed (Step 14) while retrying any that previously errored
  // (Step 15) — completed/blocked results for an unchanged file are kept.
  const analyzedFileRef = useRef<Partial<Record<PhotoSlot, File>>>({});

  // Fails closed while the IndexedDB restore is still running: nothing is reported
  // missing until we've actually checked, and nothing is reported available before then either.
  const missingSessionFiles = mediaHydrated ? slotsMissingActualFile(assessment, availableSlots) : [];
  const missingRequiredFiles = missingSessionFiles.filter((s) => REQUIRED_PHOTO_SLOTS.includes(s.slot));
  const missingOptionalFiles = missingSessionFiles.filter((s) => !REQUIRED_PHOTO_SLOTS.includes(s.slot));

  const analyzeMyFace = async () => {
    setIsRunning(true);
    setConfirmingVisualization(null);
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
    const nextTreatmentOpportunities = evaluateTreatmentOpportunities({ assessment, analysis: nextMogaFaceAnalysis });
    setMogaFaceAnalysis(nextMogaFaceAnalysis);
    setTreatmentOpportunities(nextTreatmentOpportunities);
    setProgress(null);
    setIsRunning(false);

    // Hands the raw analysis to the server ONCE: it independently recomputes opportunities and
    // illustration eligibility itself (see lib/analysis-session/) — nothing asserted here is
    // trusted later. Only here, once, does this flow ever ask for photo-visualization consent —
    // and only when the SERVER says there is genuinely something real to ask about. A failed or
    // ineligible session is treated identically: the report still finalizes normally, honestly
    // unavailable, never a fallback that resubmits opportunities directly.
    const frontRecord = nextRecords.find((r) => r.slot === "front");
    setCreatingSession(true);
    const session = await createAnalysisSession({
      assessment,
      analysis: nextMogaFaceAnalysis,
      photoQualityValid: frontRecord?.status === "complete" && frontRecord.quality?.valid === true,
      hasLeftFortyFive: !!sessionFiles.leftFortyFive?.file,
      hasRightFortyFive: !!sessionFiles.rightFortyFive?.file,
    });
    setCreatingSession(false);
    if (session?.illustrationEligible) {
      setConfirmingVisualization(session);
    } else {
      finalizeAndGoToResults(nextMogaFaceAnalysis, nextTreatmentOpportunities, nextRecords, "pending", null);
    }
  };

  /**
   * Hands the analysis to the consumer results page and navigates there — the
   * ONE moment this flow leaves the assessment. The front photo is referenced
   * by its stable IndexedDB key ("front" — already written there by the
   * photo-capture step, see mediaStore.ts/PhotoCaptureStep.tsx), not by blob
   * URL: a blob URL is only valid in this document, and /results loads in a
   * fresh one. No image bytes are stored in the snapshot itself.
   *
   * `consent === "granted"` (only possible right after the inline consent
   * screen below) additionally appends ?autogenerate=1, so /results generates
   * the illustration immediately, without a second click — see
   * ResultsExperience.tsx/IllustrationPanel.tsx's one-shot autoStart handling.
   * `session` (present only when eligible + granted) is carried in the
   * snapshot so /results can request the illustration by reference, never by
   * resubmitting opportunities.
   */
  const finalizeAndGoToResults = (analysis: MogaFaceAnalysis, opportunities: TreatmentOpportunity[], photoRecords: PhotoAnalysisRecord[], consent: PhotoVisualizationConsent, session: AnalysisSessionHandle | null) => {
    const frontRecord = photoRecords.find((r) => r.slot === "front");
    const frontFile = sessionFiles.front?.file;
    const saved = saveSnapshot({
      version: SNAPSHOT_VERSION,
      createdAt: new Date().toISOString(),
      assessment,
      analysis,
      opportunities,
      photoVisualizationConsent: consent,
      frontPhoto: frontFile ? { mediaKey: "front", qualityValid: frontRecord?.status === "complete" && frontRecord.quality?.valid === true } : null,
      ...(consent === "granted" && session ? { analysisSession: { analysisId: session.analysisId, sessionToken: session.sessionToken } } : {}),
    });
    if (saved) router.push(consent === "granted" && session ? "/results?autogenerate=1" : "/results");
  };

  return (
    <div>
      <h2 className="font-serif text-2xl tracking-tight">Your assessment</h2>

      <div className="mt-8 space-y-4">
        {buildSections(assessment, availableSlots.size).map((section) => (
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
                  {PHOTO_SLOTS.map(({ slot, label }) => {
                    const available = availableSlots.has(slot);
                    const unavailable = mediaHydrated && !available && missingSessionFiles.some((s) => s.slot === slot);
                    return (
                      <span
                        key={slot}
                        className={`rounded-full border px-3 py-1 text-xs ${
                          available
                            ? "border-accent text-accent"
                            : unavailable
                              ? "border-amber-400 text-amber-600 dark:text-amber-400"
                              : "border-border text-muted"
                        }`}
                      >
                        {label} {available ? "✓" : unavailable ? "!" : "—"}
                      </span>
                    );
                  })}
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

      {validation.isComplete && !mediaHydrated && (
        <p role="status" className="mt-6 text-sm text-muted">
          Checking your previously saved photos…
        </p>
      )}

      {validation.isComplete && mediaHydrated && missingRequiredFiles.length > 0 && (
        <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 px-5 py-4 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          <p>
            {missingRequiredFiles.map((s) => s.label).join(", ")} {missingRequiredFiles.length === 1 ? "was" : "were"} uploaded
            before this page reloaded, so the photo itself isn&apos;t available anymore — go back to Photos and re-select{" "}
            {missingRequiredFiles.length === 1 ? "it" : "them"} to run analysis.
          </p>
        </div>
      )}

      {validation.isComplete && mediaHydrated && missingRequiredFiles.length === 0 && missingOptionalFiles.length > 0 && (
        <div className="mt-6 rounded-xl border border-border bg-surface px-5 py-4 text-sm text-muted">
          <p>
            {missingOptionalFiles.map((s) => s.label).join(", ")} {missingOptionalFiles.length === 1 ? "isn't" : "aren't"} available
            after reloading. {missingOptionalFiles.length === 1 ? "It's" : "They're"} optional, so analysis can still run — go back to
            Photos and re-select {missingOptionalFiles.length === 1 ? "it" : "them"} if you&apos;d like{" "}
            {missingOptionalFiles.length === 1 ? "it" : "them"} included.
          </p>
        </div>
      )}

      {validation.isComplete && mediaHydrated && missingSessionFiles.length === 0 && (
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
        {mediaHydrated && !videoFile && assessment.video && (
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
            Your previously recorded video isn&apos;t available after reloading — re-record or select it again if you&apos;d like it
            included.
          </p>
        )}
      </div>

      <StepNav
        onBack={onBack}
        onNext={analyzeMyFace}
        nextDisabled={!validation.isComplete || !canStartAnalysis(availableSlots, mediaHydrated) || isRunning || confirmingVisualization !== null}
        nextLabel={isRunning ? "Analyzing…" : "Analyze My Face"}
      />

      {(isRunning || creatingSession) && (
        <p role="status" aria-live="polite" className="mt-6 text-sm font-medium text-accent">
          {progress ? "Reviewing your facial features…" : videoProgress ? "Reviewing your facial expressions…" : creatingSession ? "Preparing your illustrative visualization…" : "Building your personalized report…"}
        </p>
      )}

      {process.env.NODE_ENV !== "production" && (isRunning || analysis) && (
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

      {confirmingVisualization && mogaFaceAnalysis && (
        <div className="mt-8 max-w-2xl rounded-2xl border border-border bg-surface p-6">
          <h3 className="font-serif text-xl tracking-tight">Illustrative visualization</h3>
          <p className="mt-3 text-base leading-7">{PHOTO_VISUALIZATION_CONSENT_SENTENCE}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button type="button" onClick={() => finalizeAndGoToResults(mogaFaceAnalysis, treatmentOpportunities, records, "granted", confirmingVisualization)}>
              Continue
            </Button>
            <Button type="button" variant="secondary" onClick={() => finalizeAndGoToResults(mogaFaceAnalysis, treatmentOpportunities, records, "declined", confirmingVisualization)}>
              Not now
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
