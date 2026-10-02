/**
 * Server-side image generation for the async job runner.
 *
 * Calls the OpenAI image-edit API directly (same provider as the live
 * illustration endpoint) with the stored before-photo bytes and the
 * treatment opportunities from the analysis record.
 *
 * This runs inside /api/process-submissions (behind CRON_SECRET), not in
 * the browser, so it can use the OpenAI key without any of the
 * client-side gate logic that the real /api/generate-illustration requires.
 *
 * Returns { ok: true, base64, mime } or { ok: false, reason }.
 */

import { createOpenAiImageProvider, DEFAULT_IMAGE_MODEL, DEFAULT_IMAGE_TIMEOUT_MS } from "../image-generation/openaiImages";
import { generateVisualization } from "../image-generation/provider";
import { buildVisualizationPlan } from "../visualization/build";
import { decideIllustrationEligibility } from "../visualization/eligibility";
import { buildPredictionFocus } from "../visualization/focus";
import type { AnalysisRecord } from "../analysis-session/types";
import type { ImageMime } from "../image-generation/output";

export type ImageJobResult =
  | { ok: true; base64: string; mime: string }
  | { ok: false; reason: string };

export interface ImageJobInput {
  beforeBytes: Buffer;
  beforeMime: ImageMime;
  /** null when no analysis session exists — generates a generic improvement image */
  record: AnalysisRecord | null;
}

export async function generateAfterImage(input: ImageJobInput): Promise<ImageJobResult> {
  const env = process.env;
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) return { ok: false, reason: "openai_not_configured" };
  if (env.IMAGE_GENERATION_PROVIDER?.trim().toLowerCase() !== "openai") {
    return { ok: false, reason: "image_provider_disabled" };
  }

  const model = env.IMAGE_GENERATION_MODEL?.trim() || DEFAULT_IMAGE_MODEL;
  const timeoutMs = Number(env.IMAGE_GENERATION_TIMEOUT_MS) > 0
    ? Math.min(58_000, Math.max(10_000, Number(env.IMAGE_GENERATION_TIMEOUT_MS)))
    : DEFAULT_IMAGE_TIMEOUT_MS;

  const provider = createOpenAiImageProvider({
    apiKey,
    model,
    size: env.IMAGE_GENERATION_SIZE?.trim() || undefined,
    quality: env.IMAGE_GENERATION_QUALITY?.trim() || undefined,
    timeoutMs,
  });

  // Build the visualization plan from the stored opportunities
  let plan: ReturnType<typeof buildVisualizationPlan>;
  let approvedChanges: ReturnType<typeof decideIllustrationEligibility>["approvedChanges"];

  if (input.record) {
    const frontPhoto = { ref: "upload", qualityValid: true };
    plan = buildVisualizationPlan({ frontPhoto, opportunities: input.record.opportunities });

    // Try the prediction plan first (goal-driven, not gated by calibration)
    const predictionPlan = input.record.predictionPlan;
    if (predictionPlan?.status === "planned" && predictionPlan.changes.length > 0) {
      // Enrich focus if missing
      const enrichedPlan = {
        ...predictionPlan,
        focus: predictionPlan.focus?.length
          ? predictionPlan.focus
          : buildPredictionFocus(
              input.record.assessment,
              predictionPlan.changes.map((c) => c.category),
            ),
      };
      plan = enrichedPlan as typeof plan;
      approvedChanges = enrichedPlan.changes;
    } else {
      const eligibility = decideIllustrationEligibility(plan, input.record.opportunities, { calibrated: true });
      if (!eligibility.eligible || eligibility.approvedChanges.length === 0) {
        return { ok: false, reason: "not_eligible" };
      }
      approvedChanges = eligibility.approvedChanges;
    }
  } else {
    // No analysis record: build a generic improvement — just a plan-shaped object
    // with one change that the provider can use.
    const genericPlan = {
      status: "planned" as const,
      version: "0",
      sourcePhoto: { ref: "upload", qualityValid: true },
      excludedChanges: [],
      disclaimer: "",
      changes: [
        {
          category: "skin_texture" as const,
          visualInstruction:
            "Improve skin clarity and evenness. Reduce visible blemishes, redness, and uneven tone across the face.",
        },
      ],
    };
    plan = genericPlan as unknown as ReturnType<typeof buildVisualizationPlan>;
    approvedChanges = genericPlan.changes as unknown as typeof approvedChanges;
  }

  const bytes = new Uint8Array(input.beforeBytes);

  try {
    const result = await generateVisualization({
      sourceImage: {
        url: "upload",
        slot: "front",
        bytes,
        mimeType: input.beforeMime,
      },
      plan: { ...plan, changes: approvedChanges },
      provider,
      photoConsent: "granted",
      timeoutMs: timeoutMs + 500,
      maxImageChars: 20_000_000,
    });

    if (result.status !== "ready" || !result.imageUrl) {
      return { ok: false, reason: result.errorCode ?? "generation_failed" };
    }

    // Parse the data URL
    const match = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(result.imageUrl);
    if (!match) return { ok: false, reason: "invalid_result_format" };

    return { ok: true, base64: match[2], mime: match[1] };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "generation_error" };
  }
}
