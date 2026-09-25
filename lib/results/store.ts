/**
 * Hands an assessment snapshot from the assessment screen to /results. Same
 * model as resultStore.ts: sessionStorage, current tab only, cleared when the
 * tab closes. It refuses to store anything image-sized — the front photo is a
 * short blob URL, never bytes.
 */

import { SNAPSHOT_VERSION } from "./types.ts";
import type { AssessmentSnapshot } from "./types.ts";

const KEY = "mogaface:result-snapshot";
/** A photo reference longer than this is treated as embedded image data and refused. */
const MAX_PHOTO_REF_LENGTH = 2048;

export function saveSnapshot(snapshot: AssessmentSnapshot): boolean {
  if (typeof window === "undefined") return false;
  if (snapshot.frontPhoto && snapshot.frontPhoto.ref.length > MAX_PHOTO_REF_LENGTH) return false;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(snapshot));
    return true;
  } catch {
    return false; // quota or storage disabled
  }
}

export function loadSnapshot(): AssessmentSnapshot | null {
  if (typeof window === "undefined") return null;
  let raw: string | null;
  try {
    raw = window.sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AssessmentSnapshot> | null;
    if (!parsed || parsed.version !== SNAPSHOT_VERSION || !parsed.assessment || !parsed.analysis || !Array.isArray(parsed.opportunities)) return null;
    return parsed as AssessmentSnapshot;
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
