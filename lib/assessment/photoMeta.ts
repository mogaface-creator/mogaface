import type { AssessmentPhoto, AssessmentVideoMeta, PhotoSlot } from "./types.ts";

/** Metadata common to any persisted media file (never its bytes). */
export function mediaMetadataFor(file: { name: string; size: number }): AssessmentVideoMeta {
  return { fileName: file.name, sizeBytes: file.size, uploadedAt: new Date().toISOString() };
}

/** The persisted metadata for a photo slot. Shared by the upload and the camera-capture flows. */
export function photoMetadataFor(slot: PhotoSlot, file: { name: string; size: number }): AssessmentPhoto {
  return { slot, ...mediaMetadataFor(file) };
}
