/**
 * TEMPORARY, production-accessible route for testing the REAL Before ->
 * Illustrative After image quality on the live Vercel deployment — see
 * app/illustration-preview/page.tsx and app/api/illustration-preview/route.ts.
 *
 * This is NOT the same thing as devTestHandler.ts (which refuses outright in
 * production): this route is DESIGNED to work on the live deployment, for a
 * small group of testers, behind its own access secret — never the same gate
 * as the dev-only tooling, and never open to normal visitors.
 *
 * It reuses handleIllustrationRequest (handler.ts) UNMODIFIED — the same
 * same-origin check, consent gate, photo validation, safety-checked prompt
 * and output validation as production. Only two things are supplied here
 * that production normally lacks (since MogaFace has no auth/rate-limit
 * store yet — see access.ts):
 *   - an Authenticator bound to the preview secret (constant-time compared,
 *     read from a request header, never from the request body or the URL);
 *   - a small in-memory RateLimiter (per-process, same honest caveat as
 *     handler.ts's own development limiter: NOT a durable production
 *     control, but real throttling for a small-group testing tool).
 *
 * The opportunities this route ever forwards are the SAME fixed
 * DEV_ILLUSTRATION_FIXTURE_OPPORTUNITY the existing dev-only test path uses
 * (lib/image-generation/devIllustrationFixture.ts) — expression_lines only,
 * the one category the real ILLUSTRATION_POLICY already approves. A caller
 * cannot submit its own opportunities: this handler ignores that field
 * entirely, same as devTestHandler.ts. The real ILLUSTRATION_POLICY is never
 * touched; only the calibration check is overridden, for this one fixed
 * fixture, on this one route.
 */

import { timingSafeEqual } from "node:crypto";
import { createMemoryRateLimiter } from "../interpretation/access.ts";
import type { Authenticator, RateLimiter } from "../interpretation/access.ts";
import { handleIllustrationRequest } from "./handler.ts";
import type { IllustrationHandlerDeps } from "./handler.ts";
import { DEV_ILLUSTRATION_FIXTURE_OPPORTUNITY } from "./devIllustrationFixture.ts";
import { PREVIEW_SECRET_HEADER } from "./livePreviewConstants.ts";
export { PREVIEW_SECRET_HEADER } from "./livePreviewConstants.ts";

export interface LivePreviewEnv {
  /** Master switch. Must be exactly "1", or this route behaves as if it does not exist (404) — same philosophy as devTestHandler.ts's double gate. */
  ILLUSTRATION_LIVE_PREVIEW?: string;
  /** The access secret. Must be set and at least 8 characters, or the route is treated as not configured (404), never as "anyone may pass an empty code". */
  ILLUSTRATION_PREVIEW_SECRET?: string;
  [key: string]: string | undefined;
}

const MIN_SECRET_LENGTH = 8;
export function isLivePreviewEnabled(env: LivePreviewEnv): boolean {
  return env.ILLUSTRATION_LIVE_PREVIEW === "1" && typeof env.ILLUSTRATION_PREVIEW_SECRET === "string" && env.ILLUSTRATION_PREVIEW_SECRET.length >= MIN_SECRET_LENGTH;
}

/**
 * Constant-time comparison so response timing can't leak how much of the
 * code was correct. Never logs the submitted or expected value.
 */
export function verifyPreviewCode(env: LivePreviewEnv, submitted: unknown): boolean {
  if (!isLivePreviewEnabled(env) || typeof submitted !== "string" || submitted.length === 0) return false;
  const expected = Buffer.from(env.ILLUSTRATION_PREVIEW_SECRET!, "utf8");
  const actual = Buffer.from(submitted, "utf8");
  if (expected.length !== actual.length) return false; // timingSafeEqual requires equal-length buffers
  return timingSafeEqual(expected, actual);
}

// The code is already verified against the original request below, before the forwarded
// request is even built — this Authenticator only satisfies handleIllustrationRequest's own
// step 3, it never re-reads the header (the forwarded request doesn't carry it).
const livePreviewAuthenticator: Authenticator = async () => ({ subject: "illustration-live-preview" });

let sharedLivePreviewLimiter: RateLimiter | null = null;
// ponytail: per-process, same as handler.ts's own devLimiter() — a real throttle for a
// small testing tool, not a durable production control (each serverless instance has its
// own counter). Replace with a shared-store limiter if this route is kept long-term.
const livePreviewLimiter = () => (sharedLivePreviewLimiter ??= createMemoryRateLimiter({ limit: 10, windowMs: 60 * 60_000 }));

/** GET /api/illustration-preview — checks the code only, generates nothing. Lets the UI gate itself on a valid code before the person even chooses a photo. */
export function handleLivePreviewVerify(request: Request, env: LivePreviewEnv): Response {
  if (!isLivePreviewEnabled(env)) return Response.json({ error: "not_found" }, { status: 404 });
  if (!verifyPreviewCode(env, request.headers.get(PREVIEW_SECRET_HEADER))) return Response.json({ error: "unauthorized" }, { status: 401 });
  return Response.json({ status: "ok" });
}

/**
 * POST /api/illustration-preview — the real generation call. Refuses with a
 * plain 404 if the master switch isn't on (indistinguishable from the route
 * not existing); refuses with 401 if the code is missing/wrong, BEFORE the
 * real handler's own checks (same-origin, consent, photo validation, safety)
 * ever run.
 */
export async function handleLivePreviewGenerate(request: Request, deps: IllustrationHandlerDeps): Promise<Response> {
  const env = deps.env as LivePreviewEnv;
  if (!isLivePreviewEnabled(env)) return Response.json({ error: "not_found" }, { status: 404 });
  if (!verifyPreviewCode(env, request.headers.get(PREVIEW_SECRET_HEADER))) return Response.json({ error: "unauthorized" }, { status: 401 });

  // Rebuilt from scratch: the caller's own "opportunities" (if any) are discarded outright —
  // this path only ever forwards the one fixed, policy-approved fixture, same as devTestHandler.ts.
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
  let payload: { photoVisualizationConsent?: unknown; photoQualityValid?: unknown };
  try {
    const parsed: unknown = JSON.parse(payloadText);
    if (!parsed || typeof parsed !== "object") throw new Error("shape");
    payload = parsed as typeof payload;
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const rebuilt = new FormData();
  rebuilt.append("photo", photo, photo.name || "portrait");
  rebuilt.append(
    "payload",
    JSON.stringify({
      photoVisualizationConsent: payload.photoVisualizationConsent,
      photoQualityValid: payload.photoQualityValid === true,
      opportunities: [DEV_ILLUSTRATION_FIXTURE_OPPORTUNITY],
    }),
  );
  const headers = new Headers();
  for (const name of ["origin", "host", "x-request-id", "x-vercel-id"]) {
    const v = request.headers.get(name);
    if (v) headers.set(name, v);
  }
  const forwarded = new Request(request.url, { method: "POST", headers, body: rebuilt });

  return handleIllustrationRequest(forwarded, {
    ...deps,
    authenticator: livePreviewAuthenticator,
    rateLimiter: deps.rateLimiter ?? livePreviewLimiter(),
    eligibility: { calibrated: true },
  });
}
