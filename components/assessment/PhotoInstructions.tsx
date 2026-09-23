import { StepNav } from "./StepNav";
import { PHOTO_SLOTS } from "@/lib/assessment/types.ts";

const GUIDELINES = [
  "Camera at eye level",
  "Face centered in the frame",
  "Neutral expression",
  "Good, even lighting",
  "No sunglasses",
  "No heavy obstruction (hats, masks, hands)",
  "No extreme head tilt",
  "Consistent distance across all five photos",
  "Hair away from important facial areas where possible",
];

export function PhotoInstructions({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  return (
    <div>
      <h2 className="font-serif text-2xl tracking-tight">Before you take your photos</h2>
      <p className="mt-2 text-sm text-muted">
        Accurate analysis requires a standardized set of photos. Consistent photos make measurements more
        comparable — this system does not reconstruct a perfect 3D model from them.
      </p>

      <div className="mt-8 rounded-2xl border border-border bg-surface p-6">
        <h3 className="text-sm font-medium uppercase tracking-wide text-muted">You&apos;ll need five photos</h3>
        <ol className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          {PHOTO_SLOTS.map((p, i) => (
            <li key={p.slot}>
              {String(i + 1).padStart(2, "0")} — {p.label}
            </li>
          ))}
        </ol>
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-surface p-6">
        <h3 className="text-sm font-medium uppercase tracking-wide text-muted">For every photo</h3>
        <ul className="mt-4 list-disc space-y-1.5 pl-5 text-sm text-foreground">
          {GUIDELINES.map((g) => (
            <li key={g}>{g}</li>
          ))}
        </ul>
      </div>

      <StepNav onBack={onBack} onNext={onNext} nextLabel="I'm ready" />
    </div>
  );
}
