/**
 * Server-side image generation for the async job runner.
 *
 * Calls OpenAI's image-edit API directly with the stored before-photo bytes
 * and crafts an aesthetic glow-up prompt (similar to iMorph / high-end aesthetic medicine
 * pre-consultation visualizers) that sharpens jawline definition, restores tear-trough
 * volume, improves skin tone/radiance, and applies flattering lighting while preserving
 * 100% of the patient's identity.
 *
 * Returns { ok: true, base64, mime } or { ok: false, reason }.
 */

import { DEFAULT_IMAGE_MODEL, DEFAULT_IMAGE_TIMEOUT_MS, OPENAI_IMAGE_EDITS_URL, chooseImageSize } from "../image-generation/openaiImages";
import { validateGeneratedImage } from "../image-generation/output";
import type { AnalysisRecord } from "../analysis-session/types";
import type { ImageMime } from "../image-generation/output";
import type { ClinicalVisionResult } from "./clinicalVision";

export type ImageJobResult =
  | { ok: true; base64: string; mime: string }
  | { ok: false; reason: string };

export interface ImageJobInput {
  beforeBytes: Buffer;
  beforeMime: ImageMime;
  /** null when no analysis session exists — generates a generic improvement image */
  record: AnalysisRecord | null;
  /** Clinical vision diagnostics from OpenAI Vision */
  clinicalVision?: ClinicalVisionResult | null;
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
    ? Math.min(58_000, Math.max(10_000, Number(env.IMAGE_GENERATION_TIMEOUT_MS)))
    : DEFAULT_IMAGE_TIMEOUT_MS;

  const bytes = new Uint8Array(input.beforeBytes);
  const mimeType = input.beforeMime;
  const ext = EXTENSION[mimeType] || "jpg";

  // 1. Priority: Use the direct, personalized edit prompt crafted by GPT-4o Vision inspecting the patient's actual portrait
  let prompt = input.clinicalVision?.imagePrompt?.trim();

  // 2. Fallback: Build targeted prompt from directives or intake record if no custom vision prompt
  if (!prompt) {
    const specificRefinements: string[] = [];

    if (input.clinicalVision?.simulationDirectives && input.clinicalVision.simulationDirectives.length > 0) {
      for (const directive of input.clinicalVision.simulationDirectives) {
        const cleanDirective = directive.trim().replace(/^[-*•]\s*/, "");
        if (cleanDirective) {
          specificRefinements.push(`- ${cleanDirective}`);
        }
      }
    } else if (input.record?.opportunities && input.record.opportunities.length > 0) {
      for (const opp of input.record.opportunities) {
        const concern = (opp.concern || "").toLowerCase();
        const cat = (opp.category || "").toLowerCase();
        const title = (opp.title || "").toLowerCase();

        if (concern.includes("contour") || cat.includes("contouring") || title.includes("jaw") || title.includes("chin")) {
          specificRefinements.push("- Enhance jawline and mandibular border definition, carving a firm, sharp lower facial contour.");
        } else if (concern.includes("under_eye") || title.includes("tear") || title.includes("eye") || title.includes("dark circle")) {
          specificRefinements.push("- Restore smooth volume in the tear troughs and under-eye region, softening dark circles.");
        } else if (concern.includes("lifting") || cat.includes("lifting")) {
          specificRefinements.push("- Subtly elevate the midface and malar cheek volume for a natural lift.");
        } else if (concern.includes("skin") || cat.includes("skin")) {
          specificRefinements.push("- Refine skin tone and clarity: smooth blemishes and clear acne bumps.");
        } else if (concern.includes("lines") || cat.includes("neuromodulator")) {
          specificRefinements.push("- Soften dynamic expression lines across the forehead.");
        }
      }
    }

    prompt = [
      "Realistic clinical aesthetic & hair restoration transformation of this person:",
      "1. HAIR RESTORATION & HAIRSTYLE: Fix any hair loss, receding hairline, or thinning. Restore a full, healthy, dense hairline and style the hair into a clean, sharp, well-groomed, attractive modern style suited to their face. (If completely bald or shaved, keep a clean scalp).",
      "2. JAWLINE & CHIN: Visibly slim facial fullness and double chin, carving a sharp, defined, sculpted masculine/feminine jawline.",
      "3. SKIN & COMPLEXION: Completely clear all acne, pimples, and blemishes. Keep realistic photographic skin texture with visible natural pores — absolutely NO plastic blur, NO wax figure look, and NO airbrushed doll filter.",
      "4. EYES: Refresh under-eye circles and tired eye bags, keeping the eyes completely natural, sharp, and lifelike with realistic specular highlights.",
      "5. COMPLEXION: Strictly preserve the authentic natural brown/tan skin tone without any bleaching or lightening.",
      "6. The final result must look like an authentic, high-resolution photograph of the same person looking their absolute best.",
      ...(specificRefinements.length > 0 ? specificRefinements : []),
    ].join("\n");
  }

  console.log(`[imageJob] Sending prompt to OpenAI Image Edits (${model}):\n${prompt}`);

  try {
    const postEdit = (modelName: string, size?: string, quality?: string) => {
      const form = new FormData();
      form.append("model", modelName);
      form.append("image", new Blob([bytes as BlobPart], { type: mimeType }), `portrait.${ext}`);
      form.append("prompt", prompt);
      form.append("n", "1");
      form.append("size", size || chooseImageSize(bytes));
      if (quality) form.append("quality", quality);
      form.append("output_format", "jpeg");
      return fetch(OPENAI_IMAGE_EDITS_URL, {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}` },
        body: form,
        signal: AbortSignal.timeout(timeoutMs),
      });
    };

    let response = await postEdit(model, env.IMAGE_GENERATION_SIZE?.trim(), env.IMAGE_GENERATION_QUALITY?.trim());

    if (!response.ok) {
      // Try default fallback model if a custom model/size had an issue
      if (model !== DEFAULT_IMAGE_MODEL) {
        response = await postEdit(DEFAULT_IMAGE_MODEL);
      }
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      return { ok: false, reason: `openai_error_${response.status}_${errText.slice(0, 100)}` };
    }

    const data = (await response.json()) as { data?: { b64_json?: unknown }[] };
    const checked = validateGeneratedImage(data.data?.[0]?.b64_json, bytes);
    if (!checked.ok) {
      return { ok: false, reason: "invalid_result_image" };
    }

    return { ok: true, base64: checked.base64, mime: checked.mimeType };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "generation_error" };
  }
}
