/**
 * Image-generation provider abstraction. The app depends on this interface,
 * never on a vendor. Credentials come from environment variables only — no
 * key is ever stored in the repository — and a missing key means the
 * visualization is simply "unavailable"; the assessment always still works.
 */

import type { VisualizationPlan } from "../visualization/types.ts";

export interface SourceImage {
  /** URL of the FRONT photo (a blob URL in the local architecture). Image bytes are never stored in the result. */
  url: string;
  slot: "front";
}

export interface ImageGenerationRequest {
  sourceImage: SourceImage;
  visualizationPlan: VisualizationPlan;
}

export interface ImageGenerationResult {
  /** A reference to the generated image. Large image binaries must not be persisted in localStorage. */
  imageUrl: string;
  provider: string;
  createdAt: string;
}

export interface ImageGenerationProvider {
  /** Stable id, e.g. "mock". */
  id: string;
  /** True for providers that do not produce a real generated image. The UI labels these clearly. */
  isMock: boolean;
  generateIllustration(request: ImageGenerationRequest): Promise<ImageGenerationResult>;
}

export type ImageGenerationErrorCode =
  | "not_eligible"
  | "invalid_plan"
  | "provider_not_configured"
  | "provider_failed"
  | "timeout"
  | "invalid_result";

export class ImageGenerationError extends Error {
  code: ImageGenerationErrorCode;
  constructor(code: ImageGenerationErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export type VisualizationStatus = "pending" | "ready" | "unavailable" | "failed";

/** The stored outcome of an illustration attempt. Holds a reference only — never image bytes. */
export interface Visualization {
  status: VisualizationStatus;
  provider?: string;
  imageUrl?: string;
  createdAt?: string;
  errorCode?: ImageGenerationErrorCode;
  /** True when the image came from a mock provider (development). */
  isMock?: boolean;
}
