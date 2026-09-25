"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { photoMetadataFor } from "@/lib/assessment/photoMeta.ts";
import type { AssessmentPhoto, PhotoSlot } from "@/lib/assessment/types.ts";
import { GuidedCameraCapture } from "./GuidedCameraCapture";
import { PhotoCollection, type SessionFiles } from "./PhotoCollection";

/**
 * The photo step of the assessment. The guided camera is the primary path;
 * uploading photos remains available as a fallback (camera unavailable or
 * denied, desktop preference, or simply choosing to). Both paths fill the SAME
 * photo slots and metadata — there is no parallel data model.
 */
export function PhotoCaptureStep({
  photos,
  sessionFiles,
  onSessionFilesChange,
  onPhotosChange,
  onVideoFileChange,
  onNext,
  onBack,
}: {
  photos: AssessmentPhoto[];
  sessionFiles: SessionFiles;
  onSessionFilesChange: (next: SessionFiles) => void;
  onPhotosChange: (next: AssessmentPhoto[]) => void;
  onVideoFileChange: (file: File | null) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [mode, setMode] = useState<"camera" | "upload">("camera");

  const acceptCapturedPhoto = (slot: PhotoSlot, file: File) => {
    const previous = sessionFiles[slot];
    if (previous?.previewUrl) URL.revokeObjectURL(previous.previewUrl);
    onSessionFilesChange({ ...sessionFiles, [slot]: { file, previewUrl: URL.createObjectURL(file) } });
    onPhotosChange([...photos.filter((p) => p.slot !== slot), photoMetadataFor(slot, file)]);
  };

  if (mode === "upload") {
    return (
      <div>
        <div className="mb-6 flex justify-end">
          <Button type="button" variant="secondary" onClick={() => setMode("camera")}>
            Use camera
          </Button>
        </div>
        <PhotoCollection photos={photos} sessionFiles={sessionFiles} onSessionFilesChange={onSessionFilesChange} onPhotosChange={onPhotosChange} onNext={onNext} onBack={onBack} />
      </div>
    );
  }

  return (
    <GuidedCameraCapture
      existingSlots={Object.keys(sessionFiles) as PhotoSlot[]}
      onAcceptPhoto={acceptCapturedPhoto}
      onVideo={onVideoFileChange}
      onUseUpload={() => setMode("upload")}
      onBack={onBack}
      onFinished={onNext}
    />
  );
}
