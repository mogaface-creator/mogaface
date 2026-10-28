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
  leftPhotoFile: File;
  rightPhotoFile: File;
  photoVisualizationConsent: "granted" | "declined" | "pending";
  /** The session handle returned by createAnalysisSession, if available. */
  analysisId?: string;
  sessionToken?: string;
}

export type SubmitAssessmentResult =
  | { ok: true; submissionId: string }
  | { ok: false; reason: string; reference?: string };

export async function submitAssessment(input: SubmitAssessmentInput): Promise<SubmitAssessmentResult> {
  const form = new FormData();
  // Three compact JPEGs keep the complete multipart request below Vercel's body limit.
  const compress = async (file: File): Promise<Blob> => {
    const bitmap=await createImageBitmap(file);try {
      const scale=Math.min(1,1200/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement("canvas");canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);
      const ctx=canvas.getContext("2d");if(!ctx)throw new Error("photo_preparation_failed");ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);
      const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,"image/jpeg",0.82));if(!blob || blob.size>1_100_000)throw new Error("photo_too_large");return blob;
    } finally {bitmap.close();}
  };
  try { for(const [field,file] of [["photo",input.frontPhotoFile],["leftPhoto",input.leftPhotoFile],["rightPhoto",input.rightPhotoFile]] as const)form.append(field,await compress(file),`${field}.jpg`); }
  catch {return {ok:false,reason:"photo_preparation_failed"};}
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
      return {
        ok: false,
        reason: typeof body.error === "string" ? body.error : "server_error",
        ...(typeof body.reference === "string" ? { reference: body.reference } : {}),
      };
    }
    const body = (await res.json()) as { submissionId?: string };
    if (!body.submissionId) return { ok: false, reason: "missing_submission_id" };
    if(input.sessionToken){try{sessionStorage.setItem(`mogaface:report:${body.submissionId}`,input.sessionToken);}catch{/* Email delivery remains available when session storage is blocked. */}}
    return { ok: true, submissionId: body.submissionId };
  } catch {
    return { ok: false, reason: "network_error" };
  }
}
