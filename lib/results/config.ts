/**
 * Where the consultation button goes. Configurable via public (non-secret)
 * environment variables:
 *   NEXT_PUBLIC_CONSULTATION_URL         — https://, mailto:, tel:, or a site-relative path. Default "/".
 *   NEXT_PUBLIC_CONSULTATION_CTA_LABEL   — button text. Default "Discuss My Results".
 * Anything else (e.g. a javascript: URL) falls back to "/".
 */

export interface ConsultationCta {
  label: string;
  href: string;
}

const SAFE_HREF = /^(https:\/\/|mailto:|tel:|\/(?!\/))/i;

export function resolveConsultationCta(env: { url?: string; label?: string } = {}): ConsultationCta {
  const label = env.label?.trim() || "Discuss My Results";
  const url = env.url?.trim();
  return { label, href: url && SAFE_HREF.test(url) ? url : "/" };
}

/** Reads the public env vars. Written out literally so Next can inline them into the client bundle. */
export function getConsultationCta(): ConsultationCta {
  return resolveConsultationCta({ url: process.env.NEXT_PUBLIC_CONSULTATION_URL, label: process.env.NEXT_PUBLIC_CONSULTATION_CTA_LABEL });
}
