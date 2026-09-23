"use client";

import { useRef, useState } from "react";
import { StepNav } from "./StepNav";
import { Button } from "@/components/ui/Button";
import { PHOTO_SLOTS, type AssessmentPhoto, type PhotoSlot } from "@/lib/assessment/types.ts";

const ACCEPTED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;

export type SessionFile = { file: File; previewUrl: string };
export type SessionFiles = Partial<Record<PhotoSlot, SessionFile>>;

function validateFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) return "Unsupported file type. Use JPG, PNG, or WebP.";
  if (file.size > MAX_FILE_SIZE_BYTES) return "File is too large (max 15MB).";
  return null;
}

interface PhotoCollectionProps {
  photos: AssessmentPhoto[];
  sessionFiles: SessionFiles;
  onSessionFilesChange: (next: SessionFiles) => void;
  onPhotosChange: (next: AssessmentPhoto[]) => void;
  onNext: () => void;
  onBack: () => void;
}

export function PhotoCollection({
  photos,
  sessionFiles,
  onSessionFilesChange,
  onPhotosChange,
  onNext,
  onBack,
}: PhotoCollectionProps) {
  const uploadedCount = photos.length;
  const [errors, setErrors] = useState<Partial<Record<PhotoSlot, string>>>({});

  const setSlot = (slot: PhotoSlot, file: File) => {
    const error = validateFile(file);
    if (error) {
      setErrors((prev) => ({ ...prev, [slot]: error }));
      return;
    }
    setErrors((prev) => ({ ...prev, [slot]: undefined }));

    const previous = sessionFiles[slot];
    if (previous?.previewUrl) URL.revokeObjectURL(previous.previewUrl);
    const previewUrl = URL.createObjectURL(file);
    onSessionFilesChange({ ...sessionFiles, [slot]: { file, previewUrl } });

    const entry: AssessmentPhoto = {
      slot,
      fileName: file.name,
      sizeBytes: file.size,
      uploadedAt: new Date().toISOString(),
    };
    onPhotosChange([...photos.filter((p) => p.slot !== slot), entry]);
  };

  const removeSlot = (slot: PhotoSlot) => {
    const previous = sessionFiles[slot];
    if (previous?.previewUrl) URL.revokeObjectURL(previous.previewUrl);
    const nextSessionFiles = { ...sessionFiles };
    delete nextSessionFiles[slot];
    onSessionFilesChange(nextSessionFiles);
    onPhotosChange(photos.filter((p) => p.slot !== slot));
    setErrors((prev) => ({ ...prev, [slot]: undefined }));
  };

  return (
    <div>
      <h2 className="font-serif text-2xl tracking-tight">Upload your photos</h2>
      <p className="mt-2 text-sm text-muted">
        {uploadedCount} / {PHOTO_SLOTS.length} uploaded
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {PHOTO_SLOTS.map(({ slot, label }) => (
          <PhotoSlotCard
            key={slot}
            label={label}
            hasStoredMetadata={photos.some((p) => p.slot === slot)}
            session={sessionFiles[slot]}
            error={errors[slot]}
            onSelect={(file) => setSlot(slot, file)}
            onRemove={() => removeSlot(slot)}
          />
        ))}
      </div>

      <StepNav onBack={onBack} onNext={onNext} />
    </div>
  );
}

interface PhotoSlotCardProps {
  label: string;
  hasStoredMetadata: boolean;
  session?: SessionFile;
  error?: string;
  onSelect: (file: File) => void;
  onRemove: () => void;
}

function PhotoSlotCard({ label, hasStoredMetadata, session, error, onSelect, onRemove }: PhotoSlotCardProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        {session?.previewUrl ? (
          <span className="text-xs text-accent">Uploaded</span>
        ) : hasStoredMetadata ? (
          <span className="text-xs text-muted">Previously uploaded</span>
        ) : (
          <span className="text-xs text-muted">Not uploaded</span>
        )}
      </div>

      <div
        role="button"
        tabIndex={0}
        aria-label={`Upload ${label} photo`}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) onSelect(file);
        }}
        className={`mt-3 flex aspect-[3/4] cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed ${
          dragOver ? "border-accent" : "border-border"
        }`}
      >
        {session?.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={session.previewUrl} alt={`${label} preview`} className="h-full w-full object-cover" />
        ) : hasStoredMetadata ? (
          <p className="px-4 text-center text-xs text-muted">
            Uploaded earlier — preview isn&apos;t kept after a reload. Tap to replace.
          </p>
        ) : (
          <p className="px-4 text-center text-xs text-muted">Tap or drag a photo here</p>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onSelect(file);
          }}
        />
      </div>

      {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}

      {(session?.previewUrl || hasStoredMetadata) && (
        <div className="mt-3 flex justify-center">
          <Button type="button" variant="ghost" onClick={onRemove}>
            Remove
          </Button>
        </div>
      )}
    </div>
  );
}
