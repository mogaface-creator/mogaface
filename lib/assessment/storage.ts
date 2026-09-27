/**
 * localStorage persistence for the in-progress assessment.
 *
 * Only the Assessment record itself is stored — that's questionnaire
 * answers plus lightweight photo/video *metadata* (slot, filename, size,
 * timestamp), never the media bytes: base64-encoding full-resolution photos
 * into localStorage would risk the ~5-10MB per-origin quota. The actual File
 * objects are cached in IndexedDB instead (see mediaStore.ts) and
 * reconstructed from that cache using this metadata — see
 * mediaAvailability.ts for how the UI tells "restored" apart from "gone".
 */

import { sanitizeAssessment } from "./schema.ts";
import type { Assessment } from "./types.ts";

const KEY = "mogaface:assessment";

export function saveAssessment(assessment: Assessment): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(assessment));
  } catch {
    // Quota exceeded or storage disabled (e.g. private browsing) — the
    // assessment still works for the rest of this session, it just won't
    // survive a reload. Nothing to recover from here.
  }
}

export function loadAssessment(): Assessment | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  return sanitizeAssessment(parsed);
}

export function clearAssessment(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}
