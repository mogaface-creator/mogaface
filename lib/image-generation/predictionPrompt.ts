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
    "Edit the supplied portrait of this same person. Use this photo as the source. Do not replace the person.",
    "Look at what is actually visible in this photo. Change only the places named below. If a named place is not visible, leave it unchanged.",
    "Keep the same pose, framing, camera angle, lighting, and background.",
    "The result must look like a real photograph of the same person, and the difference must be easy to see beside the original.",
    "Apply only the following approved change(s):",
  ];
  for (const change of plan.changes) {
    lines.push(`- ${change.visualInstruction}`);
    for (const focus of focusesFor(plan, change.category)) lines.push(`- Where to apply it on this photo: ${focus}`);
  }
  lines.push(CROSS_ANGLE_CONSISTENCY);
  lines.push(`Do not change any of the following unless it is explicitly part of an approved change: ${plan.preserve.join("; ")}.`);
  lines.push("Do not create a dramatic transformation.");
  lines.push("The output must remain recognizably the same person.");
  return lines.join("\n");
}

