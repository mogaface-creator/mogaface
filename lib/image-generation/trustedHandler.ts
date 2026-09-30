/**
 * The trusted-analysis illustration path — what /api/generate-illustration
 * actually runs.
 *
 * Unlike handler.ts's own sanitizeOpportunities (which accepts a
 * client-submitted array of pre-built TreatmentOpportunity objects —
 * including their `consumerReady` flag and `evidenceObservationIds`, taken
 * on trust), this path accepts NO opportunity data from the request body at
 * all. The only inputs are `analysisId` + `sessionToken`, which must resolve
 * (via lib/analysis-session/store.ts, constant-time compared) to a record
 * this server created and computed itself. The opportunities forwarded to
 * handleIllustrationRequest are ALWAYS the server's own stored ones — a
 * caller cannot submit, alter, or forge a single evidence id, category,
 * status or consumerReady value.
 *
 * handleIllustrationRequest itself is used completely unmodified: same
 * consent gate, same photo validation, same real (uncalibrated-today)
 * eligibility decision, same safety-checked prompt, same output validation.
 * No eligibility or policy override is ever passed here — this is exactly as
 * strict as the real production route, just fed from a trusted source
 * instead of the request body.
 *
 * `generateTrustedIllustrationForPhoto` is the reusable per-photo core: it
 * resolves ONE already-looked-up analysis record against ONE photo. Both
 * `handleTrustedIllustrationRequest` (a single photo, the original contract)
 * and lib/image-generation/multiAngle.ts (up to three photos — front, left
 * 45°, right 45° — sharing the SAME record, so the SAME server-computed
 * opportunities and therefore the SAME resulting plan) call it; neither
 * duplicates this logic.
 */

import { buildPredictionFocus } from "../visualization/focus.ts";
import { handleIllustrationRequest } from "./handler.ts";
import type { IllustrationHandlerDeps } from "./handler.ts";
import { getAnalysisRecord, persistIllustrationUse, AnalysisPersistenceUnavailableError } from "../analysis-session/store.ts";
import type { AnalysisSessionStoreDeps } from "../analysis-session/store.ts";
import type { AnalysisRecord } from "../analysis-session/types.ts";
import type { RateLimiter } from "../interpretation/access.ts";

/**
 * Production has no user accounts. A request that already presented a valid
 * analysis-session token is the subject, and the stored record is the shared
 * rate-limit counter. Development keeps the handler's own localhost
 * authenticator and in-memory limiter. Callers that pass their own
 * authenticator and limiter (tests, a future auth module) are left alone.
 */
function secureIllustrationDeps(record: AnalysisRecord, deps: IllustrationHandlerDeps): IllustrationHandlerDeps {
  if (deps.env.NODE_ENV !== "production" || (deps.authenticator && deps.rateLimiter)) return deps;
  const sessionDeps: AnalysisSessionStoreDeps = deps.analysisSessionDeps ?? { env: deps.env, fetchImpl: deps.fetchImpl };
  const rateLimiter: RateLimiter = deps.rateLimiter ?? {
    async check() {
      const allowed = await persistIllustrationUse(record.id, record, sessionDeps);
      return { allowed, retryAfterSeconds: allowed ? 0 : 3600 };
    },
  };
  return {
    ...deps,
    authenticator: deps.authenticator ?? (async () => ({ subject: `analysis:${record.id}` })),
    rateLimiter,
  };
}

function forwardedHeaders(request: Request): Headers {
  const headers = new Headers();
  for (const name of ["origin", "host", "x-request-id", "x-vercel-id"]) {
    const v = request.headers.get(name);
    if (v) headers.set(name, v);
  }
  return headers;
}

/**
 * Runs the real, unmodified illustration pipeline for one photo against an
 * already-resolved trusted record. `record.opportunities` and
 * `record.predictionPlan` — never anything from a request body — are what
 * get forwarded; handleIllustrationRequest prefers the prediction plan when
 * it is present and planned (see its own step 9 comment), falling back to
 * the opportunities-based pipeline otherwise.
 */
export async function generateTrustedIllustrationForPhoto(
  photo: Blob,
  record: AnalysisRecord,
  photoVisualizationConsent: unknown,
  photoQualityValid: unknown,
  requestUrl: string,
  headers: Headers,
  deps: IllustrationHandlerDeps,
): Promise<Response> {
  const rebuilt = new FormData();
  const named = photo as Blob & { name?: string };
  const name = typeof named.name === "string" && named.name ? named.name : "portrait";
  rebuilt.append("photo", photo, name);
  rebuilt.append(
    "payload",
    JSON.stringify({
      photoVisualizationConsent,
      photoQualityValid: photoQualityValid === true,
      opportunities: record.opportunities,
      predictionPlan: record.predictionPlan.focus?.length
        ? record.predictionPlan
        : { ...record.predictionPlan, focus: buildPredictionFocus(record.assessment, record.predictionPlan.changes.map((change) => change.category)) },
    }),
  );
  const forwarded = new Request(requestUrl, { method: "POST", headers, body: rebuilt });
  return handleIllustrationRequest(forwarded, secureIllustrationDeps(record, deps));
}

export async function handleTrustedIllustrationRequest(request: Request, deps: IllustrationHandlerDeps): Promise<Response> {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  const photo = form.get("photo");
  const payloadText = form.get("payload");
  if (!(photo instanceof File) || typeof payloadText !== "string") {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  let payload: { photoVisualizationConsent?: unknown; photoQualityValid?: unknown; analysisId?: unknown; sessionToken?: unknown };
  try {
    const parsed: unknown = JSON.parse(payloadText);
    if (!parsed || typeof parsed !== "object") throw new Error("shape");
    payload = parsed as typeof payload;
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }
  if (typeof payload.analysisId !== "string" || typeof payload.sessionToken !== "string") {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  // The ONE lookup this whole path exists for: resolve the caller's claimed
  // analysis against what the server actually computed and stored — never
  // what the request body says it is. deps.analysisSessionDeps defaults to
  // { env: deps.env, fetchImpl: deps.fetchImpl } — the same Supabase
  // configuration (or absence of it) the route was given.
  let record: AnalysisRecord | null;
  try {
    record = await getAnalysisRecord(payload.analysisId, payload.sessionToken, deps.analysisSessionDeps ?? { env: deps.env, fetchImpl: deps.fetchImpl });
  } catch (err) {
    // Production persistence is unavailable: fail closed with a generic error, BEFORE ever
    // reaching generateTrustedIllustrationForPhoto — the OpenAI provider is never called.
    if (err instanceof AnalysisPersistenceUnavailableError) return Response.json({ error: "storage_unavailable" }, { status: 503 });
    throw err;
  }
  if (!record) return Response.json({ error: "analysis_not_found" }, { status: 404 });

  return generateTrustedIllustrationForPhoto(photo, record, payload.photoVisualizationConsent, payload.photoQualityValid, request.url, forwardedHeaders(request), deps);
}
