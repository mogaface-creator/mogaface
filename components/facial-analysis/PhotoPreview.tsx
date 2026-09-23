"use client";

import { Button } from "@/components/ui/Button";

interface PhotoPreviewProps {
  imageUrl: string;
  onReplace: () => void;
  onRemove: () => void;
}

export function PhotoPreview({ imageUrl, onReplace, onRemove }: PhotoPreviewProps) {
  return (
    <div>
      <div className="relative mx-auto aspect-[3/4] w-full max-w-sm overflow-hidden rounded-2xl border border-border bg-surface">
        {/* Remote/blob preview of a user's own photo — next/image optimization isn't needed here. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt="Your uploaded photo" className="h-full w-full object-cover" />
      </div>
      <div className="mt-4 flex justify-center gap-3">
        <Button variant="secondary" onClick={onReplace}>
          Replace photo
        </Button>
        <Button variant="ghost" onClick={onRemove}>
          Remove
        </Button>
      </div>
    </div>
  );
}
