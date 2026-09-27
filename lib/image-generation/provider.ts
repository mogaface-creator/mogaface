/**
 * Orchestration around an ImageGenerationProvider: prompt construction,
 * provider selection from the environment, and the single entry point the app
 * uses (`generateVisualization`). That function NEVER throws and NEVER
 * retries: a failed illustration comes back as a status, so it can never fail
 * the assessment.
 *
 * The real provider is OpenAI's image-edit API (openaiImages.ts): server-side
 * only (its key must never reach the browser), and it refuses to send a photo
 * unless the photo-processing consent is "granted". `RemoteImageApi` +
 * `createRemoteImageProvider` remain the generic adapter structure for other vendors.
 */

import type { VisualizationPlan } from "../visualization/types.ts";
import { validateVisualizationPlan } from "../visualization/validate.ts";
import type { TreatmentOpportunity } from "../treatment-opportunities/types.ts";
import { createMockProvider } from "./mockProvider.ts";
import { validateIllustrationPrompt } from "../visualization/safety.ts";
import type { PhotoVisualizationConsent } from "../visualization/consent.ts";
import { ImageGenerationError } from "./types.ts";
import type { ImageGenerationProvider, ImageGenerationRequest, ImageGenerationResult, SourceImage, Visualization } from "./types.ts";

/** Generated references larger than this (e.g. an inline data URL) are refused: no large binaries in local storage. */
export const MAX_IMAGE_REFERENCE_LENGTH = 2_000_000;
export const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * The instruction an image model receives — built ONLY from the validated plan's
 * fixed, approved fields (never from user text, a request, or a model). The
 * whole prompt is scanned by validateIllustrationPrompt before any call.
 * It says what to preserve and the approved change(s); it never says why a
 * change was chosen, names a treatment, or asks the model to improve anything.
 * A plan may carry more than one approved change (see visualization/types.ts);
 * every one of them is listed, each still individually safety-checked.
 */
export function buildIllustrationPrompt(plan: VisualizationPlan): string {
  if (plan.changes.length === 0) return "";
  return [
    "Edit the supplied portrait of the same person.",
    "Keep the same photo and the same real-world situation: the same pose, framing, camera angle and setting.",
    "Create a clearly visible, natural-looking illustrative visualization of the approved MogaFace visual change(s) listed below.",
    "The output must look like a real, unretouched photograph — not a stylized, filtered, or generically enhanced image.",
    "Preserve the person's identity and every facial characteristic that is unrelated to the approved change(s).",
    "Do not retouch, stylize, smooth, apply generic photo enhancement, or otherwise alter any unrelated feature.",
    `Do not change any of the following unless it is explicitly part of an approved change: ${plan.preserve.join("; ")}.`,
    "Apply only the following approved visual change(s) — nothing else:",
    ...plan.changes.map((c) => `- ${c.visualInstruction} (region: ${c.targetRegion.replace(/_/g, " ")}; strength: ${c.intensityLimit}).`),
    "Each change should be clearly visible in a side-by-side comparison — not so subtle it is hard to see — while still looking natural, moderate and anatomically plausible.",
    "Do not create a dramatic transformation.",
    "Do not introduce any change beyond what is explicitly listed above.",
    "The output must remain recognizably the same person.",
  ].join("\n");
}

// ---- adapter structure for a real provider (none registered) ----

export interface RemoteImageApi {
  id: string;
  buildRequest(input: { prompt: string; sourceImage: SourceImage; apiKey: string }): { url: string; init: RequestInit };
  /** Returns a reference (URL) to the generated image. */
  parseResponse(response: Response): Promise<string>;
}

export function createRemoteImageProvider(config: { api: RemoteImageApi; apiKey: string; fetchImpl?: typeof fetch }): ImageGenerationProvider {
  return {
    id: config.api.id,
    isMock: false,
    async generateIllustration(request) {
      const { url, init } = config.api.buildRequest({ prompt: buildIllustrationPrompt(request.visualizationPlan), sourceImage: request.sourceImage, apiKey: config.apiKey });
      let response: Response;
      try {
        response = await (config.fetchImpl ?? fetch)(url, init);
      } catch {
        throw new ImageGenerationError("provider_failed", "The image provider could not be reached.");
      }
      if (!response.ok) throw new ImageGenerationError("provider_failed", `The image provider returned ${response.status}.`);
      return { imageUrl: await config.api.parseResponse(response), provider: config.api.id, createdAt: new Date().toISOString() };
    },
  };
}

/** Concrete vendor adapters would be registered here. Intentionally EMPTY: none has been built or tested. */
export const REMOTE_IMAGE_APIS: Record<string, RemoteImageApi> = {};

function unconfiguredProvider(id: string, why: string): ImageGenerationProvider {
  return {
    id,
    isMock: false,
    async generateIllustration() {
      throw new ImageGenerationError("provider_not_configured", why);
    },
  };
}

export interface ProviderEnv {
  IMAGE_GENERATION_PROVIDER?: string;
  IMAGE_GENERATION_API_KEY?: string;
  NODE_ENV?: string;
}

/**
 * Chooses a provider from the environment.
 *   IMAGE_GENERATION_PROVIDER unset → mock in development, NONE (null) in production.
 *   "mock"                          → the mock provider.
 *   "none"                          → no provider (visualization unavailable).
 *   any other name                  → a registered RemoteImageApi if its key is set; otherwise a provider that reports provider_not_configured.
 * Returns null when there is no provider, so the visualization is "unavailable".
 */
export function selectImageGenerationProvider(env: ProviderEnv): ImageGenerationProvider | null {
  const name = env.IMAGE_GENERATION_PROVIDER?.trim().toLowerCase();
  if (!name) return env.NODE_ENV === "production" ? null : createMockProvider();
  if (name === "none") return null;
  if (name === "mock") return createMockProvider();
  const api = REMOTE_IMAGE_APIS[name];
  if (!api) return unconfiguredProvider(name, `No adapter is registered for image provider "${name}".`);
  if (!env.IMAGE_GENERATION_API_KEY) return unconfiguredProvider(name, "IMAGE_GENERATION_API_KEY is not set.");
  return createRemoteImageProvider({ api, apiKey: env.IMAGE_GENERATION_API_KEY });
}

// ---- the entry point ----

export interface GenerateVisualizationInput {
  sourceImage: SourceImage | null;
  plan: VisualizationPlan;
  provider: ImageGenerationProvider | null;
  /** When given, each change must also be backed by a consumer-ready opportunity. */
  opportunities?: TreatmentOpportunity[];
  timeoutMs?: number;
  /** Passed through to the provider, which refuses to send a photo to a third party unless "granted". */
  photoConsent?: PhotoVisualizationConsent;
  /** Largest image reference accepted (default MAX_IMAGE_REFERENCE_LENGTH). A server returning inline image data raises it. */
  maxImageChars?: number;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new ImageGenerationError("timeout", "The image provider took too long.")), ms);
    promise.then(
      (v) => (clearTimeout(t), resolve(v)),
      (e) => (clearTimeout(t), reject(e)),
    );
  });
}

/**
 * Runs at most ONE generation attempt (no retries) and reports the outcome as
 * a Visualization. Never throws.
 *   unavailable — no eligible plan, no source image, or no provider configured
 *   failed      — a provider was called and failed, timed out, or returned something unusable
 *   ready       — an image reference was returned
 */
export async function generateVisualization(input: GenerateVisualizationInput): Promise<Visualization> {
  const { plan, provider, sourceImage } = input;

  const problems = validateVisualizationPlan(plan, input.opportunities);
  if (problems.length > 0) return { status: "failed", errorCode: "invalid_plan" };
  if (plan.status !== "planned" || !sourceImage) return { status: "unavailable", errorCode: "not_eligible" };
  if (!provider) return { status: "unavailable", errorCode: "provider_not_configured" };

  // The prompt is checked BEFORE any provider is called: unsafe wording never leaves this function.
  if (validateIllustrationPrompt(buildIllustrationPrompt(plan)).length > 0) return { status: "failed", errorCode: "unsafe_prompt" };

  try {
    const request: ImageGenerationRequest = { sourceImage, visualizationPlan: plan, photoConsent: input.photoConsent };
    const result: ImageGenerationResult = await withTimeout(provider.generateIllustration(request), input.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    if (typeof result?.imageUrl !== "string" || result.imageUrl.length === 0 || result.imageUrl.length > (input.maxImageChars ?? MAX_IMAGE_REFERENCE_LENGTH)) {
      return { status: "failed", provider: provider.id, errorCode: "invalid_result" };
    }
    return { status: "ready", provider: result.provider || provider.id, imageUrl: result.imageUrl, createdAt: result.createdAt, isMock: provider.isMock };
  } catch (e) {
    if (e instanceof ImageGenerationError) {
      return e.code === "provider_not_configured" || e.code === "no_consent"
        ? { status: "unavailable", provider: provider.id, errorCode: e.code }
        : { status: "failed", provider: provider.id, errorCode: e.code };
    }
    return { status: "failed", provider: provider.id, errorCode: "provider_failed" };
  }
}
