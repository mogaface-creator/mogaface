/**
 * The server-side interpretation endpoint, as a plain function so it can be
 * tested without Next. app/api/interpret/route.ts is a thin wrapper.
 *
 * Order of checks (each one stops the request, and the model is only ever
 * called after all of them pass):
 *   1. Is a third-party provider switched on and keyed?      no → { available: false }
 *   2. Same-origin request?                                    no → 403
 *   3. Authenticated? (none exists yet → refused in production) no → 401
 *   4. Within the rate limit? (no store yet → refused in prod)  no → 429 / 503
 *   5. Well-formed, small, photo-free body?                    no → 400 / 413
 *   6. Has the person consented to third-party processing?     no → 403
 * Then the model is asked for wording, bounded by a timeout. Any failure —
 * timeout, network, provider error, malformed or invalid output, changed
 * facts — returns the DETERMINISTIC result with HTTP 200, so the report never
 * depends on the model and the browser never sees an error for it.
 *
 * Logging is one line of operational metadata: never the key, the payload,
 * questionnaire answers, photos or model output.
 */

import { allowsThirdPartyInterpretation } from "./consent.ts";
import { createMemoryRateLimiter, devAuthenticator } from "./access.ts";
import type { Authenticator, RateLimiter } from "./access.ts";
import { interpretWithFallback, localRulesProvider } from "./provider.ts";
import type { FallbackReason } from "./provider.ts";
import { interpretationModel, interpretationTimeoutMs, isThirdPartyInterpretationEnabled, selectInterpretationProvider } from "./select.ts";
import type { InterpretationInput } from "./types.ts";

export const MAX_BODY_BYTES = 200_000;

export interface InterpretLogEntry {
  event: "interpret";
  requestId: string;
  provider: string;
  /** The configured model id (a config value, not user data). */
  model?: string;
  outcome: "disabled" | "denied" | "rejected" | "ai" | "fallback";
  status: number;
  reason?: string;
  durationMs: number;
}

export interface InterpretHandlerDeps {
  env: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
  /** Supplied by a future auth module. None → development: anyone on localhost; production: nobody. */
  authenticator?: Authenticator | null;
  /** Supplied by a future shared store. None → development: an in-memory limiter; production: refused. */
  rateLimiter?: RateLimiter | null;
  logger?: (entry: InterpretLogEntry) => void;
  /** Overrides INTERPRETATION_TIMEOUT_MS (tests). */
  timeoutMs?: number;
  now?: () => number;
  requestId?: () => string;
}

const ENVELOPE_KEYS = new Set(["consent", "input"]);
const PHOTO_MARKERS = /data:image|data:video|blob:|"landmarks"|"frontPhoto"|"imageUrl"/i;

let sharedDevLimiter: RateLimiter | null = null;
const devLimiter = () => (sharedDevLimiter ??= createMemoryRateLimiter());

const isInput = (v: unknown): v is InterpretationInput => {
  const o = v as Partial<InterpretationInput> | null;
  return !!o && typeof o.assessmentId === "string" && Array.isArray(o.goals) && Array.isArray(o.observations) && Array.isArray(o.opportunities) && Array.isArray(o.limitations);
};

export const defaultLogger = (entry: InterpretLogEntry) => console.info(JSON.stringify(entry));

export async function handleInterpretRequest(request: Request, deps: InterpretHandlerDeps): Promise<Response> {
  const now = deps.now ?? Date.now;
  const started = now();
  const requestId = request.headers.get("x-request-id") ?? request.headers.get("x-vercel-id") ?? deps.requestId?.() ?? crypto.randomUUID();
  const log = deps.logger ?? defaultLogger;
  const production = deps.env.NODE_ENV === "production";
  const provider = selectInterpretationProvider(deps.env, deps.fetchImpl);

  const done = (outcome: InterpretLogEntry["outcome"], status: number, body: unknown, reason?: string, headers?: Record<string, string>) => {
    log({ event: "interpret", requestId, provider: provider.id, ...(provider.id !== "local-rules" && { model: interpretationModel(deps.env) }), outcome, status, ...(reason && { reason }), durationMs: now() - started });
    return Response.json(body, { status, headers });
  };

  // 1. Off by default: unset, "local", an unknown name, or no key. Nothing else is revealed.
  if (!isThirdPartyInterpretationEnabled(deps.env)) return done("disabled", 200, { available: false }, "provider_disabled");

  // 2. Same origin only.
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) return done("denied", 403, { error: "forbidden" }, "cross_origin");

  // 3. Authentication. Production has none yet, so it refuses.
  const authenticator = deps.authenticator ?? (production ? null : devAuthenticator);
  if (!authenticator) return done("denied", 401, { error: "unauthorized" }, "authentication_not_configured");
  const who = await authenticator(request);
  if (!who) return done("denied", 401, { error: "unauthorized" }, "unauthenticated");

  // 4. Rate limit. Production has no shared store yet, so it refuses rather than pretend.
  const limiter = deps.rateLimiter ?? (production ? null : devLimiter());
  if (!limiter) return done("denied", 503, { error: "unavailable" }, "rate_limiter_not_configured");
  const decision = await limiter.check(who.subject);
  if (!decision.allowed) return done("denied", 429, { error: "rate_limited" }, "rate_limited", { "retry-after": String(decision.retryAfterSeconds) });

  // 5. The body: bounded, JSON, an exact envelope, and no photo-like content.
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return done("rejected", 413, { error: "too_large" }, "too_large");
  if (PHOTO_MARKERS.test(text)) return done("rejected", 400, { error: "invalid_input" }, "photo_content");
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return done("rejected", 400, { error: "invalid_json" }, "invalid_json");
  }
  const envelope = body as { consent?: unknown; input?: unknown } | null;
  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope) || Object.keys(envelope).some((k) => !ENVELOPE_KEYS.has(k)) || !isInput(envelope.input)) {
    return done("rejected", 400, { error: "invalid_input" }, "invalid_envelope");
  }

  // 6. Consent to third-party processing. Only "granted" passes.
  if (!allowsThirdPartyInterpretation(envelope.consent)) return done("denied", 403, { error: "consent_required" }, `consent_${typeof envelope.consent === "string" ? envelope.consent : "missing"}`);

  // Ask for wording, bounded by a timeout; on any failure use the deterministic result.
  const input = envelope.input;
  const timeoutMs = deps.timeoutMs ?? interpretationTimeoutMs(deps.env);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<"timeout">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), timeoutMs);
  });
  try {
    const outcome = await Promise.race([interpretWithFallback(provider, input), timedOut]);
    if (outcome === "timeout") {
      const local = await interpretWithFallback(localRulesProvider, input);
      return done("fallback", 200, { result: local.result, providerId: local.providerId, usedFallback: true, fallbackReason: "timeout" satisfies FallbackReason }, "timeout");
    }
    const usedFallback = outcome.providerId !== provider.id;
    return done(
      usedFallback ? "fallback" : "ai",
      200,
      { result: outcome.result, providerId: outcome.providerId, usedFallback, fallbackReason: outcome.fallbackReason },
      outcome.fallbackReason ?? undefined,
    );
  } finally {
    clearTimeout(timer);
  }
}
