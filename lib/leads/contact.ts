/**
 * How the clinic reaches the person. This is a lead, not an analysis input:
 * it is never part of the assessment, the image instruction, or the interpretation.
 */

export interface LeadContact {
  name: string;
  phone: string;
  email: string;
  location: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** A usable lead, or null when any field is missing or not a real contact value. */
export function parseLeadContact(value: unknown): LeadContact | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const name = text(raw.name, 80);
  const phoneDigits = text(raw.phone, 24).replace(/[^\d+]/g, "");
  const digits = phoneDigits.replace(/\D/g, "");
  const email = text(raw.email, 120).toLowerCase();
  const location = text(raw.location, 80);
  if (name.length < 2 || !/\p{L}/u.test(name)) return null;
  if (digits.length < 8 || digits.length > 15) return null;
  if (!EMAIL.test(email)) return null;
  if (location.length < 2) return null;
  return { name, phone: phoneDigits, email, location };
}
