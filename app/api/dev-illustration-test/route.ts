import { handleDevIllustrationTestRequest } from "@/lib/image-generation/devTestHandler.ts";

// DEVELOPMENT-ONLY supervised test of the real illustration pipeline (see
// devTestHandler.ts and DevIllustrationTest.tsx). Refuses with a plain 404
// unless NODE_ENV=development AND DEV_ILLUSTRATION_TEST=1 are both set —
// impossible to reach from a production build or deploy. The production
// report never calls this route; it always goes through
// app/api/generate-illustration instead.
export const maxDuration = 60;

export function POST(request: Request) {
  return handleDevIllustrationTestRequest(request, { env: process.env });
}
