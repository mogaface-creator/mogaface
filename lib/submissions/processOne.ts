import { comparisonSummary } from "./imageReview.ts";
import { claimSubmission, updateSubmission, type SubmissionRow } from "./store.ts";
import { generateAfterImage } from "./imageJob.ts";
import type { AnalysisRecord } from "../analysis-session/types.ts";
import { isSupabaseConfigured, supabaseRequest } from "../analysis-session/supabaseClient.ts";
import { IMAGE_PLACE_OPTIONS } from "../assessment/intakeQuestions.ts";
import { assessOriginals } from "../review-workspace/generate.server.ts";
import { readPreparedReport, storePreparedReport } from "../review-workspace/prepared.ts";

import { publishBaselineReport } from "../review-workspace/baseline.server.ts";

const defaultSummary = "Your Next Face protocol brings together your answers, original photo views and usable expression-video observations.";
const dependencies = { claim: claimSubmission, update: updateSubmission, assess: assessOriginals, generate: generateAfterImage, publish: publishBaselineReport };

export async function processOne(
  submission: SubmissionRow,
  options?: { regenerate?: boolean; authenticatedRecord?: AnalysisRecord },
  overrides: Partial<typeof dependencies> = {},
): Promise<{ id: string; outcome: "done" | "failed" | "processing"; reason?: string }> {
  const deps = { ...dependencies, ...overrides };
  const { id } = submission;
  const completedAt = options?.authenticatedRecord && submission.status === "done" ? submission.updated_at : undefined;
  if (!await deps.claim(id, {}, completedAt)) return { id, outcome: "processing" };

  try {
    const record = options?.authenticatedRecord || (submission.analysis_id && await getAnalysisRecordById(submission.analysis_id));
    if (!record || !submission.before_image_base64 || !submission.before_image_mime) throw new Error("assessment_unavailable");
    const consented = submission.photo_visualization_consent === "granted";
    const wantsPreview = record.assessment.clinicIntake.wantAfterPhoto !== "no";
    const previous = readPreparedReport(submission.report_summary);
    const approved = consented && wantsPreview && !options?.regenerate && previous.summary.startsWith("Your Next Face protocol") && submission.after_image_base64;
    const detectedAreas = record.assessment.clinicIntake.places.map(value => ({
      label: IMAGE_PLACE_OPTIONS.find(option => option.value === value)?.label || value,
      description: "Selected by you for discussion; not a diagnosis.",
    }));

    // Start both independently. A rejected illustration cannot erase a completed written review.
    const [assessment, illustration] = await Promise.allSettled([
      consented ? previous.review || (record.aiReportConsent ? deps.assess(submission, record) : null) : null,
      consented && wantsPreview && !approved ? prepareIllustration(submission, record, deps.generate) : null,
    ]);
    const review = assessment.status === "fulfilled" ? assessment.value : null;
    if (assessment.status === "rejected") console.warn("[process-submissions] Detailed assessment could not be prepared", { id, reason: assessment.reason instanceof Error ? assessment.reason.message : "unknown" });
    const result = illustration.status === "fulfilled" ? illustration.value : null;
    const afterBase64 = result?.ok ? result.base64 : approved || null;
    const afterMime = result?.ok ? result.mime : approved ? submission.after_image_mime : null;
    const status = afterBase64 ? "included" : !wantsPreview ? "not_requested" : !consented ? "no_ai_consent" : failureState(result?.ok === false ? result.reason : "generation_error");
    const summary = result?.ok ? `${defaultSummary}\n${comparisonSummary(result.review)}`
      : approved ? previous.summary : defaultSummary;
    const readable = `${summary.replace(/\s*\[PREVIEW_STATUS:[^\]]+\]/g, "")} [PREVIEW_STATUS:${status}]`;
    const retryCount = (submission.retry_count ?? 0) + (consented && ((record.aiReportConsent && !review) || (wantsPreview && !afterBase64)) ? 1 : 0);
    let reportKey = previous.reportKey;
    if (review && (!reportKey || afterBase64 !== submission.after_image_base64)) {
      reportKey = await deps.publish(id, record, review,
        { base64: submission.before_image_base64, mime: submission.before_image_mime },
        afterBase64 ? { base64: afterBase64, mime: afterMime || "image/jpeg" } : null,
        AbortSignal.timeout(12_000),
      ).catch(() => null);
    }
    if (!await deps.update(id, { status: "done", afterImageBase64: afterBase64, afterImageMime: afterMime,
      reportSummary: storePreparedReport(readable, review, reportKey), detectedAreas, retryCount,
    })) throw new Error("report_storage_failed");
    return { id, outcome: "done" };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unknown_error";
    console.error("[process-submissions] Report job failed", { id, reason });
    await deps.update(id, { status: "failed", emailError: reason.slice(0, 500), retryCount: (submission.retry_count ?? 0) + 1 }).catch(() => {});
    return { id, outcome: "failed", reason };
  }
}

async function prepareIllustration(submission: SubmissionRow, record: AnalysisRecord, generate: typeof generateAfterImage) {
  const signal = AbortSignal.timeout(155_000);
  const start = Date.now();
  const input = {
    beforeBytes: Buffer.from(submission.before_image_base64!, "base64"),
    beforeMime: submission.before_image_mime as "image/png" | "image/jpeg" | "image/webp",
    record, signal,
  };
  const result = await generate(input);
  if (!result.ok && failureState(result.reason) === "quality_review" && Date.now() - start < 95_000) {
    return generate({ ...input, conservative: true });
  }
  return result;
}

function failureState(reason: string) {
  if (/geometry|mask/.test(reason)) return "geometry_unavailable";
  if (/quality/.test(reason)) return "quality_review";
  if (/review_unavailable/.test(reason)) return "review_unavailable";
  if (/aspect_mismatch/.test(reason)) return "aspect_mismatch";
  if (/composite/.test(reason)) return "composition_failed";
  if (/provider|openai|timeout|rate limit/i.test(reason)) return "provider_unavailable";
  return "generation_failed";
}

/** The submission job uses the service role. Interactive requests must authenticate first. */
async function getAnalysisRecordById(analysisId: string): Promise<AnalysisRecord | null> {
  const env = process.env;
  if (!isSupabaseConfigured(env)) return null;
  const response = await supabaseRequest(env,
    `/analysis_sessions?analysis_id=eq.${encodeURIComponent(analysisId)}&select=record&limit=1`,
    { method: "GET" }).catch(() => null);
  if (!response?.ok) return null;
  const rows = await response.json() as { record: AnalysisRecord }[];
  return rows[0]?.record ?? null;
}
