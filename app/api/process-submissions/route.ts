import { comparisonSummary } from "@/lib/submissions/imageReview";
import {protocolInput} from "@/lib/submissions/protocolInput";
/**
 * Background job runner: POST /api/process-submissions
 *
 * Called by Vercel Cron every 5 minutes (see vercel.json).
 * Also callable manually via POST for testing.
 *
 * For each pending submission whose send_after <= now():
 *   1. Claims the row (status → processing)
 *   2. Retrieves the analysis session record (for treatment opportunities)
 *   3. Calls OpenAI to generate the AI after-image
 *   4. Builds a plain-text report summary from the interpretation engine
 *   5. Updates the submission row with the results (status → done/failed)
 *
 * The actual email delivery (Phase 3) will be called at the end of step 5.
 *
 * Security: protected by a secret cron token (CRON_SECRET env var).
 * Vercel sets the Authorization header automatically on cron invocations.
 * Manual callers must send: Authorization: Bearer <CRON_SECRET>
 */

import type { NextRequest } from "next/server";
import { claimSubmission, getPendingSubmissions, updateSubmission } from "@/lib/submissions/store";
import type { SubmissionRow } from "@/lib/submissions/store";
import { generateAfterImage } from "@/lib/submissions/imageJob";
import { getAnalysisRecord } from "@/lib/analysis-session/store";
import { resolveLeadData } from "@/lib/submissions/lead";
import { generatePdfReport } from "@/lib/submissions/pdfReport";
import { sendReportEmail } from "@/lib/submissions/emailDelivery";
import { IMAGE_PLACE_OPTIONS } from "@/lib/assessment/intakeQuestions";

// Requires a deployment plan supporting 180-second functions (scan + edit + review).
export const maxDuration = 180;

const MAX_SUBMISSIONS_PER_RUN = 1; // keep well within Vercel timeout limits

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  // In development without a secret, allow all (dev-only, never production).
  if (!secret) return process.env.NODE_ENV !== "production";
  const auth = request.headers.get("authorization") ?? "";
  if (auth === `Bearer ${secret}`) return true;

  // Also accept ?key=<secret> or ?secret=<secret> in URL query for easy browser testing
  const url = new URL(request.url);
  const param = url.searchParams.get("key") || url.searchParams.get("secret");
  return param === secret;
}

export async function POST(request: NextRequest): Promise<Response> {
  if (!isAuthorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "true";
  const regenerate = url.searchParams.get("regenerate") === "true";

  const pending = await getPendingSubmissions({ force });
  const toProcess = pending.slice(0, MAX_SUBMISSIONS_PER_RUN);

  if (toProcess.length === 0) {
    return Response.json({ processed: 0, message: "No pending submissions" });
  }

  const results: { id: string; outcome: "done" | "failed" | "processing"; reason?: string }[] = [];

  for (const submission of toProcess) {
    const outcome = await processOne(submission, { regenerate });
    results.push(outcome);
  }

  return Response.json({ processed: results.length, results });
}

// Vercel Cron also calls GET — same handler
export const GET = POST;

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

    // 2. Resolve client lead details (name, email, phone, stated concerns)
    const lead = await resolveLeadData({
      leadId: submission.lead_id,
      analysisId: submission.analysis_id,
      record,
    });

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

    // Reuse only a current, already quality-screened draft after an email retry.

    // Generate a fresh preview and reject it if quality review fails.
    let afterBase64: string | null = null;
    let afterMime: string | null = null;

    if(consented && wantsPreview && !options?.regenerate && submission.report_summary?.startsWith("Your Next Face protocol") && submission.after_image_base64){afterBase64=submission.after_image_base64;afterMime=submission.after_image_mime;reportSummary=submission.report_summary;}

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
      } else {
        console.warn(`[process-submissions] Omitted unreliable optional preview for ${id}: ${imageResult.reason}`);
        reportSummary += " The optional appearance preview could not be generated reliably and was omitted; the written report is unaffected.";
      }
    }

    const afterBytes = afterBase64 ? Buffer.from(afterBase64, "base64") : null;

    // 6. Generate the full questionnaire-driven Next Face protocol
    const pdfBytes = await generatePdfReport(protocolInput(record,{name:lead.name,id,front:beforeBytes,after:afterBytes,summary:reportSummary}));

    // 7. Deliver PDF Report via Resend Email
    if (lead.email) {
      const emailResult = await sendReportEmail({
        toEmail: lead.email,
        clientName: lead.name,
        referenceId: id,
        pdfBytes,
        reportSummary,
      });

      if (emailResult.ok) {
        await updateSubmission(id, {
          status: "done",
          afterImageBase64: afterBase64,
          afterImageMime: afterMime,
          reportSummary,
          detectedAreas,
          emailSentAt: new Date().toISOString(),
          emailError: undefined,
        });
        return { id, outcome: "done" };
      } else {
        // Email delivery failed — mark failed for automatic cron retry
        await updateSubmission(id, {
          status: "failed",
          afterImageBase64: afterBase64,
          afterImageMime: afterMime,
          reportSummary,
          detectedAreas,
          emailError: `Email delivery failed: ${emailResult.error}`,
          retryCount: (submission.retry_count ?? 0) + 1,
        });
        return { id, outcome: "failed", reason: emailResult.error };
      }
    } else {
      // No email provided (e.g. phone-only lead or manual intake)
      await updateSubmission(id, {
        status: "done",
        afterImageBase64: afterBase64,
        afterImageMime: afterMime,
        reportSummary,
        detectedAreas,
        emailError: "No email address on lead record — PDF generated and ready for direct dispatch",
      });
      return { id, outcome: "done" };
    }
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
