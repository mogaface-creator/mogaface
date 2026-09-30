/**
 * POST /api/analysis-session — turns a client-submitted assessment + local
 * analysis into a server-owned AnalysisRecord (see store.ts for what that
 * guarantees and what it doesn't). Same-origin only, bounded body size;
 * deliberately has NO authentication requirement of its own beyond that —
 * creating a record costs nothing sensitive (no image bytes, no external
 * API call) and the record it produces is useless without the session token
 * returned here, which only this response ever reveals.
 */

import { createAnalysisRecord, AnalysisPersistenceUnavailableError } from "./store.ts";
import type { AnalysisSessionStoreDeps } from "./store.ts";

const MAX_REQUEST_BYTES = 2_000_000; // generous for assessment + observation JSON; nowhere near photo/video size

export async function handleCreateAnalysisSession(request: Request, deps: AnalysisSessionStoreDeps = {}): Promise<Response> {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  if (Number(request.headers.get("content-length") ?? 0) > MAX_REQUEST_BYTES) {
    return Response.json({ error: "too_large" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  const { assessment, analysis, photoQualityValid, hasLeftFortyFive, hasRightFortyFive } = body as Record<string, unknown>;

  let handle;
  try {
    handle = await createAnalysisRecord({ assessment, analysis, photoQualityValid, hasLeftFortyFive, hasRightFortyFive }, deps);
  } catch (err) {
    // Production persistence is unavailable — fail closed with a generic error. Never the
    // Supabase response body, never a stack trace, never SUPABASE_SERVICE_ROLE_KEY.
    if (err instanceof AnalysisPersistenceUnavailableError) return Response.json({ error: "storage_unavailable" }, { status: 503 });
    throw err;
  }
  if (!handle) return Response.json({ error: "invalid_request" }, { status: 400 });

  return Response.json(handle);
}
