/**
 * ENGINEERING EXPECTATIONS — what a developer, looking at the same media,
 * expects the visual layer to find.
 *
 * This is deliberately NOT called ground truth. How something looks in a
 * photo is not clinical truth, the labeller is one person's eye, and the
 * labels say nothing about any medical condition. They exist only so the
 * layer's output can be compared against a written-down human expectation.
 * Nothing here asks for, or allows, a diagnosis (no tear trough, pigmentation
 * disorder, cause of puffiness, or medical condition).
 */

import type { PhotoSlot } from "../multiPhoto/types.ts";
import type { ActiveExpressionState } from "../video/types.ts";

/**
 * One scale for every "is it visible / present" domain:
 *   clearly — clearly visible / present
 *   subtle  — somewhat visible / subtle
 *   absent  — not visibly apparent / absent
 *   unclear — the labeller cannot tell
 */
export const PRESENCE_LEVELS = ["clearly", "subtle", "absent", "unclear"] as const;
export type PresenceLevel = (typeof PRESENCE_LEVELS)[number];

export const QUALITY_LABELS = ["usable", "borderline", "unusable"] as const;
export type QualityLabel = (typeof QUALITY_LABELS)[number];

/** Wording shown to the labeller, per domain family. */
export const PRESENCE_WORDING: Record<"lines" | "contour" | "underEye" | "expression", Record<PresenceLevel, string>> = {
  lines: { clearly: "clearly visible", subtle: "somewhat visible", absent: "not visibly apparent", unclear: "unclear" },
  contour: { clearly: "contour difference clearly visible", subtle: "subtle", absent: "not visibly apparent", unclear: "unclear" },
  underEye: { clearly: "dark-looking appearance clearly visible", subtle: "subtle", absent: "not visibly apparent", unclear: "unclear" },
  expression: { clearly: "clearly present", subtle: "subtle", absent: "absent", unclear: "unclear" },
};

export const LINE_REGIONS = ["forehead", "glabellar", "lateralEye"] as const;
export type LineRegion = (typeof LINE_REGIONS)[number];
export const EXPRESSIONS: ActiveExpressionState[] = ["BROW_RAISE", "FROWN", "SMILE", "SQUINT"];
export type QualityTarget = PhotoSlot | "video";

/** A null value means "not recorded" — that row is skipped, never guessed. */
export interface EngineeringExpectations {
  lines: Record<LineRegion, PresenceLevel | null>;
  contour: PresenceLevel | null;
  underEye: PresenceLevel | null;
  expression: Record<ActiveExpressionState, PresenceLevel | null>;
  quality: Partial<Record<QualityTarget, QualityLabel>>;
}

export function emptyExpectations(): EngineeringExpectations {
  return {
    lines: { forehead: null, glabellar: null, lateralEye: null },
    contour: null,
    underEye: null,
    expression: { BROW_RAISE: null, FROWN: null, SMILE: null, SQUINT: null },
    quality: {},
  };
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isLevel = (v: unknown) => v === null || (PRESENCE_LEVELS as readonly unknown[]).includes(v);
const QUALITY_TARGETS: string[] = ["front", "leftFortyFive", "rightFortyFive", "leftProfile", "rightProfile", "video"];

/** Returns problems; empty = well-formed. Never throws. */
export function validateExpectations(value: unknown): string[] {
  if (!isObject(value)) return ["expectations must be an object"];
  const problems: string[] = [];
  const check = (v: unknown, where: string) => {
    if (!isLevel(v)) problems.push(`${where}: "${String(v)}" is not one of ${PRESENCE_LEVELS.join(", ")} (or not recorded)`);
  };

  if (!isObject(value.lines)) problems.push("lines must be an object");
  else for (const r of LINE_REGIONS) check(value.lines[r], `lines.${r}`);
  check(value.contour, "contour");
  check(value.underEye, "underEye");
  if (!isObject(value.expression)) problems.push("expression must be an object");
  else for (const e of EXPRESSIONS) check(value.expression[e], `expression.${e}`);

  if (!isObject(value.quality)) problems.push("quality must be an object");
  else {
    for (const [k, v] of Object.entries(value.quality)) {
      if (!QUALITY_TARGETS.includes(k)) problems.push(`quality.${k}: not a photo view or "video"`);
      if (!(QUALITY_LABELS as readonly unknown[]).includes(v)) problems.push(`quality.${k}: "${String(v)}" is not usable, borderline or unusable`);
    }
  }
  // Guard against a diagnosis sneaking in through an unknown key.
  for (const key of Object.keys(value)) {
    if (!["lines", "contour", "underEye", "expression", "quality"].includes(key)) problems.push(`unknown expectation field "${key}" (diagnostic labels are not allowed)`);
  }
  return problems;
}
