/**
 * Hands an assessment snapshot from the assessment screen to /results. Same
 * model as resultStore.ts: sessionStorage, current tab only, cleared when the
 * tab closes.
 *
 * The front photo is stored as a stable IndexedDB media key (see
 * lib/assessment/mediaStore.ts), never as a blob: URL. A blob: URL is only
 * valid in the document that created it — persisting one here would leave a
 * dead reference the instant this page's document reloads, which mobile
 * browsers do far more readily than desktop (backgrounding, memory
 * pressure), not just on an explicit refresh. ResultsExperience resolves the
 * key back into a fresh object URL, created in ITS OWN document, every time
 * it loads (see resolveStoredFrontPhoto below).
 */

import { getMedia } from "../assessment/mediaStore.ts";
import type { FrontPhotoRef } from "../visualization/build.ts";
import { SNAPSHOT_VERSION } from "./types.ts";
import type { StoredAssessmentSnapshot, StoredFrontPhotoRef } from "./types.ts";

const KEY = "mogaface:result-snapshot";

function isValidStoredFrontPhoto(value: unknown): value is StoredFrontPhotoRef | null {
  if (value === null || value === undefined) return true;
  return typeof value === "object" && (value as { mediaKey?: unknown }).mediaKey === "front";
}

export function saveSnapshot(snapshot: StoredAssessmentSnapshot): boolean {
  if (typeof window === "undefined") return false;
  if (!isValidStoredFrontPhoto(snapshot.frontPhoto)) return false;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(snapshot));
    return true;
  } catch {
    return false; // quota or storage disabled
  }
}

export function loadSnapshot(): StoredAssessmentSnapshot | null {
  if (typeof window === "undefined") return null;
  let raw: string | null;
  try {
    raw = window.sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<StoredAssessmentSnapshot> | null;
    if (!parsed || parsed.version !== SNAPSHOT_VERSION || !parsed.assessment || !parsed.analysis || !Array.isArray(parsed.opportunities)) return null;
    if (!isValidStoredFrontPhoto(parsed.frontPhoto ?? null)) return null;
    return parsed as StoredAssessmentSnapshot;
  } catch {
    return null;
  }
}

export function clearSnapshot(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}

/**
 * Resolves a stored front-photo reference into something the report can
 * actually display: looks up the real bytes in IndexedDB and creates a FRESH
 * object URL, good for this document only. Never throws, and never returns a
 * broken reference — missing, corrupted, or unreadable media (private
 * browsing, quota, a device that never got a chance to persist it) degrades
 * to `null`, the same "no photo" state the report already renders correctly.
 */
export async function resolveStoredFrontPhoto(stored: StoredFrontPhotoRef | null): Promise<FrontPhotoRef | null> {
  if (!stored) return null;
  const blob = await getMedia(stored.mediaKey);
  if (!blob) return null;
  return { ref: URL.createObjectURL(blob), qualityValid: stored.qualityValid };
}
