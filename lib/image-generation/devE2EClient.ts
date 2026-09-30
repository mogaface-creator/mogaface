/**
 * Browser-side call for the developer/clinic-only END-TO-END illustration
 * test (see devE2EHandler.ts). Mirrors client.ts's requestIllustration
 * exactly — same consent gate, same "no image bytes in browser storage"
 * rule — but posts the REAL opportunities from the real assessment/analysis
 * pipeline to /api/dev-e2e-illustration, which the server refuses outright
 * with a 404 unless it is a development server with the explicit test flag
 * set.
 */

import { allowsPhotoProcessing } from "../visualization/consent.ts";
import type { PhotoVisualizationConsent } from "../visualization/consent.ts";
import type { TreatmentOpportunity } from "../treatment-opportunities/types.ts";

export type DevE2EIllustrationOutcome = { status: "ready"; afterUrl: string } | { status: "consent_required" | "not_eligible" | "unavailable" | "failed" };

export interface RequestDevE2EIllustrationInput {
  /** The person's own front photo (a blob URL), exactly as the real panel uses it. */
  photoUrl: string;
  photoQualityValid: boolean;
  /** The REAL opportunities from evaluateTreatmentOpportunities for this assessment — never a fixture. */
  opportunities: TreatmentOpportunity[];
  consent: PhotoVisualizationConsent;
  fetchImpl?: typeof fetch;
  createObjectUrl?: (blob: Blob) => string;
}

const CLIENT_TIMEOUT_MS = 65_000;

/** Only the fields the server re-derives its plan from — mirrors client.ts's own `minimal()`. */
const minimal = (o: TreatmentOpportunity) => ({ id: o.id, category: o.category, status: o.status, consumerReady: o.consumerReady, evidenceObservationIds: o.evidenceObservationIds, evidenceQuestionIds: o.evidenceQuestionIds });

export async function requestDevE2EIllustration(input: RequestDevE2EIllustrationInput): Promise<DevE2EIllustrationOutcome> {
  if (!allowsPhotoProcessing(input.consent)) return { status: "consent_required" }; // nothing is fetched, read or sent
  const fetchImpl = input.fetchImpl ?? fetch;
  try {
    const photo = await (await fetchImpl(input.photoUrl)).blob();
    const form = new FormData();
    form.append("photo", photo, "front");
    form.append("payload", JSON.stringify({ photoVisualizationConsent: input.consent, photoQualityValid: input.photoQualityValid, opportunities: input.opportunities.map(minimal) }));
    const response = await fetchImpl("/api/dev-e2e-illustration", { method: "POST", body: form, signal: AbortSignal.timeout(CLIENT_TIMEOUT_MS) });
    if (response.status === 404) return { status: "unavailable" };
    if (!response.ok) return { status: "failed" };
    const body = (await response.json()) as { status?: string; image?: { mimeType?: string; base64?: string } };
    if (body.status === "not_eligible") return { status: "not_eligible" };
    if (body.status !== "ready" || !body.image?.base64 || !/^image\/(png|jpeg|webp)$/.test(body.image.mimeType ?? "")) return { status: "failed" };
    const bytes = Uint8Array.from(atob(body.image.base64), (c) => c.charCodeAt(0));
    return { status: "ready", afterUrl: (input.createObjectUrl ?? URL.createObjectURL)(new Blob([bytes], { type: body.image.mimeType })) };
  } catch {
    return { status: "failed" };
  }
}
