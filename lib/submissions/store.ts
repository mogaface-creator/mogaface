/**
 * Submission store: persists the async job that generates the PDF and emails
 * it to the client 30 minutes after assessment submission.
 *
 * One row in `public.submissions` per completed assessment. The job runner
 * (app/api/process-submissions/route.ts) polls for rows where
 * `send_after <= now()` and `status = 'pending'` and processes them.
 *
 * Like lib/analysis-session/store.ts, this module uses the Supabase
 * service-role key server-side only and falls back to an in-memory store
 * in development when Supabase is not configured.
 */

import { isSupabaseConfigured, supabaseRequest } from "../analysis-session/supabaseClient.ts";
import type { SupabaseEnv } from "../analysis-session/supabaseClient.ts";

export const DELIVERY_DELAY_MS = 30 * 60_000; // 30 minutes

export type SubmissionStatus = "pending" | "processing" | "done" | "failed";

export interface SubmissionRow {
  id: string;
  lead_id: string | null;
  analysis_id: string | null;
  status: SubmissionStatus;
  send_after: string;
  after_image_base64: string | null;
  after_image_mime: string | null;
  before_image_base64: string | null;
  before_image_mime: string | null;
  report_summary: string | null;
  detected_areas: { label: string; description: string }[] | null;
  email_sent_at: string | null;
  email_error: string | null;
  retry_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateSubmissionInput {
  leadId: string | null;
  analysisId: string | null;
  /** The raw front-photo bytes for PDF generation. Stored as base64. */
  beforeImageBytes: Uint8Array;
  beforeImageMime: string;
}

export interface UpdateSubmissionInput {
  status: SubmissionStatus;
  afterImageBase64?: string;
  afterImageMime?: string;
  reportSummary?: string;
  detectedAreas?: { label: string; description: string }[];
  emailSentAt?: string;
  emailError?: string;
  retryCount?: number;
}

export interface SubmissionStoreDeps {
  env?: SupabaseEnv;
  fetchImpl?: typeof fetch;
}

function resolveDeps(deps: SubmissionStoreDeps): { env: SupabaseEnv; fetchImpl: typeof fetch } {
  return {
    env: deps.env ?? (process.env as SupabaseEnv),
    fetchImpl: deps.fetchImpl ?? fetch,
  };
}

// In-memory fallback for development
const fallback = new Map<string, SubmissionRow>();
let fallbackWarnedOnce = false;
function warnFallback() {
  if (fallbackWarnedOnce) return;
  fallbackWarnedOnce = true;
  console.warn("[submissions] Supabase not configured — using in-memory fallback. NOT safe in production.");
}

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

/**
 * Creates a new submission row immediately after the user submits the
 * assessment. The `send_after` timestamp is set 30 minutes in the future;
 * the job runner will not touch this row until then.
 */
export async function createSubmission(
  input: CreateSubmissionInput,
  deps: SubmissionStoreDeps = {},
): Promise<string | null> {
  const { env, fetchImpl } = resolveDeps(deps);
  const configured = isSupabaseConfigured(env);
  if (!configured) warnFallback();

  const id = crypto.randomUUID();
  const now = new Date();
  const sendAfter = new Date(now.getTime() + DELIVERY_DELAY_MS).toISOString();

  const row: SubmissionRow = {
    id,
    lead_id: input.leadId,
    analysis_id: input.analysisId,
    status: "pending",
    send_after: sendAfter,
    after_image_base64: null,
    after_image_mime: null,
    before_image_base64: toBase64(input.beforeImageBytes),
    before_image_mime: input.beforeImageMime,
    report_summary: null,
    detected_areas: null,
    email_sent_at: null,
    email_error: null,
    retry_count: 0,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };

  if (configured) {
    const body = {
      id,
      lead_id: input.leadId,
      analysis_id: input.analysisId,
      status: "pending",
      send_after: sendAfter,
      before_image_base64: row.before_image_base64,
      before_image_mime: input.beforeImageMime,
    };
    const res = await supabaseRequest(
      env,
      "/submissions",
      { method: "POST", headers: { prefer: "return=minimal" }, body: JSON.stringify(body) },
      fetchImpl,
    ).catch(() => null);
    if (!res?.ok) {
      console.error("[submissions] Failed to create submission row", { status: res?.status });
      return null;
    }
  } else {
    fallback.set(id, row);
  }

  return id;
}

/**
 * Fetches all pending submissions whose send_after time has passed.
 * Called by the job runner endpoint every time it fires.
 */
export async function getPendingSubmissions(deps: SubmissionStoreDeps = {}): Promise<SubmissionRow[]> {
  const { env, fetchImpl } = resolveDeps(deps);
  const configured = isSupabaseConfigured(env);
  if (!configured) {
    warnFallback();
    const now = new Date().toISOString();
    return [...fallback.values()].filter(
      (r) => (r.status === "pending" || r.status === "failed") && r.retry_count < 3 && r.send_after <= now,
    );
  }

  const now = encodeURIComponent(new Date().toISOString());
  const res = await supabaseRequest(
    env,
    `/submissions?status=in.(pending,failed)&retry_count=lt.3&send_after=lte.${now}&select=*&order=send_after.asc&limit=10`,
    { method: "GET" },
    fetchImpl,
  ).catch(() => null);

  if (!res?.ok) {
    console.error("[submissions] Failed to fetch pending submissions", { status: res?.status });
    return [];
  }

  return (await res.json()) as SubmissionRow[];
}

/**
 * Gets a submission by ID. Used by the job runner after claiming a row.
 */
export async function getSubmission(id: string, deps: SubmissionStoreDeps = {}): Promise<SubmissionRow | null> {
  const { env, fetchImpl } = resolveDeps(deps);
  const configured = isSupabaseConfigured(env);
  if (!configured) {
    warnFallback();
    return fallback.get(id) ?? null;
  }

  const res = await supabaseRequest(
    env,
    `/submissions?id=eq.${encodeURIComponent(id)}&select=*`,
    { method: "GET" },
    fetchImpl,
  ).catch(() => null);

  if (!res?.ok) return null;
  const rows = (await res.json()) as SubmissionRow[];
  return rows[0] ?? null;
}

/**
 * Updates a submission row. Used by the job runner to claim a row
 * (set to 'processing'), then update with results, then mark 'done'/'failed'.
 */
export async function updateSubmission(
  id: string,
  update: UpdateSubmissionInput,
  deps: SubmissionStoreDeps = {},
): Promise<boolean> {
  const { env, fetchImpl } = resolveDeps(deps);
  const configured = isSupabaseConfigured(env);

  const body: Record<string, unknown> = { status: update.status };
  if (update.afterImageBase64 !== undefined) body.after_image_base64 = update.afterImageBase64;
  if (update.afterImageMime !== undefined) body.after_image_mime = update.afterImageMime;
  if (update.reportSummary !== undefined) body.report_summary = update.reportSummary;
  if (update.detectedAreas !== undefined) body.detected_areas = update.detectedAreas;
  if (update.emailSentAt !== undefined) body.email_sent_at = update.emailSentAt;
  if (update.emailError !== undefined) body.email_error = update.emailError;
  if (update.retryCount !== undefined) body.retry_count = update.retryCount;

  if (!configured) {
    warnFallback();
    const row = fallback.get(id);
    if (!row) return false;
    Object.assign(row, {
      ...body,
      updated_at: new Date().toISOString(),
    });
    return true;
  }

  const res = await supabaseRequest(
    env,
    `/submissions?id=eq.${encodeURIComponent(id)}`,
    { method: "PATCH", headers: { prefer: "return=minimal" }, body: JSON.stringify(body) },
    fetchImpl,
  ).catch(() => null);

  return !!res?.ok;
}
