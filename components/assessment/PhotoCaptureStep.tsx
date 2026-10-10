"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { photoMetadataFor } from "@/lib/assessment/photoMeta.ts";
import { putMedia, deleteMedia } from "@/lib/assessment/mediaStore.ts";
import { PHOTO_SLOTS, type AssessmentPhoto, type PhotoSlot } from "@/lib/assessment/types.ts";
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
  mediaHydrated,
  onSessionFilesChange,
  onPhotosChange,
  onVideoFileChange,
  onNext,
  onBack,
}: {
  photos: AssessmentPhoto[];
  sessionFiles: SessionFiles;
  mediaHydrated: boolean;
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
    void putMedia(slot, file);
  };

  const handleRetakeAll = () => {
    Object.values(sessionFiles).forEach((f) => f && URL.revokeObjectURL(f.previewUrl));
    onSessionFilesChange({});
    onPhotosChange([]);
    PHOTO_SLOTS.forEach(({ slot }) => void deleteMedia(slot));
    setMode("camera");
  };

  const clearBar = photos.length > 0 ? (
    <div className="mb-4 flex items-center justify-between rounded-xl border border-border bg-surface px-4 py-2.5 text-xs">
      <span className="text-muted">{photos.length} photo(s) on file</span>
      <button
        type="button"
        onClick={handleRetakeAll}
        className="font-medium text-accent underline underline-offset-2 hover:opacity-85"
      >
        Retake / Replace all photos with camera
      </button>
    </div>
  ) : null;

  if (mode === "upload") {
    return (
      <div>
        {clearBar}
        <div className="mb-6 flex justify-end">
          <Button type="button" variant="secondary" onClick={() => setMode("camera")}>
            Use camera
          </Button>
        </div>
        <PhotoCollection
          photos={photos}
          sessionFiles={sessionFiles}
          mediaHydrated={mediaHydrated}
          onSessionFilesChange={onSessionFilesChange}
          onPhotosChange={onPhotosChange}
          onNext={onNext}
          onBack={onBack}
        />
      </div>
    );
  }

  return (
    <div>
      {clearBar}
      <GuidedCameraCapture
        existingSlots={Object.keys(sessionFiles) as PhotoSlot[]}
        onAcceptPhoto={acceptCapturedPhoto}
        onVideo={onVideoFileChange}
        onUseUpload={() => setMode("upload")}
        onBack={onBack}
        onFinished={onNext}
      />
    </div>
  );
}
