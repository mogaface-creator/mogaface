import { appearancePlanFromAssessment } from "../image-generation/appearanceFromAssessment.ts";
/**
 * Photorealistic, Identity-Locked Clinical Aesthetic Simulation Engine.
 * Sends the portrait photograph to OpenAI's image edit API with strict identity lock directives.
 */

import { DEFAULT_IMAGE_MODEL, OPENAI_IMAGE_EDITS_URL, chooseImageSize } from "../image-generation/openaiImages.ts";
import { validateGeneratedImage } from "../image-generation/output.ts";
import type { AnalysisRecord } from "../analysis-session/types.ts";
import type { ImageMime } from "../image-generation/output.ts";
import type { ClinicalVisionResult } from "./clinicalVision.ts";
import { buildFullAestheticPrompt } from "./clinicalVision.ts";
import { reviewAfterImage, type ImageReview } from "./imageReview.ts";

export type ImageJobResult =
  | { ok: true; base64: string; mime: string; model?: string; review?: ImageReview }
  | { ok: false; reason: string; review?: ImageReview; debugPreview?: { base64: string; mime: string } };

export interface ImageJobInput {
  debugPreview?: boolean;
  beforeBytes: Buffer;
  beforeMime: ImageMime;
  record?: AnalysisRecord | null;
  clinicalVision?: ClinicalVisionResult | null;
  customPrompt?: string | null;
  simulateHair?: boolean;
  intensity?: "subtle" | "balanced" | "defined";
  customDirective?: string;
  portraitGeometry?: unknown;
  editRegion?: unknown;
}

const EXTENSION: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export async function generateAfterImage(input: ImageJobInput): Promise<ImageJobResult> {
  const env = process.env;
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) return { ok: false, reason: "openai_not_configured" };
  if (env.IMAGE_GENERATION_PROVIDER?.trim().toLowerCase() !== "openai") {
    return { ok: false, reason: "image_provider_disabled" };
  }

  const rawModel = env.IMAGE_GENERATION_MODEL?.trim();
  const model = (!rawModel || rawModel === "gpt-image-2.5-sunburst")
    ? DEFAULT_IMAGE_MODEL
    : rawModel;

  const timeoutMs = Number(env.IMAGE_GENERATION_TIMEOUT_MS) > 0
    ? Math.min(120_000, Math.max(10_000, Number(env.IMAGE_GENERATION_TIMEOUT_MS)))
    : 120_000;

  const bytes = new Uint8Array(input.beforeBytes);
  const mimeType = input.beforeMime;
  const ext = EXTENSION[mimeType] || "jpg";

  // Build or resolve the targeted aesthetic simulation prompt
  let prompt = input.customPrompt?.trim();
  if (!prompt) {
    if (input.record?.assessment) {
      prompt = appearancePlanFromAssessment(input.record.assessment).prompt;
    } else if (input.clinicalVision?.imagePrompt?.trim()) {
      prompt = input.clinicalVision.imagePrompt.trim();
    } else {
      prompt = buildFullAestheticPrompt({
        simulateHair: input.simulateHair,
        intensity: input.intensity || "balanced",
        customDirective: input.customDirective,
      });
    }
  }

  console.log(`[imageJob] Dispatching aesthetic simulation to OpenAI (${model}):\n${prompt.slice(0, 200)}...`);

  try {
    const postEdit = async (modelName: string, size?: string, quality?: string) => {
      const form = new FormData();
      form.append("model", modelName);
      form.append("image", new Blob([bytes as BlobPart], { type: mimeType }), `portrait.${ext}`);
      form.append("prompt", prompt);
      form.append("n", "1");
      form.append("size", size || chooseImageSize(bytes));
      form.append("quality", quality || "high");
      if (/^gpt-image-1\.5(?:-|$)/.test(modelName)) form.append("input_fidelity", "high");
      form.append("output_format", "jpeg");

      return fetch(OPENAI_IMAGE_EDITS_URL, {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}` },
        body: form,
        signal: AbortSignal.timeout(timeoutMs),
      });
    };

    let usedModel = model;
    let response = await postEdit(model, env.IMAGE_GENERATION_SIZE?.trim(), env.IMAGE_GENERATION_QUALITY?.trim());

    // If an optional size or custom model fails with 400, retry once with standard model
    if (!response.ok && response.status === 400 && model !== DEFAULT_IMAGE_MODEL) {
      console.warn(`[imageJob] Retrying with default model ${DEFAULT_IMAGE_MODEL}...`);
      usedModel = DEFAULT_IMAGE_MODEL;
      response = await postEdit(DEFAULT_IMAGE_MODEL);
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error(`[imageJob] OpenAI API error (${response.status}):`, errText.slice(0, 300));
      let detail = `openai_error_${response.status}`;
      try {
        const parsed = JSON.parse(errText);
        if (parsed.error?.code === "credit_balance_exhausted" || parsed.error?.type === "insufficient_quota" || errText.includes("no credits remaining")) {
          detail = "OpenAI account has zero credits remaining. Please add credits at platform.openai.com/billing";
        } else if (response.status === 429) {
          detail = "OpenAI rate limit reached. Please wait a few moments and try again.";
        } else if (parsed.error?.message) {
          detail = parsed.error.message;
        }
      } catch {
        // fallback to code
      }
      return { ok: false, reason: detail };
    }

    const data = (await response.json()) as { data?: { b64_json?: unknown }[] };
    const checked = validateGeneratedImage(data.data?.[0]?.b64_json, bytes);
    if (!checked.ok) {
      return { ok: false, reason: "invalid_result_image" };
    }

    const finalBase64 = checked.base64;
    const finalMime = checked.mimeType;

    // Automated quality & identity preservation triage
    const review = await reviewAfterImage({
      apiKey,
      model: env.CLINICAL_VISION_MODEL?.trim() || "gpt-4o",
      before: `data:${mimeType};base64,${input.beforeBytes.toString("base64")}`,
      after: `data:${finalMime};base64,${finalBase64}`,
      prompt,
    });

    console.log("[imageJob] Image review outcome:", review.status);

    if (review.status !== "approved") {
      return {ok:false,reason:review.status === "rejected" ? "image_quality_review_failed" : "image_review_unavailable",review,...(input.debugPreview ? {debugPreview:{base64:finalBase64,mime:finalMime}} : {})};
    }

    return { ok: true, base64: finalBase64, mime: finalMime, model: usedModel, review };
  } catch (err) {
    console.error("[imageJob] Simulation generation error:", err);
    return {
      ok: false,
      reason: err instanceof Error && err.name === "TimeoutError" ? "generation_timeout" : "generation_error",
    };
  }
}
