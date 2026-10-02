/**
 * Client-side call to POST /api/submit-assessment.
 * Sends the front photo bytes + analysis session handle → server creates the
 * async submission row (scheduled 30 min out) and returns a confirmation token.
 *
 * Called from AssessmentReview.tsx immediately after analysis completes,
 * replacing the old "go to /results" navigation.
 */

export interface SubmitAssessmentInput {
  /** The front photo file — sent as multipart so it reaches the server for PDF generation. */
  frontPhotoFile: File;
  photoVisualizationConsent: "granted" | "declined" | "pending";
  /** The session handle returned by createAnalysisSession, if available. */
  analysisId?: string;
  sessionToken?: string;
}

export type SubmitAssessmentResult =
  | { ok: true; submissionId: string }
  | { ok: false; reason: string };

export async function submitAssessment(input: SubmitAssessmentInput): Promise<SubmitAssessmentResult> {
  const form = new FormData();
  form.append("photo", input.frontPhotoFile, input.frontPhotoFile.name);
  form.append(
    "payload",
    JSON.stringify({
      photoVisualizationConsent: input.photoVisualizationConsent,
      ...(input.analysisId ? { analysisId: input.analysisId } : {}),
      ...(input.sessionToken ? { sessionToken: input.sessionToken } : {}),
    }),
  );

  try {
    const res = await fetch("/api/submit-assessment", { method: "POST", body: form });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      return { ok: false, reason: typeof body.error === "string" ? body.error : "server_error" };
    }
    const body = (await res.json()) as { submissionId?: string };
    if (!body.submissionId) return { ok: false, reason: "missing_submission_id" };
    return { ok: true, submissionId: body.submissionId };
  } catch {
    return { ok: false, reason: "network_error" };
  }
}
