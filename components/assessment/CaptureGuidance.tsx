import { PHOTO_STEPS } from "@/lib/camera-capture/types.ts";
import type { PhotoSlot } from "@/lib/facial-analysis/multiPhoto/types.ts";

/** The standing instruction for each view (what to do), separate from the live cue (how to adjust). */
export const STEP_COPY: Record<PhotoSlot, { title: string; hint: string }> = {
  front: { title: "Look straight at the camera", hint: "Keep your face relaxed." },
  leftFortyFive: { title: "Show the left side of your face", hint: "Turn your head slightly to your right." },
  rightFortyFive: { title: "Show the right side of your face", hint: "Turn your head slightly to your left." },
  leftProfile: { title: "Turn to show your left profile", hint: "Turn fully to your right, then tap Capture." },
  rightProfile: { title: "Turn to show your right profile", hint: "Turn fully to your left, then tap Capture." },
};

export function StepDots({ current, accepted, steps }: { current: PhotoSlot | null; accepted: readonly PhotoSlot[]; steps: readonly PhotoSlot[] }) {
  return (
    <ol aria-label="Photo steps" className="flex flex-wrap items-center justify-center gap-2 text-xs">
      {steps.map((slot) => {
        const done = accepted.includes(slot);
        const active = slot === current;
        return (
          <li key={slot} aria-current={active ? "step" : undefined} className={`rounded-full border px-3 py-1 ${active ? "border-accent bg-accent text-accent-foreground" : done ? "border-accent text-accent" : "border-border text-muted"}`}>
            {done ? "✓ " : ""}
            {PHOTO_STEPS.find((s) => s.slot === slot)?.label}
          </li>
        );
      })}
    </ol>
  );
}

/** The live cue, announced politely to screen readers and shown large enough to read at arm's length. */
export function LiveCue({ message, good }: { message: string; good: boolean }) {
  return (
    <p role="status" aria-live="polite" data-testid="live-cue" className={`mt-5 text-center text-xl font-medium tracking-tight sm:text-2xl ${good ? "text-accent" : ""}`}>
      {message}
    </p>
  );
}
