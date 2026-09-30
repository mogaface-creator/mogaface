/**
 * Browser-side call for POST /api/analysis-session. Called exactly once, from
 * AssessmentReview.tsx's "Analyze My Face" action, right after real local
 * analysis produces a MogaFaceAnalysis — never re-created on every visit to
 * /results (see lib/results/types.ts's AssessmentSnapshot.analysisSession).
 * Never throws: any failure (network, malformed response, a 4xx/5xx) yields
 * `null`, which the caller treats exactly like "not eligible" — the report
 * still generates; nothing falls back to submitting raw opportunities.
 */

import type { Assessment } from "../assessment/types.ts";
import type { MogaFaceAnalysis } from "../observation/types.ts";
import type { AnalysisSessionHandle } from "./types.ts";
import { ANGLE_SLOTS } from "../image-generation/angles.ts";

export interface CreateAnalysisSessionInput {
  assessment: Assessment;
  analysis: MogaFaceAnalysis;
  photoQualityValid: boolean;
  /** Whether a real left 45°/right 45° photo was actually captured this session — informational only, see AnalysisRecord.availableAngles. */
  hasLeftFortyFive?: boolean;
  hasRightFortyFive?: boolean;
  fetchImpl?: typeof fetch;
}

export async function createAnalysisSession(input: CreateAnalysisSessionInput): Promise<AnalysisSessionHandle | null> {
  const fetchImpl = input.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl("/api/analysis-session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        assessment: input.assessment,
        analysis: input.analysis,
        photoQualityValid: input.photoQualityValid,
        hasLeftFortyFive: input.hasLeftFortyFive === true,
        hasRightFortyFive: input.hasRightFortyFive === true,
      }),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as Partial<AnalysisSessionHandle>;
    if (typeof body.analysisId !== "string" || typeof body.sessionToken !== "string" || typeof body.illustrationEligible !== "boolean" || typeof body.expiresAt !== "string") return null;
    const availableAngles = Array.isArray(body.availableAngles) ? body.availableAngles.filter((a): a is (typeof ANGLE_SLOTS)[number] => (ANGLE_SLOTS as readonly string[]).includes(a)) : [];
    return { analysisId: body.analysisId, sessionToken: body.sessionToken, illustrationEligible: body.illustrationEligible, availableAngles, expiresAt: body.expiresAt };
  } catch {
    return null;
  }
}
