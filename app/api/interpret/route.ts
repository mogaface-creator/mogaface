import { handleInterpretRequest } from "@/lib/interpretation/handler.ts";

// Server-side AI wording for the report. All logic — provider switch, origin
// check, authentication, rate limit, consent, timeout, deterministic fallback —
// lives in lib/interpretation/handler.ts so it can be tested. The API key is
// read from the environment there and never reaches the browser.
//
// Production status: DISABLED by default (INTERPRETATION_PROVIDER unset), and
// even when enabled it refuses every request until an authenticator and a
// shared-store rate limiter are supplied here. See docs/INTERPRETATION_AND_RESULTS.md.
export function POST(request: Request) {
  return handleInterpretRequest(request, { env: process.env });
}
