/**
 * Reconciles persisted photo metadata (from storage.ts) with which actual
 * files are available in this session (freshly selected, or restored from
 * mediaStore.ts) — the single place that draws the line between "metadata
 * exists" and "uploaded". The UI must never treat those as the same thing.
 */

import { PHOTO_SLOTS, REQUIRED_PHOTO_SLOTS, type Assessment, type PhotoSlot } from "./types.ts";

export interface MissingSlot {
  slot: PhotoSlot;
  label: string;
}

/** Slots with saved metadata whose actual file isn't available this session (lost on reload, or never restored). */
export function slotsMissingActualFile(assessment: Assessment, available: ReadonlySet<PhotoSlot>): MissingSlot[] {
  const uploadedSlots = new Set(assessment.photos.map((p) => p.slot));
  return PHOTO_SLOTS.filter(({ slot }) => uploadedSlots.has(slot) && !available.has(slot));
}

/** Whether every *required* photo has an actual, usable file — not just metadata. */
export function hasRequiredPhotoFiles(available: ReadonlySet<PhotoSlot>): boolean {
  return REQUIRED_PHOTO_SLOTS.every((slot) => available.has(slot));
}

/**
 * Gate for "Start Analysis". Only required photos can block it — a profile
 * photo that didn't survive a reload is shown as unavailable (see
 * slotsMissingActualFile) but is optional, so it doesn't stop analysis.
 */
export function canStartAnalysis(available: ReadonlySet<PhotoSlot>, mediaHydrated: boolean): boolean {
  return mediaHydrated && hasRequiredPhotoFiles(available);
}
