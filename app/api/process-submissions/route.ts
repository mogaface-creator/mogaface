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
import { getPendingSubmissions, getSubmission, updateSubmission } from "@/lib/submissions/store";
import type { SubmissionRow } from "@/lib/submissions/store";
import { generateAfterImage } from "@/lib/submissions/imageJob";
import { buildReportSummary } from "@/lib/submissions/reportSummary";
import { getAnalysisRecord } from "@/lib/analysis-session/store";

// Vercel route segment config: allow up to 300s for image generation.
// Vercel Pro/Enterprise supports 300s; Hobby is capped at 60s.
export const maxDuration = 300;


const MAX_SUBMISSIONS_PER_RUN = 5; // keep well within Vercel's 60s function timeout

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  // In development without a secret, allow all (dev-only, never production).
  if (!secret) return process.env.NODE_ENV !== "production";
  const auth = request.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

export async function POST(request: NextRequest): Promise<Response> {
  if (!isAuthorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const pending = await getPendingSubmissions();
  const toProcess = pending.slice(0, MAX_SUBMISSIONS_PER_RUN);

  if (toProcess.length === 0) {
    return Response.json({ processed: 0, message: "No pending submissions" });
  }

  const results: { id: string; outcome: "done" | "failed"; reason?: string }[] = [];

  for (const submission of toProcess) {
    const outcome = await processOne(submission);
    results.push(outcome);
  }

  return Response.json({ processed: results.length, results });
}

// Vercel Cron also calls GET — same handler
export const GET = POST;

async function processOne(submission: SubmissionRow): Promise<{ id: string; outcome: "done" | "failed"; reason?: string }> {
  const { id } = submission;

  // Claim the row
  await updateSubmission(id, { status: "processing" });

  try {
    // 1. Resolve the analysis record (treatment opportunities + assessment)
    let record = null;
    if (submission.analysis_id) {
      // The session token is no longer available post-submission (it's one-time).
      // We read the record directly from Supabase by analysis_id using the service role.
      record = await getAnalysisRecordById(submission.analysis_id);
    }

    // 2. Decode the before photo
    if (!submission.before_image_base64 || !submission.before_image_mime) {
      await updateSubmission(id, {
        status: "failed",
        emailError: "No before photo stored",
        retryCount: (submission.retry_count ?? 0) + 1,
      });
      return { id, outcome: "failed", reason: "no_before_photo" };
    }

    const beforeBytes = Buffer.from(submission.before_image_base64, "base64");

    // 3. Generate the AI after-image
    const imageResult = await generateAfterImage({
      beforeBytes,
      beforeMime: submission.before_image_mime as "image/png" | "image/jpeg" | "image/webp",
      record,
    });

    // 4. Build report summary
    const summaryResult = record
      ? await buildReportSummary(record)
      : { summary: "Your personalized facial analysis has been completed.", areas: [] };

    // 5. Update the row with results
    if (imageResult.ok) {
      await updateSubmission(id, {
        status: "done",
        afterImageBase64: imageResult.base64,
        afterImageMime: imageResult.mime,
        reportSummary: summaryResult.summary,
        detectedAreas: summaryResult.areas,
      });
      return { id, outcome: "done" };
    } else {
      // Image generation failed — mark failed for retry
      await updateSubmission(id, {
        status: "failed",
        emailError: imageResult.reason,
        retryCount: (submission.retry_count ?? 0) + 1,
        reportSummary: summaryResult.summary,
        detectedAreas: summaryResult.areas,
      });
      return { id, outcome: "failed", reason: imageResult.reason };
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
