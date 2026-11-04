import {comparisonSummary} from "./imageReview";
import {claimSubmission,updateSubmission} from "./store";
import type {SubmissionRow} from "./store";
import {generateAfterImage} from "./imageJob";
import {getAnalysisRecord} from "../analysis-session/store";
import {IMAGE_PLACE_OPTIONS} from "../assessment/intakeQuestions";
export async function processOne(
  submission: SubmissionRow,
  options?: { regenerate?: boolean },
): Promise<{ id: string; outcome: "done" | "failed" | "processing"; reason?: string }> {
  const { id } = submission;

  // Claim the row
  if(!await claimSubmission(id))return {id,outcome:"processing"};

  try {
    // 1. Resolve the analysis record (treatment opportunities + assessment)
    let record = null;
    if (submission.analysis_id) {
      record = await getAnalysisRecordById(submission.analysis_id);
    }


    // 3. Decode the before photo
    if (!submission.before_image_base64 || !submission.before_image_mime) {
      await updateSubmission(id, {
        status: "failed",
        emailError: "No before photo stored",
        retryCount: (submission.retry_count ?? 0) + 1,
      });
      return { id, outcome: "failed", reason: "no_before_photo" };
    }

    const beforeBytes = Buffer.from(submission.before_image_base64, "base64");

    // Restrict observations and edits to the user-selected areas.

    const consented = submission.photo_visualization_consent === "granted";
    if(!record)throw new Error("assessment_unavailable");
    const selectedPlaces = record.assessment.clinicIntake.places;
    const wantsPreview=record.assessment.clinicIntake.wantAfterPhoto !== "no";
    let reportSummary="Your Next Face protocol brings together your answers, original photo views and any usable expression-video observations. The appearance preview, when included, is illustrative and not a treatment outcome.";
    const detectedAreas=selectedPlaces.map(value=>({label:IMAGE_PLACE_OPTIONS.find(option=>option.value===value)?.label || value,description:"Selected by you for discussion; not a diagnosis."}));

    // Reuse only a current, already quality-screened draft after a background retry.

    // Generate a fresh preview and reject it if quality review fails.
    let afterBase64: string | null = null;
    let afterMime: string | null = null;

    if(consented && wantsPreview && !options?.regenerate && submission.report_summary?.startsWith("Your Next Face protocol") && submission.after_image_base64){afterBase64=submission.after_image_base64;afterMime=submission.after_image_mime;}
    let previewStatus = afterBase64 ? "included" : !wantsPreview ? "not_requested" : !consented ? "no_ai_consent" : "generation_failed";
    if(afterBase64 && submission.report_summary?.startsWith("Your Next Face protocol"))reportSummary=submission.report_summary;

    if (consented && wantsPreview && !afterBase64) {
      const imageResult = await generateAfterImage({
        beforeBytes,
        beforeMime: submission.before_image_mime as "image/png" | "image/jpeg" | "image/webp",
        record,
      });

      if (imageResult.ok) {
        afterBase64 = imageResult.base64;
        afterMime = imageResult.mime;
        reportSummary += "\n" + comparisonSummary(imageResult.review);
        previewStatus = "included";
      } else {
        console.warn(`[process-submissions] Omitted unreliable optional preview for ${id}: ${imageResult.reason}`);
        const reason=imageResult.reason.toLowerCase();
        previewStatus=reason.includes("geometry") || reason.includes("mask") ? "geometry_unavailable"
          : reason.includes("quality") ? "quality_review"
          : reason.includes("review_unavailable") ? "review_unavailable"
          : reason.includes("aspect_mismatch") ? "aspect_mismatch"
          : reason.includes("composite_failed") || reason.includes("composited_image") ? "composition_failed"
          : reason.includes("invalid_result_image") ? "invalid_provider_image"
          : reason.includes("openai") || reason.includes("provider") || reason.includes("timeout") || reason.includes("rate limit") ? "provider_unavailable"
          : reason.includes("generation_error") ? "generation_error"
          : "generation_failed";
        reportSummary += " The optional appearance preview could not be generated reliably and was omitted; the written report is unaffected.";
      }
    }

    if(!/\[PREVIEW_STATUS:[^\]]+\]/.test(reportSummary))reportSummary += ` [PREVIEW_STATUS:${previewStatus}]`;

    // Preserve a reviewed preview before final status persistence. A retry
    // reuses these exact bytes rather than paying for a different generated image.
    if (afterBase64 && !await updateSubmission(id, {
      status: "processing",
      afterImageBase64: afterBase64,
      afterImageMime: afterMime,
      reportSummary,
      detectedAreas,
    })) throw new Error("preview_storage_failed");

    // Link-first delivery: background work prepares only the optional preview.
    // Detailed review and its saved HTML link are created in the private workspace.
    if(!await updateSubmission(id,{status:"done",afterImageBase64:afterBase64,afterImageMime:afterMime,reportSummary,detectedAreas}))throw new Error("report_storage_failed");
    return {id,outcome:"done"};
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unknown_error";
    console.error(`[process-submissions] Error processing submission ${id}:`, reason);
    await updateSubmission(id, {
      status: "failed",
      emailError: reason.slice(0, 500),
      retryCount: (submission.retry_count ?? 0) + 1,
    }).catch(() => {});
    return { id, outcome: "failed", reason };
  }
}

/**
 * Reads an analysis record directly from Supabase by analysis_id using the
 * service-role key. Unlike getAnalysisRecord(), this does NOT require the
 * session token — it is only called from this server-side job runner, never
 * from a client path. The token was one-time (given to the browser once at
 * session creation and not stored anywhere) so it can't be verified here;
 * instead we trust the server-stored record directly, since this code is
 * already behind the CRON_SECRET gate.
 */
async function getAnalysisRecordById(analysisId: string) {
  const { isSupabaseConfigured, supabaseRequest } = await import("@/lib/analysis-session/supabaseClient");
  const env = process.env as Record<string, string | undefined>;
  if (!isSupabaseConfigured(env)) return null;

  const res = await supabaseRequest(
    env,
    `/analysis_sessions?analysis_id=eq.${encodeURIComponent(analysisId)}&select=record&limit=1`,
    { method: "GET" },
  ).catch(() => null);

  if (!res?.ok) return null;
  const rows = (await res.json()) as { record: unknown }[];
  return (rows[0]?.record as Awaited<ReturnType<typeof getAnalysisRecord>>) ?? null;
}
