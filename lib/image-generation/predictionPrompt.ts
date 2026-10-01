/**
 * The instruction the image model receives for a goal-driven plan.
 *
 * buildIllustrationPrompt remains the prompt for the calibration-gated plan.
 * A prediction plan also names the place on this person's photo
 * (lib/visualization/focus.ts), so the edit is specific instead of a generic
 * area sentence. The approved visual instruction is still included, unchanged.
 */

import { CROSS_ANGLE_CONSISTENCY } from "../visualization/predict.ts";
import type { PredictionPlan } from "../visualization/predict.ts";
import { CATEGORY_FOCUS } from "../visualization/focus.ts";
import type { VisualizationCategory, VisualizationPlan } from "../visualization/types.ts";

export function isPredictionPlan(plan: VisualizationPlan): plan is PredictionPlan {
  const extra = plan as Partial<PredictionPlan>;
  return typeof extra.consistency === "string" && typeof extra.purpose === "string" && Array.isArray(extra.prohibited);
}

function focusesFor(plan: PredictionPlan, category: VisualizationCategory): string[] {
  const specific = (plan.focus ?? []).filter((focus) => focus.category === category).map((focus) => focus.text);
  return specific.length > 0 ? specific : [CATEGORY_FOCUS[category]];
}

/** The prompt actually sent for a prediction plan. Empty when nothing was approved. */
export function buildPredictionIllustrationPrompt(plan: PredictionPlan): string {
  if (plan.changes.length === 0) return "";
  const lines = [
    "Edit this photograph. The result is the after image in a side-by-side pair with the original.",
    "Keep the same person, pose, crop, camera angle, lighting, clothing, and background. Do not replace the person.",
    "Change only the places named below. Make each named change easy to see beside the original. If a named place is not visible in this photo, leave it unchanged.",
    "Apply only these changes:",
  ];
  for (const change of plan.changes) {
    lines.push(`- ${change.visualInstruction}`);
    for (const focus of focusesFor(plan, change.category)) lines.push(`- Where to apply it on this photo: ${focus}`);
  }
  lines.push("Leave every feature that is not named above exactly as it is in this photo.");
  lines.push(CROSS_ANGLE_CONSISTENCY);
  lines.push("The output must look like a real photograph and remain recognizably the same person.");
  return lines.join("\n");
}

