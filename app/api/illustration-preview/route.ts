import { handleLivePreviewGenerate, handleLivePreviewVerify } from "@/lib/image-generation/livePreviewHandler.ts";

// TEMPORARY, production-accessible route for testing the real Before ->
// Illustrative After image quality on the live deployment. Disabled unless
// ILLUSTRATION_LIVE_PREVIEW=1 and ILLUSTRATION_PREVIEW_SECRET are both set in
// Vercel's environment (server-side only — never exposed to the browser).
// See lib/image-generation/livePreviewHandler.ts for the access gate and
// lib/image-generation/handler.ts (unmodified) for the actual generation.
export const maxDuration = 60;

export function GET(request: Request) {
  return handleLivePreviewVerify(request, process.env);
}

export function POST(request: Request) {
  return handleLivePreviewGenerate(request, { env: process.env });
}
