/**
 * Turns the EXISTING analysis record of a just-captured photo into simple,
 * friendly feedback. No numbers, no jargon, no new scoring: the decision is
 * the existing quality gate (record.status === "complete"), and the words
 * are a translation of the existing warnings.
 */

import type { PhotoAnalysisRecord } from "../facial-analysis/multiPhoto/types.ts";

export interface CaptureFeedback {
  /** True only if the existing analysis accepted the photo. */
  ok: boolean;
  /** Shown on a good photo: "Good lighting", "Face centered", "Head position good". */
  positives: string[];
  /** Shown when the photo should be retaken: one simple reason each. */
  reasons: string[];
}

interface Rule {
  test: RegExp;
  reason: string;
  /** Which positive this problem cancels. */
  affects: "light" | "framing" | "head" | "other";
}

const RULES: Rule[] = [
  { test: /No face detected/i, reason: "We couldn't see your face clearly.", affects: "framing" },
  { test: /Multiple faces/i, reason: "More than one face was in the photo.", affects: "framing" },
  { test: /too dark/i, reason: "The photo was too dark — find a brighter spot.", affects: "light" },
  { test: /overexposed/i, reason: "The photo was too bright — try softer light.", affects: "light" },
  { test: /too small|small in the frame/i, reason: "Your face was too small in the photo — move closer.", affects: "framing" },
  { test: /cut off/i, reason: "Part of your face was cut off — keep it fully in view.", affects: "framing" },
  { test: /tilted/i, reason: "Your head was tilted — keep it level.", affects: "head" },
  { test: /turned to the side/i, reason: "Your head was turned — look straight at the camera.", affects: "head" },
  { test: /resolution/i, reason: "The photo resolution was too low.", affects: "other" },
  { test: /near eye|side-on|both eyes|eyes should/i, reason: "That angle didn't look right — try the pose again.", affects: "head" },
];

export const FALLBACK_REASON = "That photo wasn't usable — please try again.";

export function describeCaptureRecord(record: PhotoAnalysisRecord): CaptureFeedback {
  const messages = [...record.errors, ...record.warnings, ...(record.viewValidation?.warnings ?? []), ...(record.quality?.errors ?? []), ...(record.quality?.warnings ?? [])];
  const hits = new Set<Rule>();
  for (const m of messages) for (const rule of RULES) if (rule.test.test(m)) hits.add(rule);

  const ok = record.status === "complete" && record.quality?.valid === true;
  const affected = new Set([...hits].map((r) => r.affects));

  if (ok) {
    return {
      ok: true,
      positives: [...(affected.has("light") ? [] : ["Good lighting"]), ...(affected.has("framing") ? [] : ["Face centered"]), ...(affected.has("head") ? [] : ["Head position good"])],
      reasons: [],
    };
  }
  const reasons = [...new Set([...hits].map((r) => r.reason))];
  return { ok: false, positives: [], reasons: reasons.length > 0 ? reasons : [FALLBACK_REASON] };
}
