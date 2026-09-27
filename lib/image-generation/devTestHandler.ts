/**
 * The development-only supervised illustration test path.
 *
 * Exercises the REAL pipeline end to end — the exact same authentication,
 * rate-limit, consent, photo-validation, safety-checked-prompt and
 * output-validation code as the production endpoint (handleIllustrationRequest
 * in handler.ts, completely unmodified here) — but with the calibration gate
 * opened ONLY for the fixed fixture opportunity in devIllustrationFixture.ts.
 * A developer's real front photo can be edited once by the real image API
 * without marking any real observation calibrated, and without touching
 * VISUAL_OBSERVATIONS_CALIBRATED, which stays false everywhere else.
 *
 * Guarded twice, both must hold: NODE_ENV must be "development" AND
 * DEV_ILLUSTRATION_TEST must be exactly "1". If either is false this returns
 * a plain 404 before the request body is even read — indistinguishable from
 * the route not existing, and impossible to reach from a production build.
 *
 * Whatever "opportunities" a caller sends in its payload is discarded
 * outright: this path only ever builds a plan from one of the two fixed
 * fixtures below, never from request input. The caller selects which with
 * `payload.fixture`:
 *   "single" (default) — the one expression_lines fixture, opened only via
 *     the calibration override (the real ILLUSTRATION_POLICY already
 *     approves this category; only calibration blocks it in production).
 *   "multi" — the five-area composite fixture that previews the target
 *     reference-style experience. This ALSO needs a policy override, since
 *     four of its five categories are blocked by the real
 *     ILLUSTRATION_POLICY, not just by calibration — DEV_FULL_ILLUSTRATION_POLICY
 *     opens them for this request only; eligibility.ts's real policy constant
 *     is never touched. It also supplies handler.ts's `buildPlan` override:
 *     three of its categories have no real opportunity→category route in
 *     build.ts's APPROVED map (there is no genuine evidence path for them),
 *     so buildVisualizationPlan alone could never construct a plan naming
 *     them — buildDevMultiAreaPlan is used instead, purely to assemble the
 *     plan object; everything downstream (eligibility, safety, consent, the
 *     image call, output validation) is the exact same handler.ts code path.
 */

import { handleIllustrationRequest } from "./handler.ts";
import type { IllustrationHandlerDeps } from "./handler.ts";
import {
  buildDevMultiAreaPlan,
  DEV_FULL_ILLUSTRATION_POLICY,
  DEV_ILLUSTRATION_FIXTURE_OPPORTUNITY,
  DEV_MULTI_AREA_FIXTURE_OPPORTUNITIES_LIST,
  isDevIllustrationTestEnabled,
} from "./devIllustrationFixture.ts";

/** Requests larger than this are refused before their body is read (mirrors handler.ts's own bound). */
const MAX_DEV_TEST_REQUEST_BYTES = 12_000_000;

function forwardedHeaders(request: Request): Headers {
  const headers = new Headers();
  for (const name of ["origin", "host", "x-request-id", "x-vercel-id"]) {
    const v = request.headers.get(name);
    if (v) headers.set(name, v);
  }
  return headers;
}

export async function handleDevIllustrationTestRequest(request: Request, deps: IllustrationHandlerDeps): Promise<Response> {
  if (!isDevIllustrationTestEnabled(deps.env)) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  if (Number(request.headers.get("content-length") ?? 0) > MAX_DEV_TEST_REQUEST_BYTES) {
    return Response.json({ error: "too_large" }, { status: 413 });
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
  let payload: { photoVisualizationConsent?: unknown; photoQualityValid?: unknown; fixture?: unknown };
  try {
    const parsed: unknown = JSON.parse(payloadText);
    if (!parsed || typeof parsed !== "object") throw new Error("shape");
    payload = parsed as typeof payload;
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const useMulti = payload.fixture === "multi";
  const opportunities = useMulti ? DEV_MULTI_AREA_FIXTURE_OPPORTUNITIES_LIST : [DEV_ILLUSTRATION_FIXTURE_OPPORTUNITY];
  const eligibility = useMulti ? { calibrated: true, policy: DEV_FULL_ILLUSTRATION_POLICY } : { calibrated: true };
  const buildPlan = useMulti ? (input: { frontPhoto: { ref: string } | null }) => buildDevMultiAreaPlan(input.frontPhoto?.ref ?? "upload") : undefined;

  // Rebuilt from scratch: the same photo bytes, but the ONLY opportunities this
  // path will ever pass on to the real handler are one of the two fixed fixtures above.
  const rebuilt = new FormData();
  rebuilt.append("photo", photo, photo.name || "portrait");
  rebuilt.append(
    "payload",
    JSON.stringify({
      photoVisualizationConsent: payload.photoVisualizationConsent,
      photoQualityValid: payload.photoQualityValid === true,
      opportunities,
    }),
  );
  const forwarded = new Request(request.url, { method: "POST", headers: forwardedHeaders(request), body: rebuilt });

  return handleIllustrationRequest(forwarded, { ...deps, eligibility, buildPlan });
}
