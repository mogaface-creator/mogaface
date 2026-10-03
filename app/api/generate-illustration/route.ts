import { handleMultiAngleIllustrationRequest } from "@/lib/image-generation/multiAngle.ts";

// Server-side illustrative image generation — front, and (when the person
// actually has one) left 45°/right 45°, generated from their own real source
// photo, sharing the SAME trusted analysis record (see
// lib/analysis-session/). The request carries an analysisId/sessionToken,
// never client-submitted treatment opportunities: handleMultiAngleIllustrationRequest
// resolves them once, against the server's own, independently-computed
// analysis record, then forwards each present angle to
// lib/image-generation/handler.ts's handleIllustrationRequest — unmodified —
// for everything else: provider switch, origin check, authentication,
// entitlement hook, rate limit, photo consent, photo validation, eligibility,
// safety-checked prompt, timeout. The API key is read there and never
// reaches the browser. Photos are held in memory for the request only;
// nothing is stored or logged.
//
// Production status: DISABLED by default (IMAGE_GENERATION_PROVIDER unset).
// When enabled, a request still has to present a valid analysis-session token.
// That verified session is the subject, and the stored record counts uses,
// so the image provider is not an open proxy. See lib/image-generation/trustedHandler.ts.
export const maxDuration = 60;

export function POST(request: Request) {
  return handleMultiAngleIllustrationRequest(request, { env: process.env });
}
