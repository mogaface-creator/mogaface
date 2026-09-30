/**
 * Browser-side calls for the temporary, production-accessible illustration
 * preview (see livePreviewHandler.ts). Mirrors devClient.ts's
 * requestDevIllustrationTest exactly — same consent gate, same one-shot
 * behavior, same "no image bytes in browser storage" rule — but posts to
 * /api/illustration-preview and attaches the tester's access code as a
 * request header (never a form field, never written to any browser storage).
 */

import { allowsPhotoProcessing } from "../visualization/consent.ts";
import type { PhotoVisualizationConsent } from "../visualization/consent.ts";
import { PREVIEW_SECRET_HEADER } from "./livePreviewConstants.ts";

export type LivePreviewVerifyOutcome = "ok" | "unauthorized" | "disabled" | "failed";
export type LivePreviewGenerateOutcome = { status: "ready"; afterUrl: string } | { status: "consent_required" | "unauthorized" | "disabled" | "failed" };

export interface RequestLivePreviewGenerateInput {
  code: string;
  /** The person's own front photo (a blob/object URL). */
  photoUrl: string;
  photoQualityValid: boolean;
  consent: PhotoVisualizationConsent;
  fetchImpl?: typeof fetch;
  createObjectUrl?: (blob: Blob) => string;
}

const CLIENT_TIMEOUT_MS = 65_000;

export async function verifyLivePreviewCode(code: string, fetchImpl: typeof fetch = fetch): Promise<LivePreviewVerifyOutcome> {
  try {
    const response = await fetchImpl("/api/illustration-preview", { method: "GET", headers: { [PREVIEW_SECRET_HEADER]: code } });
    if (response.status === 404) return "disabled";
    if (response.status === 401) return "unauthorized";
    return response.ok ? "ok" : "failed";
  } catch {
    return "failed";
  }
}

export async function requestLivePreviewGenerate(input: RequestLivePreviewGenerateInput): Promise<LivePreviewGenerateOutcome> {
  if (!allowsPhotoProcessing(input.consent)) return { status: "consent_required" }; // nothing is fetched, read or sent
  const fetchImpl = input.fetchImpl ?? fetch;
  try {
    const photo = await (await fetchImpl(input.photoUrl)).blob();
    const form = new FormData();
    form.append("photo", photo, "front");
    form.append("payload", JSON.stringify({ photoVisualizationConsent: input.consent, photoQualityValid: input.photoQualityValid }));
    const response = await fetchImpl("/api/illustration-preview", {
      method: "POST",
      headers: { [PREVIEW_SECRET_HEADER]: input.code },
      body: form,
      signal: AbortSignal.timeout(CLIENT_TIMEOUT_MS),
    });
    if (response.status === 404) return { status: "disabled" };
    if (response.status === 401) return { status: "unauthorized" };
    if (!response.ok) return { status: "failed" };
    const body = (await response.json()) as { status?: string; image?: { mimeType?: string; base64?: string } };
    if (body.status !== "ready" || !body.image?.base64 || !/^image\/(png|jpeg|webp)$/.test(body.image.mimeType ?? "")) return { status: "failed" };
    const bytes = Uint8Array.from(atob(body.image.base64), (c) => c.charCodeAt(0));
    return { status: "ready", afterUrl: (input.createObjectUrl ?? URL.createObjectURL)(new Blob([bytes], { type: body.image.mimeType })) };
  } catch {
    return { status: "failed" };
  }
}
