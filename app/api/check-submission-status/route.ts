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

export const maxDuration = 180;

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
        previewMessage: previewStatusMessage(submission.report_summary||"",!!submission.after_image_base64),
      });
    }

    if (submission.status === "failed" && submission.email_error?.startsWith("Email delivery failed:") && submission.report_summary) return Response.json({status:"done",emailSentAt:null,deliveryWarning:true,hasAfterImage:!!submission.after_image_base64,previewMessage:previewStatusMessage(submission.report_summary,!!submission.after_image_base64)});
    if (submission.status === "failed") return Response.json({status:"failed",message:"We could not complete this report. Please contact the clinic."});

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
      const updated = await getSubmission(id);
      return Response.json({
        status: outcome.outcome,
        ...(updated ? {hasAfterImage:!!updated.after_image_base64,previewMessage:previewStatusMessage(updated.report_summary||"",!!updated.after_image_base64)} : {}),
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

function previewStatusMessage(summary:string,hasAfter:boolean):string{
 if(hasAfter)return "An illustrative after photo passed the image quality review and is included. It is not a treatment prediction.";
 const marker=/\[PREVIEW_STATUS:([^\]]+)\]/.exec(summary)?.[1];
 switch(marker){
  case "not_requested": return "No illustrative after photo was requested. Your report is based on the original photo and your answers.";
  case "no_ai_consent": return "Clinic review only was selected. Your photo was not sent to the AI image service.";
  case "geometry_unavailable": return "The after photo could not be safely prepared from this portrait, so it was left out.";
  case "quality_review": return "The generated draft did not pass the identity and quality review, so it was left out.";
  case "review_unavailable": return "The generated draft could not be verified, so it was left out.";
  case "aspect_mismatch": return "The generated image did not match the original photo framing, so it was left out rather than stretched.";
  case "composition_failed": return "The generated image could not be aligned safely with your original photo, so it was left out.";
  case "invalid_provider_image": return "The image service returned an unusable image, so no after photo was included.";
  case "provider_unavailable": return "The image service could not generate a preview this time. Your written report is ready.";
  case "generation_error": return "The image generation step failed before a usable preview was ready. Your written report is ready.";
  default: return "No after photo was included. Your written report is ready.";
 }
}
