import {processOne} from "@/lib/submissions/processOne";
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
 * Reports are delivered as saved HTML links through the review workspace.
 *
 * Security: protected by a secret cron token (CRON_SECRET env var).
 * Vercel sets the Authorization header automatically on cron invocations.
 * Manual callers must send: Authorization: Bearer <CRON_SECRET>
 */

import type { NextRequest } from "next/server";
import { getPendingSubmissions } from "@/lib/submissions/store";

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
