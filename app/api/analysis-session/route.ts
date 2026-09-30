import { handleCreateAnalysisSession } from "@/lib/analysis-session/handler.ts";

// Turns a client-submitted assessment + local analysis into a server-owned,
// server-derived AnalysisRecord, persisted to Supabase when configured
// (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — see
// lib/analysis-session/store.ts), or an in-memory fallback for local
// development otherwise. /api/generate-illustration (via
// lib/image-generation/trustedHandler.ts / multiAngle.ts) is the one
// consumer that later reads a record back by analysisId + sessionToken.
export function POST(request: Request) {
  return handleCreateAnalysisSession(request, { env: process.env });
}
