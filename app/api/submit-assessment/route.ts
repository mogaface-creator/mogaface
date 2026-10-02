/**
 * POST /api/submit-assessment
 *
 * The final step of the assessment flow. Accepts the client's front photo
 * and the analysis session handle (if eligible for illustration), then:
 *   1. Validates the photo and payload
 *   2. Looks up the analysis session record to get the lead contact details
 *   3. Saves a submission row (status=pending, send_after=now+30min)
 *   4. Returns { submissionId } — the browser navigates to /submitted
 *
 * The actual image generation, PDF building, and email sending all happen
 * in the background job (POST /api/process-submissions), never here.
 * This route does NO external API calls — it only writes to Supabase.
 *
 * Same-origin only. No authentication required for submission itself —
 * the session token in the payload is validated against the analysis_sessions
 * table; a fabricated payload without a valid session simply saves a row
 * with no analysis_id.
 */

import type { NextRequest } from "next/server";
import { isUploadedPhoto, validateSourcePhoto } from "@/lib/image-generation/output";
import { getAnalysisRecord } from "@/lib/analysis-session/store";
import { createSubmission } from "@/lib/submissions/store";
import { supabaseRequest, isSupabaseConfigured } from "@/lib/analysis-session/supabaseClient";

const MAX_PHOTO_BYTES = 10_000_000;
const MAX_PAYLOAD_CHARS = 2_000;

export async function POST(request: NextRequest): Promise<Response> {
  // Same-origin check
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  // Parse multipart body
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const photo = form.get("photo");
  const payloadText = form.get("payload");

  if (!isUploadedPhoto(photo) || typeof payloadText !== "string") {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  if (photo.size > MAX_PHOTO_BYTES) {
    return Response.json({ error: "too_large" }, { status: 413 });
  }
  if (payloadText.length > MAX_PAYLOAD_CHARS) {
    return Response.json({ error: "too_large" }, { status: 413 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(payloadText) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  // Validate the photo bytes
  const bytes = new Uint8Array(await photo.arrayBuffer());
  const validatedPhoto = validateSourcePhoto(bytes, photo.type);
  if (!validatedPhoto.ok) {
    return Response.json({ error: "invalid_photo" }, { status: 400 });
  }

  // Resolve the analysis session (optional — users without a session still
  // get a submission created; they just won't have a session-backed analysis)
  const analysisId = typeof payload.analysisId === "string" ? payload.analysisId : null;
  const sessionToken = typeof payload.sessionToken === "string" ? payload.sessionToken : null;

  let resolvedLeadId: string | null = null;
  let resolvedAnalysisId: string | null = null;

  if (analysisId && sessionToken) {
    try {
      const record = await getAnalysisRecord(analysisId, sessionToken);
      if (record) {
        resolvedAnalysisId = analysisId;
        // If contact details are on the record, look up the lead row by analysis_id
        if (record.contact) {
          const env = process.env as Record<string, string | undefined>;
          if (isSupabaseConfigured(env)) {
            const leadRes = await supabaseRequest(
              env,
              `/leads?analysis_id=eq.${encodeURIComponent(analysisId)}&select=id&limit=1`,
              { method: "GET" },
            ).catch(() => null);
            if (leadRes?.ok) {
              const leads = (await leadRes.json()) as { id: string }[];
              resolvedLeadId = leads[0]?.id ?? null;
            }
          }
        }
      }
    } catch {
      // AnalysisPersistenceUnavailableError or any other — continue without session
    }
  }

  // Create the submission row (scheduled 30 min out)
  const submissionId = await createSubmission({
    leadId: resolvedLeadId,
    analysisId: resolvedAnalysisId,
    beforeImageBytes: validatedPhoto.bytes,
    beforeImageMime: validatedPhoto.mimeType,
  });

  if (!submissionId) {
    return Response.json({ error: "storage_error" }, { status: 503 });
  }

  return Response.json({ submissionId });
}
