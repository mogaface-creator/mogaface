/**
 * The real image provider: OpenAI's image-edit API (POST /v1/images/edits,
 * multipart) over plain `fetch`. SERVER-SIDE ONLY — it takes the API key and the
 * photo bytes, so it runs only inside the illustration handler (handler.ts).
 *
 * It is a RENDERER. It receives the fixed prompt built from the validated plan
 * and the source photo — nothing else: no findings, opportunities, treatment
 * categories, questionnaire answers, ids or scores. It refuses to run without
 * the photo-processing consent. Every failure is an ImageGenerationError with
 * a content-free code; no message contains the key, the prompt or image data.
 * The optional `onProviderError` config hook exists solely so a caller (see
 * handler.ts) can log WHY OpenAI rejected a request — HTTP status plus
 * OpenAI's own short error code/type/message — without that detail ever
 * reaching the browser response or containing anything but that safe summary.
 */

import { validateIllustrationPrompt } from "../visualization/safety.ts";
import { allowsPhotoProcessing } from "../visualization/consent.ts";
import { validateGeneratedImage, imageDimensions } from "./output.ts";
import { illustrationPromptFor } from "./provider.ts";
import { ImageGenerationError } from "./types.ts";
import type { ImageGenerationProvider } from "./types.ts";

/** Used only when IMAGE_GENERATION_MODEL is unset — from OpenAI's published image-model list; confirm during the supervised live call. */
export const DEFAULT_IMAGE_MODEL = "gpt-image-2.5-sunburst";
export const OPENAI_IMAGE_EDITS_URL = "https://api.openai.com/v1/images/edits";
export const DEFAULT_IMAGE_TIMEOUT_MS = 55_000;

export interface OpenAiImageConfig {
  apiKey: string;
  model?: string;
  /** e.g. "1024x1536". Unset → chosen from the source photo's orientation. */
  size?: string;
  quality?: string;
  /**
   * Unused: OpenAI confirmed (400 invalid_input_fidelity_model, in a live supervised
   * test) that the default model — gpt-image-2.5-sunburst — rejects this parameter
   * outright; its image inputs are already handled at high fidelity, so there is
   * nothing to configure. Kept only so IMAGE_GENERATION_INPUT_FIDELITY (.env.example)
   * doesn't need touching too; it is never read.
   */
  inputFidelity?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /**
   * Debugging hook: called ONLY on a non-2xx response, with the HTTP status and
   * OpenAI's own error code/type/message — never the key, the prompt, the
   * photo, image bytes, or the request body. The message is bounded to keep it
   * that way even if a future response body were ever unexpectedly large.
   */
  onProviderError?: (detail: OpenAiProviderErrorDetail) => void;
}

/** Safe-to-log detail about a failed OpenAI call. Never contains request/response bytes. */
export interface OpenAiProviderErrorDetail {
  status: number;
  code?: string;
  type?: string;
  message?: string;
}

const MAX_LOGGED_MESSAGE_CHARS = 300;

/** Best-effort: OpenAI errors are small JSON objects, but a gateway/proxy failure can return anything (or nothing parseable). */
async function readProviderErrorDetail(response: Response): Promise<OpenAiProviderErrorDetail> {
  let body: { error?: { code?: unknown; type?: unknown; message?: unknown } } | undefined;
  try {
    body = (await response.json()) as typeof body;
  } catch {
    body = undefined;
  }
  const e = body?.error;
  return {
    status: response.status,
    code: typeof e?.code === "string" ? e.code : undefined,
    type: typeof e?.type === "string" ? e.type : undefined,
    message: typeof e?.message === "string" ? e.message.slice(0, MAX_LOGGED_MESSAGE_CHARS) : undefined,
  };
}

const EXTENSION: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

export function chooseImageSize(bytes: Uint8Array): string {
  const d = imageDimensions(bytes);
  if (!d) return "1024x1024";
  return d.height > d.width * 1.1 ? "1024x1536" : d.width > d.height * 1.1 ? "1536x1024" : "1024x1024";
}

export function createOpenAiImageProvider(config: OpenAiImageConfig): ImageGenerationProvider {
  const model = config.model || DEFAULT_IMAGE_MODEL;
  return {
    id: "openai-images",
    isMock: false,
    async generateIllustration(request) {
      if (!allowsPhotoProcessing(request.photoConsent)) throw new ImageGenerationError("no_consent", "Photo processing has not been agreed to.");
      const { bytes, mimeType } = request.sourceImage;
      if (!bytes || !mimeType || !EXTENSION[mimeType]) throw new ImageGenerationError("invalid_source", "The source photo is missing.");
      const prompt = illustrationPromptFor(request.visualizationPlan);
      if (validateIllustrationPrompt(prompt).length > 0) throw new ImageGenerationError("unsafe_prompt", "The prompt did not pass the safety check.");

      const postEdit = (modelName: string, size: string | undefined, quality: string | undefined) => {
        const form = new FormData();
        form.append("model", modelName);
        form.append("image", new Blob([bytes as BlobPart], { type: mimeType }), `portrait.${EXTENSION[mimeType]}`);
        form.append("prompt", prompt);
        form.append("n", "1");
        form.append("size", size || chooseImageSize(bytes));
        if (quality) form.append("quality", quality);
        form.append("output_format", "jpeg");
        return (config.fetchImpl ?? fetch)(OPENAI_IMAGE_EDITS_URL, {
          method: "POST",
          headers: { authorization: `Bearer ${config.apiKey}` }, // no content-type: fetch sets the multipart boundary
          body: form,
          signal: AbortSignal.timeout(config.timeoutMs ?? DEFAULT_IMAGE_TIMEOUT_MS),
        });
      };

      let response: Response;
      try {
        response = await postEdit(model, config.size, config.quality);
      } catch (e) {
        const name = e instanceof Error ? e.name : "";
        throw new ImageGenerationError(name === "TimeoutError" || name === "AbortError" ? "timeout" : "provider_failed", "The image provider could not be reached.");
      }
      if (!response.ok) {
        const detail = await readProviderErrorDetail(response);
        const usedOverride = model !== DEFAULT_IMAGE_MODEL || !!config.size || !!config.quality;
        // A mistaken model, size, or quality on the deployment must not blank the illustration.
        // One retry uses the known-good defaults; any other error is still a failure.
        if (detail.code === "invalid_value" && usedOverride) {
          try {
            response = await postEdit(DEFAULT_IMAGE_MODEL, undefined, undefined);
          } catch (e) {
            const name = e instanceof Error ? e.name : "";
            throw new ImageGenerationError(name === "TimeoutError" || name === "AbortError" ? "timeout" : "provider_failed", "The image provider could not be reached.");
          }
        } else {
          if (config.onProviderError) config.onProviderError(detail);
          throw new ImageGenerationError("provider_failed", "The image provider returned an error.");
        }
      }
      if (!response.ok) {
        if (config.onProviderError) config.onProviderError(await readProviderErrorDetail(response));
        throw new ImageGenerationError("provider_failed", "The image provider returned an error.");
      }
      let data: { data?: { b64_json?: unknown }[] };
      try {
        data = (await response.json()) as typeof data;
      } catch {
        throw new ImageGenerationError("invalid_result", "The image provider returned an unreadable response.");
      }
      const checked = validateGeneratedImage(data.data?.[0]?.b64_json, bytes);
      if (!checked.ok) throw new ImageGenerationError("invalid_result", "The generated image did not pass validation.");
      return { imageUrl: `data:${checked.mimeType};base64,${checked.base64}`, provider: "openai-images", createdAt: new Date().toISOString() };
    },
  };
}
