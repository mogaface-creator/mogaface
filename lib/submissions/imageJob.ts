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

  const model = env.IMAGE_GENERATION_MODEL?.trim() || DEFAULT_IMAGE_MODEL;
  const timeoutMs = Number(env.IMAGE_GENERATION_TIMEOUT_MS) > 0
    ? Math.min(58_000, Math.max(10_000, Number(env.IMAGE_GENERATION_TIMEOUT_MS)))
    : DEFAULT_IMAGE_TIMEOUT_MS;

  const bytes = new Uint8Array(input.beforeBytes);
  const mimeType = input.beforeMime;
  const ext = EXTENSION[mimeType] || "jpg";

  // Build targeted aesthetic refinements based on Clinical Vision diagnostic findings first
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
        specificRefinements.push("- Enhance jawline and mandibular border definition, creating a firmer, sharper lower facial contour.");
      } else if (concern.includes("under_eye") || title.includes("tear") || title.includes("eye") || title.includes("dark circle")) {
        specificRefinements.push("- Restore smooth volume in the tear troughs and under-eye region, softening dark circles and eye bags for a refreshed, rested look.");
      } else if (concern.includes("lifting") || cat.includes("lifting")) {
        specificRefinements.push("- Subtly elevate the midface and malar cheek volume for a natural, youthful lift.");
      } else if (concern.includes("skin") || cat.includes("skin")) {
        specificRefinements.push("- Refine skin tone and clarity: smooth micro-blemishes, reduce redness, and impart a clean, healthy, hydrated glow.");
      } else if (concern.includes("lines") || cat.includes("neuromodulator")) {
        specificRefinements.push("- Soften dynamic expression lines across the forehead and periorbital area while preserving natural facial animation.");
      }
    }
  }

  // If no specific refinements found, use standard clinical glow-up targets
  if (specificRefinements.length === 0) {
    specificRefinements.push(
      "- Restore smooth volume in the tear troughs and under-eye region, significantly softening dark circles and fatigue.",
      "- Define and firm the jawline contour and chin angle for a clean, sculpted silhouette.",
      "- Perfect skin clarity: clear uneven tone and minor blemishes, creating healthy radiant skin texture."
    );
  }

  const prompt = [
    "Edit this portrait to show an aesthetic glow-up following non-surgical aesthetic medical treatments.",
    "CRITICAL IDENTITY REQUIREMENT: Maintain 100% exact facial identity, ethnic features, skull bone structure, eye shape, nose structure, facial hair pattern (if any), eyebrows, and overall facial geometry. The person must remain immediately and unmistakably recognizable as the exact same individual.",
    "Keep the exact same pose, camera crop, angle, head tilt, clothing, and background.",
    "",
    "MANDATORY CLINICAL AESTHETIC CORRECTIONS (Treatable skin and soft-tissue conditions MUST be corrected):",
    "- COMPLETE ACNE & PIMPLE CLEARANCE: Completely eliminate and erase ALL active pimples, acne breakouts, red papules, pustules, bumps, blackheads, and post-inflammatory dark spots across the entire face (especially forehead, glabella between eyebrows, cheeks, chin, and temples). The skin must be transformed to look completely clear, clean, smooth, healthy, and blemish-free with natural, refined pore texture. Absolutely NO pimples, pustules, or red bumps should remain.",
    "- LIP REJUVENATION & BRIGHTENING: Rejuvenate, hydrate, and brighten any dark, hyperpigmented, brown, or dull lips. Infuse the lips with a healthy, fresh, deeply hydrated, naturally even pink/rosy tone with a crisp, soft vermilion border. Never leave lips dark, dry, or discolored.",
    "- PERIORBITAL TEAR TROUGH RESTORATION: Eliminate dark under-eye circles and smooth hollow tear troughs for an awake, rested, refreshed gaze.",
    "- MANDIBULAR & JAWLINE DEFINITION: Firm and sculpt the lower jawline and chin contour for clean, defined lower-face architecture.",
    "",
    ...(specificRefinements.length > 0 ? [
      "PATIENT-SPECIFIC CLINICAL DIRECTIVES:",
      ...specificRefinements,
      "",
    ] : []),
    "PHOTOGRAPHIC FINISH & REALISM:",
    "- Apply flattering clinical studio portrait lighting: soft directional light, subtle cheekbone radiance, and crisp catchlights in the eyes.",
    "- Relaxed, confident, attractive micro-expression.",
    "The output must look like a high-resolution, unretouched real DSLR photo of this exact person looking their absolute healthiest, clearest, and most attractive — NOT an airbrushed, cartoon, or AI filter look.",
  ].join("\n");

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
