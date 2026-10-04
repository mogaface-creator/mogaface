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
import { evaluateTreatmentOpportunities } from "@/lib/treatment-opportunities/evaluate.ts";
import type { TreatmentOpportunity } from "@/lib/treatment-opportunities/types.ts";
import { createAnalysisSession } from "@/lib/analysis-session/client.ts";
import { parseLeadContact } from "@/lib/leads/contact.ts";
import { intakeReviewSections } from "@/lib/assessment/clinicIntake.ts";
import type { AnalysisSessionHandle } from "@/lib/analysis-session/types.ts";
import { submitAssessment } from "@/lib/submissions/client.ts";

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
  stack?: boolean;
}

function buildSections(assessment: Assessment, availablePhotoCount: number): SummarySection[] {
  const intakeSections = intakeReviewSections(assessment.clinicIntake);

  // Only include legacy sections if the user actually populated them (avoiding "Not provided" ghost cards)
  const legacySections: SummarySection[] = [];

  if (assessment.profile.genderPresentation) {
    legacySections.push({
      title: "Profile",
      rows: [
        { label: "Gender presentation", value: labelFor(GENDER_OPTIONS, assessment.profile.genderPresentation) },
      ],
    });
  }

  if (assessment.hair.length || assessment.hair.texture || assessment.hair.density) {
    legacySections.push({
      title: "Hair",
      rows: [
        { label: "Length", value: labelFor(LENGTH_OPTIONS, assessment.hair.length) },
        { label: "Texture", value: labelFor(TEXTURE_OPTIONS, assessment.hair.texture) },
        { label: "Density", value: labelFor(DENSITY_OPTIONS, assessment.hair.density) },
        { label: "Haircut frequency", value: labelFor(FREQUENCY_OPTIONS, assessment.hair.haircutFrequency) },
      ],
    });
  }

  if (assessment.facialHair.currentStyle) {
    legacySections.push({
      title: "Facial hair",
      rows: [{ label: "Current style", value: labelFor(FACIAL_HAIR_STYLE_OPTIONS, assessment.facialHair.currentStyle) }],
    });
  }

  if (assessment.lifestyle.exerciseFrequency || assessment.lifestyle.dailyActivity) {
    legacySections.push({
      title: "Lifestyle",
      rows: [
        { label: "Exercise", value: labelFor(EXERCISE_OPTIONS, assessment.lifestyle.exerciseFrequency) },
        { label: "Daily activity", value: labelFor(ACTIVITY_OPTIONS, assessment.lifestyle.dailyActivity) },
      ],
    });
  }

  if (assessment.style.currentStyle) {
    legacySections.push({
      title: "Style",
      rows: [{ label: "Current style", value: labelFor(CURRENT_STYLE_OPTIONS, assessment.style.currentStyle) }],
    });
  }

  return [
    ...intakeSections,
    ...legacySections,
    {
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
  const [contact, setContact] = useState({ name: "", phone: "", email: "", location: "" });
  const lead = parseLeadContact(contact);
  const [creatingSession, setCreatingSession] = useState(false);
  const [submitting, setSubmitting] = useState(false);
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

    // Hands the raw analysis to the server: it independently recomputes
    // opportunities and eligibility (see lib/analysis-session/). Then creates
    // an async submission row (send_after = now + 30 min) and navigates to
    // /submitted — the background job handles image generation + PDF + email.
    const frontRecord = nextRecords.find((r) => r.slot === "front");
    setCreatingSession(true);
    const session = await createAnalysisSession({
      assessment,
      analysis: nextMogaFaceAnalysis,
      photoQualityValid: frontRecord?.status === "complete" && frontRecord.quality?.valid === true,
      hasLeftFortyFive: !!sessionFiles.leftFortyFive?.file,
      hasRightFortyFive: !!sessionFiles.rightFortyFive?.file,
      ...(lead ? { contact: lead } : {}),
    });
    setCreatingSession(false);
    await submitAndRedirect(session);
  };

  /**
   * Sends the front photo to /api/submit-assessment, which schedules the
   * async PDF + email job. Then navigates to /submitted.
   * Called right after the analysis session is created (or fails — we still
   * create a submission so the lead is not lost).
   */
  const submitAndRedirect = async (session: AnalysisSessionHandle | null) => {
    const frontFile = sessionFiles.front?.file;
    if (!frontFile) {
      // No front photo available (shouldn't happen, but fail gracefully)
      router.push("/submitted");
      return;
    }
    setSubmitting(true);
    const result = await submitAssessment({
      frontPhotoFile: frontFile,
      photoVisualizationConsent: "granted",
      ...(session ? { analysisId: session.analysisId, sessionToken: session.sessionToken } : {}),
    });
    setSubmitting(false);
    if (!result.ok) {
      console.error("[submit] Failed to create submission:", result.reason);
    }
    const targetUrl =
      result.ok && result.submissionId
        ? `/submitted?id=${encodeURIComponent(result.submissionId)}`
        : "/submitted";
    router.push(targetUrl);
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
                <div key={row.label} className={section.stack ? "block" : "flex items-baseline justify-between gap-4"}>
                  <dt className="text-sm text-muted">{row.label}</dt>
                  <dd className={section.stack ? "mt-1 text-sm leading-6 whitespace-pre-wrap" : "text-right text-sm"}>{row.value}</dd>
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

      <div className="mt-6 rounded-2xl border border-border bg-surface p-6">
        <h3 className="text-sm font-medium uppercase tracking-wide text-muted">Your details</h3>
        <p className="mt-2 text-sm text-muted">The clinic uses these to reach you about your results. They are not used to create the image.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {(
            [
              ["name", "Name", "text", "Your name"],
              ["phone", "Phone", "tel", "Phone number"],
              ["email", "Email", "email", "Email address"],
              ["location", "Location", "text", "City"],
            ] as const
          ).map(([key, label, type, placeholder]) => (
            <label key={key} className="block">
              <span className="text-sm font-medium">{label}</span>
              <input
                type={type}
                autoComplete={key === "name" ? "name" : key === "phone" ? "tel" : key === "email" ? "email" : "address-level2"}
                placeholder={placeholder}
                value={contact[key]}
                onChange={(e) => setContact({ ...contact, [key]: e.target.value })}
                className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
            </label>
          ))}
        </div>
        {!lead && <p className="mt-4 text-sm text-muted">Add your name, phone, email, and city to continue.</p>}
      </div>

      <StepNav
        onBack={onBack}
        onNext={analyzeMyFace}
        nextDisabled={!lead || !validation.isComplete || !canStartAnalysis(availableSlots, mediaHydrated) || isRunning || submitting}
        nextLabel={submitting ? "Submitting…" : isRunning ? "Analyzing…" : "Analyze My Face"}
      />

      {(isRunning || creatingSession || submitting) && (
        <p role="status" aria-live="polite" className="mt-6 text-sm font-medium text-accent">
          {submitting ? "Submitting your assessment…" : progress ? "Reviewing your facial features…" : videoProgress ? "Reviewing your facial expressions…" : creatingSession ? "Preparing your report…" : "Building your personalized report…"}
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



      <div className="mt-6 flex justify-center">
        <Button type="button" variant="ghost" onClick={onStartOver}>
          Start over
        </Button>
      </div>
    </div>
  );
}
