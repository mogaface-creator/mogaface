import { handleDevE2EIllustrationRequest } from "@/lib/image-generation/devE2EHandler.ts";

// Developer/clinic-only END-TO-END test path — reuses handleIllustrationRequest
// unmodified (same provider, consent gate, photo validation, safety-checked
// prompt and output validation as production). Refuses with a plain 404
// unless NODE_ENV=development AND DEV_E2E_ILLUSTRATION=1 — never reachable
// from a production build.
export const maxDuration = 60;

export function POST(request: Request) {
  return handleDevE2EIllustrationRequest(request, { env: process.env });
}
