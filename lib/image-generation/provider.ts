/**
 * Orchestration around an ImageGenerationProvider: prompt construction,
 * provider selection from the environment, and the single entry point the app
 * uses (`generateVisualization`). That function NEVER throws and NEVER
 * retries: a failed illustration comes back as a status, so it can never fail
 * the assessment.
 *
 * Real providers: NONE is connected. `RemoteImageApi` + `createRemoteImageProvider`
 * are the adapter structure a future integration fills in. A real provider must
 * run server-side (its key must never reach the browser) and must not receive a
 * user's photo without an explicit consent flow — neither exists yet, which is
 * why no concrete adapter is registered.
 */

import type { VisualizationPlan } from "../visualization/types.ts";
import { validateVisualizationPlan } from "../visualization/validate.ts";
import type { TreatmentOpportunity } from "../treatment-opportunities/types.ts";
import { createMockProvider } from "./mockProvider.ts";
import { ImageGenerationError } from "./types.ts";
import type { ImageGenerationProvider, ImageGenerationRequest, ImageGenerationResult, SourceImage, Visualization } from "./types.ts";

/** Generated references larger than this (e.g. an inline data URL) are refused: no large binaries in local storage. */
export const MAX_IMAGE_REFERENCE_LENGTH = 2_000_000;
export const DEFAULT_TIMEOUT_MS = 30_000;

/** The instruction an image model would receive: only approved changes, everything else preserved. */
export function buildIllustrationPrompt(plan: VisualizationPlan): string {
  const changes = plan.changes.map((c, i) => `${i + 1}. ${c.description} (intensity: ${c.intensity}).`);
  return [
    "Edit the supplied front-facing portrait to create a subtle, realistic ILLUSTRATION.",
    "Apply ONLY these approved changes:",
    ...changes,
    "",
    `Preserve exactly: ${plan.preserve.join("; ")}.`,
    "Do not make any other change. Do not alter the person's identity or make them look like a different person.",
    "Keep every change subtle and plausible. No dramatic transformation, no celebrity-like result, no beautification beyond the approved changes.",
    "",
    `The image will be shown labelled "${plan.disclaimer.label}. ${plan.disclaimer.notice}"`,
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

  try {
    const request: ImageGenerationRequest = { sourceImage, visualizationPlan: plan };
    const result: ImageGenerationResult = await withTimeout(provider.generateIllustration(request), input.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    if (typeof result?.imageUrl !== "string" || result.imageUrl.length === 0 || result.imageUrl.length > MAX_IMAGE_REFERENCE_LENGTH) {
      return { status: "failed", provider: provider.id, errorCode: "invalid_result" };
    }
    return { status: "ready", provider: result.provider || provider.id, imageUrl: result.imageUrl, createdAt: result.createdAt, isMock: provider.isMock };
  } catch (e) {
    if (e instanceof ImageGenerationError) {
      return e.code === "provider_not_configured"
        ? { status: "unavailable", provider: provider.id, errorCode: e.code }
        : { status: "failed", provider: provider.id, errorCode: e.code };
    }
    return { status: "failed", provider: provider.id, errorCode: "provider_failed" };
  }
}
