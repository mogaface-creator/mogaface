import type { GuidanceState } from "@/lib/camera-capture/types.ts";

type Tone = "neutral" | "adjust" | "good";

const TONE_BY_STATE: Record<GuidanceState, Tone> = {
  NO_FACE: "neutral",
  MULTIPLE_FACES: "adjust",
  TOO_FAR: "adjust",
  TOO_CLOSE: "adjust",
  MOVE_LEFT: "adjust",
  MOVE_RIGHT: "adjust",
  MOVE_UP: "adjust",
  MOVE_DOWN: "adjust",
  TURN_LEFT: "adjust",
  TURN_RIGHT: "adjust",
  HEAD_TOO_TILTED: "adjust",
  LIGHT_TOO_DARK: "adjust",
  LIGHT_TOO_BRIGHT: "adjust",
  HOLD_STILL: "good",
  GOOD_TO_CAPTURE: "good",
  PROCESSING: "good",
  CAPTURED: "good",
};

const STROKE: Record<Tone, string> = { neutral: "rgba(255,255,255,0.75)", adjust: "rgb(251,191,36)", good: "rgb(110,231,183)" };

/**
 * A clean oval to place the face in. It shows no numbers: its colour says
 * whether to adjust (amber) or hold (green), and a ring fills while the
 * person holds still.
 */
export function FaceGuideOverlay({ state, progress }: { state: GuidanceState; progress: number }) {
  const tone = TONE_BY_STATE[state];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
      <svg viewBox="0 0 100 130" className="h-[82%]" data-guide-tone={tone}>
        <ellipse cx="50" cy="65" rx="40" ry="55" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.2" />
        <ellipse cx="50" cy="65" rx="40" ry="55" fill="none" stroke={STROKE[tone]} strokeWidth="2.4" strokeLinecap="round" pathLength={100} strokeDasharray={tone === "good" && progress > 0 ? `${Math.max(2, progress * 100)} 100` : "100 0"} transform="rotate(-90 50 65)" style={{ transition: "stroke 200ms" }} />
      </svg>
    </div>
  );
}
