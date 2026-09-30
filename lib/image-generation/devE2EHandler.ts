/**
 * Developer/clinic-only END-TO-END test path: takes the REAL opportunities
 * the real assessment/analysis pipeline produced for the current user — from
 * the person's own photos, video and questionnaire answers, never a fixture
 * or synthetic evidence — and requests an illustrative After from them.
 *
 * Guarded twice, both must hold: NODE_ENV must be "development" AND
 * DEV_E2E_ILLUSTRATION must be exactly "1" — the same double gate as
 * devTestHandler.ts, and just as unreachable from a production build.
 *
 * The browser can never choose which visualization category this opens: of
 * whatever opportunities the client sends, only ones with category
 * NEUROMODULATOR (the sole category APPROVED, in visualization/build.ts,
 * maps to expression_lines — the sole category ILLUSTRATION_POLICY approves)
 * that are a real "potential_opportunity" with real visual evidence survive;
 * everything else — contour, under-eye, filler, lifting, skin, or any
 * mismatched status — is discarded here, before any of it reaches
 * handleIllustrationRequest. Only for those survivors is `consumerReady`
 * forced to true for this one request: the real opportunity's own value is
 * false today because the expression-calibration milestone is still pending
 * (see docs/VISUAL_CALIBRATION.md), not because the evidence is fabricated.
 * CALIBRATION_STATE, VISUAL_OBSERVATIONS_CALIBRATED and ILLUSTRATION_POLICY
 * are never written to.
 *
 * If nothing survives the filter, the forwarded request simply carries no
 * opportunities — handleIllustrationRequest's own, unmodified pipeline then
 * answers "not_eligible" itself; this file never fabricates a placeholder.
 */

import { handleIllustrationRequest } from "./handler.ts";
import type { IllustrationHandlerDeps } from "./handler.ts";
import type { TreatmentOpportunity } from "../treatment-opportunities/types.ts";

/** The only category APPROVED (visualization/build.ts) maps to expression_lines. */
const DEV_E2E_CATEGORY = "NEUROMODULATOR";

export const isDevE2EIllustrationEnabled = (env: Record<string, string | undefined>): boolean => env.NODE_ENV === "development" && env.DEV_E2E_ILLUSTRATION === "1";

interface RawOpportunity {
  id?: unknown;
  category?: unknown;
  status?: unknown;
  evidenceObservationIds?: unknown;
  evidenceQuestionIds?: unknown;
}

const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

/**
 * Keeps only real, evidence-backed NEUROMODULATOR opportunities, and forces
 * consumerReady true on exactly those — the one thing this developer path is
 * allowed to bypass. Everything else is dropped, regardless of what the
 * browser sends.
 */
function permittedDevE2EOpportunities(raw: unknown): TreatmentOpportunity[] {
  if (!Array.isArray(raw)) return [];
  const out: TreatmentOpportunity[] = [];
  for (const o of raw as RawOpportunity[]) {
    if (!o || typeof o !== "object") continue;
    if (typeof o.id !== "string" || o.category !== DEV_E2E_CATEGORY) continue;
    if (o.status !== "potential_opportunity") continue;
    if (!isStringArray(o.evidenceObservationIds) || o.evidenceObservationIds.length === 0) continue;
    if (!isStringArray(o.evidenceQuestionIds)) continue;
    out.push({
      id: o.id,
      category: o.category,
      status: o.status,
      consumerReady: true, // forced — see module comment: real value is false only because calibration is pending
      evidenceObservationIds: o.evidenceObservationIds,
      evidenceQuestionIds: o.evidenceQuestionIds,
    } as unknown as TreatmentOpportunity);
  }
  return out;
}

function forwardedHeaders(request: Request): Headers {
  const headers = new Headers();
  for (const name of ["origin", "host", "x-request-id", "x-vercel-id"]) {
    const v = request.headers.get(name);
    if (v) headers.set(name, v);
  }
  return headers;
}

export async function handleDevE2EIllustrationRequest(request: Request, deps: IllustrationHandlerDeps): Promise<Response> {
  if (!isDevE2EIllustrationEnabled(deps.env)) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

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
  let payload: { photoVisualizationConsent?: unknown; photoQualityValid?: unknown; opportunities?: unknown };
  try {
    const parsed: unknown = JSON.parse(payloadText);
    if (!parsed || typeof parsed !== "object") throw new Error("shape");
    payload = parsed as typeof payload;
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  // Rebuilt from scratch: the ONLY opportunities that can ever reach the real handler
  // are the caller's own, filtered down to real, evidence-backed expression_lines evidence.
  const rebuilt = new FormData();
  rebuilt.append("photo", photo, photo.name || "portrait");
  rebuilt.append(
    "payload",
    JSON.stringify({
      photoVisualizationConsent: payload.photoVisualizationConsent,
      photoQualityValid: payload.photoQualityValid === true,
      opportunities: permittedDevE2EOpportunities(payload.opportunities),
    }),
  );
  const forwarded = new Request(request.url, { method: "POST", headers: forwardedHeaders(request), body: rebuilt });

  return handleIllustrationRequest(forwarded, { ...deps, eligibility: { calibrated: true } });
}
