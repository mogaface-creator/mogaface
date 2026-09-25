"use client";

import { Button } from "@/components/ui/Button";
import type { CaptureFeedback } from "@/lib/camera-capture/feedback.ts";

/**
 * Review of a just-captured photo. Shows plain feedback only — never a
 * number. A photo the existing quality gate rejected cannot be used; the
 * person is asked to retake it, with one simple reason.
 */
export function CaptureReview({
  label,
  previewUrl,
  feedback,
  onUse,
  onRetake,
}: {
  label: string;
  previewUrl: string;
  /** Null while the existing analysis is still checking the photo. */
  feedback: CaptureFeedback | null;
  onUse: () => void;
  onRetake: () => void;
}) {
  return (
    <div data-testid="capture-review" className="mx-auto max-w-md">
      <h3 className="text-center font-serif text-2xl tracking-tight">{label} photo</h3>
      <div className="mt-5 overflow-hidden rounded-3xl border border-border bg-surface">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={previewUrl} alt={`${label} photo you just took`} className="max-h-[60vh] w-full object-contain" />
      </div>

      <div className="mt-5 min-h-[4.5rem] text-center" aria-live="polite">
        {feedback === null && <p className="text-sm text-muted">Checking your photo…</p>}
        {feedback?.ok && (
          <ul className="space-y-1 text-sm">
            {feedback.positives.map((p) => (
              <li key={p} className="text-accent">
                ✓ {p}
              </li>
            ))}
          </ul>
        )}
        {feedback && !feedback.ok && (
          <div role="alert">
            <p className="font-medium">Let&apos;s retake that photo</p>
            <ul className="mt-1 space-y-1 text-sm text-muted">
              {feedback.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-center gap-3">
        <Button type="button" variant="secondary" onClick={onRetake}>
          Retake
        </Button>
        <Button type="button" onClick={onUse} disabled={!feedback?.ok}>
          Use photo
        </Button>
      </div>
    </div>
  );
}
