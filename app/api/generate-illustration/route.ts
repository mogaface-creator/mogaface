import { handleIllustrationRequest } from "@/lib/image-generation/handler.ts";

// Server-side illustrative image generation. All logic — provider switch, origin
// check, authentication, entitlement hook, rate limit, photo consent, photo
// validation, eligibility, safety-checked prompt, timeout — lives in
// lib/image-generation/handler.ts so it can be tested. The API key is read
// there and never reaches the browser. The photo is held in memory for the
// request only; nothing is stored or logged.
//
// Production status: DISABLED by default (IMAGE_GENERATION_PROVIDER unset), and
// even when enabled it refuses every request until an authenticator and a
// shared-store rate limiter are supplied here. See docs/INTERPRETATION_AND_RESULTS.md.
export const maxDuration = 60;

export function POST(request: Request) {
  return handleIllustrationRequest(request, { env: process.env });
}
