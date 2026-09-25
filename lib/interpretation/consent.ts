/**
 * Consent to send derived assessment wording to a THIRD-PARTY interpretation
 * provider (an AI vendor). This is a separate processing step from the
 * person having answered the assessment, so it needs its own state.
 *
 *   not_required — no third party is involved (the local deterministic provider), or the product
 *                  owner has decided consent is unnecessary. Does NOT by itself allow a third party.
 *   pending      — not asked yet, or not answered. The default.
 *   granted      — the person agreed.
 *   declined     — the person refused.
 *
 * Only "granted" allows third-party processing. There is no consent screen yet,
 * so every real result is "pending" and never leaves the local provider. What
 * the consent text says, whether "not_required" can ever allow a third party,
 * and how a decision is stored are product-owner / legal decisions (see
 * docs/INTERPRETATION_AND_RESULTS.md); nothing here claims compliance.
 */

export const INTERPRETATION_CONSENT_STATES = ["not_required", "pending", "granted", "declined"] as const;
export type InterpretationConsent = (typeof INTERPRETATION_CONSENT_STATES)[number];

export const DEFAULT_INTERPRETATION_CONSENT: InterpretationConsent = "pending";

export const isInterpretationConsent = (v: unknown): v is InterpretationConsent => (INTERPRETATION_CONSENT_STATES as readonly unknown[]).includes(v);

export const allowsThirdPartyInterpretation = (consent: unknown): boolean => consent === "granted";
