/**
 * Mock image provider — lets the whole result experience be exercised with no
 * API key and no network. It does NOT generate an image: by default it hands
 * back the source image unchanged, and the UI labels it "Mock". It exists to
 * test UI and pipeline behavior only, and says nothing about any real
 * analysis or outcome.
 */

import type { ImageGenerationProvider, ImageGenerationRequest } from "./types.ts";
import { ImageGenerationError } from "./types.ts";

export interface MockProviderOptions {
  /** Simulated latency so loading states can be seen. Default 700 ms. */
  latencyMs?: number;
  /** "success" (default), or "fail" to exercise the error path. */
  behavior?: "success" | "fail";
  /** Produces the "after" image URL from the request; defaults to the source URL. Used by the dev demo to show a distinct placeholder. */
  render?: (request: ImageGenerationRequest) => string;
}

export function createMockProvider(options: MockProviderOptions = {}): ImageGenerationProvider {
  const { latencyMs = 700, behavior = "success", render } = options;
  return {
    id: "mock",
    isMock: true,
    async generateIllustration(request) {
      if (latencyMs > 0) await new Promise((r) => setTimeout(r, latencyMs));
      if (behavior === "fail") throw new ImageGenerationError("provider_failed", "Mock provider was told to fail.");
      return {
        imageUrl: render ? render(request) : request.sourceImage.url,
        provider: "mock",
        createdAt: new Date().toISOString(),
      };
    },
  };
}
