import type { AssessmentPhoto, PhotoSlot } from "./types.ts";

/** The persisted metadata for a photo (never its bytes). Shared by the upload and the camera-capture flows. */
export function photoMetadataFor(slot: PhotoSlot, file: { name: string; size: number }): AssessmentPhoto {
  return { slot, fileName: file.name, sizeBytes: file.size, uploadedAt: new Date().toISOString() };
}
