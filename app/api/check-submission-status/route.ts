/**
 * Route: GET /api/check-submission-status?id=<submissionId>
 *
 * Checks the status of a submission. If the 60-second delay has elapsed and
 * the submission is still pending, it automatically claims and processes it
 * immediately (generating the AI after image, compiling the PDF, and sending
 * the email via Resend).
 */

import type { NextRequest } from "next/server";
import { getSubmission } from "@/lib/submissions/store";
import { processOne } from "@/app/api/process-submissions/route";

export const maxDuration = 60;

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id")?.trim();

  if (!id) {
    return Response.json({ error: "missing_id" }, { status: 400 });
  }

  try {
    const submission = await getSubmission(id);
    if (!submission) {
      return Response.json({ error: "not_found" }, { status: 404 });
    }

    if (submission.status === "done") {
      return Response.json({
        status: "done",
        emailSentAt: submission.email_sent_at,
        hasAfterImage: !!submission.after_image_base64,
      });
    }

    if (submission.status === "processing") {
      return Response.json({
        status: "processing",
        message: "Your personalized dossier is currently being generated.",
      });
    }

    // If pending or failed with retries remaining, check if send_after <= now()
    const now = new Date();
    const sendAfter = new Date(submission.send_after);

    if (now >= sendAfter) {
      // Time has passed: process immediately!
      const outcome = await processOne(submission);
      return Response.json({
        status: outcome.outcome,
        message:
          outcome.outcome === "done"
            ? "Report successfully compiled and dispatched to your email."
            : outcome.reason,
      });
    }

    const secondsRemaining = Math.max(0, Math.ceil((sendAfter.getTime() - now.getTime()) / 1000));

    return Response.json({
      status: "pending",
      secondsRemaining,
      message: `Analyzing facial structure... ~${secondsRemaining}s remaining.`,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "status_check_error";
    return Response.json({ error: errorMsg }, { status: 500 });
  }
}
