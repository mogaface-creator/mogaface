/**
 * Consent to send the person's FRONT PHOTO to an external AI image service.
 * A separate step from consent to interpretation wording (lib/interpretation/consent.ts):
 * this one sends a face image, so nothing external is called unless it is "granted".
 *
 *   pending  — not asked yet, or not answered. The default.
 *   granted  — the person agreed to generate an illustration.
 *   declined — the person refused.
 *
 * This is a product-level state only. The consent wording, retention, the
 * provider's data terms, region and any regulatory review are decisions for the
 * product owner and legal advisers (see docs/INTERPRETATION_AND_RESULTS.md);
 * nothing here claims compliance.
 */

export const PHOTO_VISUALIZATION_CONSENT_STATES = ["pending", "granted", "declined"] as const;
export type PhotoVisualizationConsent = (typeof PHOTO_VISUALIZATION_CONSENT_STATES)[number];

export const DEFAULT_PHOTO_VISUALIZATION_CONSENT: PhotoVisualizationConsent = "pending";

export const isPhotoVisualizationConsent = (v: unknown): v is PhotoVisualizationConsent => (PHOTO_VISUALIZATION_CONSENT_STATES as readonly unknown[]).includes(v);

export const allowsPhotoProcessing = (consent: unknown): boolean => consent === "granted";
