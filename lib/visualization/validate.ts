/**
 * Structural validation of a VisualizationPlan. An image generator must only
 * ever be handed a plan that passes this: approved categories, subtle
 * intensity, evidence on every change, the fixed disclaimer, and (when the
 * opportunities are supplied) each change backed by a real consumer-ready
 * opportunity of the matching category. Never throws.
 */

import { findForbiddenLanguage } from "../safety/language.ts";
import type { TreatmentOpportunity } from "../treatment-opportunities/types.ts";
import { findUnsafeVisualText } from "./safety.ts";
import {
  APPROVED_VISUAL_CHANGES,
  VISUALIZATION_CATEGORIES,
  VISUALIZATION_CATEGORY_TREATMENT_CATEGORY,
  VISUALIZATION_DISCLAIMER,
  VISUALIZATION_INTENSITIES,
} from "./types.ts";
import type { VisualizationCategory } from "./types.ts";

const DISCLAIMER_TEXT = [VISUALIZATION_DISCLAIMER.label, VISUALIZATION_DISCLAIMER.notice];

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

export function validateVisualizationPlan(value: unknown, opportunities?: TreatmentOpportunity[]): string[] {
  if (!isObject(value)) return ["plan must be an object"];
  const p = value;
  const problems: string[] = [];

  if (!isText(p.version)) problems.push("version must be a non-empty string");
  if (p.status !== "planned" && p.status !== "not_eligible") problems.push(`status "${String(p.status)}" is invalid`);

  // The disclaimer is mandatory and fixed — it is never optional or rewritable.
  const d = p.disclaimer;
  if (!isObject(d) || d.label !== VISUALIZATION_DISCLAIMER.label || d.notice !== VISUALIZATION_DISCLAIMER.notice) {
    problems.push("the fixed disclaimer must be present and unchanged");
  }

  if (!Array.isArray(p.preserve) || p.preserve.length === 0) problems.push("preserve rules must be present");

  const changes = Array.isArray(p.changes) ? p.changes : null;
  if (!changes) problems.push("changes must be an array");
  else {
    if (p.status === "planned" && changes.length === 0) problems.push("a planned visualization needs at least one change");
    if (p.status === "not_eligible" && changes.length > 0) problems.push("a not-eligible plan must have no changes");

    changes.forEach((c: unknown, i: number) => {
      const where = `changes[${i}]`;
      if (!isObject(c)) return problems.push(`${where} must be an object`);
      if (!(VISUALIZATION_CATEGORIES as readonly unknown[]).includes(c.category)) problems.push(`${where}: category "${String(c.category)}" is not an approved visualization category`);
      if (!(VISUALIZATION_INTENSITIES as readonly unknown[]).includes(c.intensity)) problems.push(`${where}: intensity "${String(c.intensity)}" is not allowed (changes must stay subtle)`);
      if (!isText(c.description)) problems.push(`${where}: description must be a non-empty string`);
      else {
        const found = findForbiddenLanguage(c.description);
        if (found.length > 0) problems.push(`${where}: forbidden language (${found.join(", ")})`);
      }
      // The rendering fields are fixed per category — a plan can never carry different instructions.
      const fixed = APPROVED_VISUAL_CHANGES[c.category as VisualizationCategory];
      if (fixed) {
        if (c.visualInstruction !== fixed.visualInstruction) problems.push(`${where}: visualInstruction is not the approved instruction for this category`);
        if (c.targetRegion !== fixed.targetRegion) problems.push(`${where}: targetRegion is not the approved region for this category`);
      }
      if (isText(c.visualInstruction)) {
        const unsafe = findUnsafeVisualText(c.visualInstruction);
        if (unsafe.length > 0) problems.push(`${where}: unsafe instruction (${unsafe.join(", ")})`);
      } else problems.push(`${where}: visualInstruction must be a non-empty string`);
      if (!isText(c.changeId)) problems.push(`${where}: changeId must be a non-empty string`);
      if (c.intensityLimit !== "subtle") problems.push(`${where}: intensityLimit must be "subtle"`);
      if (c.safetyStatus !== "approved") problems.push(`${where}: safetyStatus must be "approved"`);
      if (c.consumerReady !== true) problems.push(`${where}: a change must rest on a consumer-ready opportunity`);
      if (!isText(c.sourceOpportunityId)) problems.push(`${where}: sourceOpportunityId must be a non-empty string`);
      else if (opportunities && !opportunities.some((o) => o.id === c.sourceOpportunityId)) problems.push(`${where}: sourceOpportunityId does not match a supplied opportunity`);
      if (!Array.isArray(c.evidenceRefs) || c.evidenceRefs.length === 0) problems.push(`${where}: evidenceRefs must be a non-empty array (unsupported evidence)`);
      if (!Array.isArray(c.evidenceIds) || c.evidenceIds.length === 0 || !c.evidenceIds.every(isText)) problems.push(`${where}: evidenceIds must be a non-empty array (unsupported change)`);
      else if (opportunities) {
        const need = VISUALIZATION_CATEGORY_TREATMENT_CATEGORY[c.category as VisualizationCategory];
        const backed = opportunities.some((o) => c.evidenceIds && (c.evidenceIds as string[]).includes(o.id) && o.status === "potential_opportunity" && o.consumerReady && o.category === need);
        if (!backed) problems.push(`${where}: not backed by a consumer-ready ${need ?? "approved"} opportunity`);
      }
    });
  }

  if (p.status === "planned") {
    const src = p.sourcePhoto;
    if (!isObject(src) || src.slot !== "front" || !isText(src.ref)) problems.push("a planned visualization needs the front photo as its source");
  }
  if (p.status === "not_eligible" && !isText(p.ineligibleReason)) problems.push("a not-eligible plan must say why");

  if (!Array.isArray(p.excludedChanges)) problems.push("excludedChanges must be an array");
  else p.excludedChanges.forEach((e: unknown, i: number) => {
    if (!isObject(e) || !isText(e.category) || !isText(e.reason)) return problems.push(`excludedChanges[${i}] is malformed`);
    const found = findForbiddenLanguage(e.reason, DISCLAIMER_TEXT);
    if (found.length > 0) problems.push(`excludedChanges[${i}]: forbidden language (${found.join(", ")})`);
  });

  return problems;
}

export const isValidVisualizationPlan = (v: unknown, o?: TreatmentOpportunity[]) => validateVisualizationPlan(v, o).length === 0;
