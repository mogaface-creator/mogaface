/**
 * Structural validation for TreatmentOpportunity. Takes `unknown` and never
 * throws, so a malformed value (bad rule output, corrupted stored data)
 * fails safely with a list of problems instead of crashing the caller.
 * An empty list means well-formed.
 */

import { isConsumerReady } from "../facial-analysis/calibration/status.ts";
import {
  EVIDENCE_KINDS,
  TREATMENT_CONCERNS,
  isOpportunityConfidence,
  isOpportunityStatus,
  isTreatmentCategory,
} from "./types.ts";

/**
 * Language a title/rationale must never contain: need/suitability claims,
 * diagnosis, attractiveness, or fake percentages. A safety net behind the
 * rules' own wording, not a substitute for it.
 */
const FORBIDDEN_LANGUAGE = /you need|you should (get|have)|suitable for|guarantee|diagnos|attractiv|beaut|ugly|\bideal\b|\d\s?%/i;

const isNonEmptyString = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

export function validateOpportunity(value: unknown): string[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return ["opportunity must be an object"];
  const o = value as Record<string, unknown>;
  const problems: string[] = [];

  if (!isNonEmptyString(o.id)) problems.push("id must be a non-empty string");
  if (!isNonEmptyString(o.title)) problems.push("title must be a non-empty string");
  if (!isNonEmptyString(o.rationale)) problems.push("rationale must be a non-empty string");
  if (!(TREATMENT_CONCERNS as readonly unknown[]).includes(o.concern)) problems.push(`concern "${String(o.concern)}" is not a valid concern`);

  const statusOk = isOpportunityStatus(o.status);
  if (!statusOk) problems.push(`status "${String(o.status)}" is not a valid status`);
  const isPotential = o.status === "potential_opportunity";

  if (isPotential) {
    if (!isTreatmentCategory(o.category)) problems.push(`category "${String(o.category)}" is not a valid treatment category`);
    if (!isOpportunityConfidence(o.confidence)) problems.push(`confidence "${String(o.confidence)}" is not low, moderate or high`);
  } else if (statusOk) {
    if (o.category !== null) problems.push("category must be null unless status is potential_opportunity");
    if (o.confidence !== null) problems.push("confidence must be null unless status is potential_opportunity");
  }

  // Evidence
  const evidenceKinds: string[] = [];
  const evidenceObs: string[] = [];
  const evidenceQ: string[] = [];
  if (!Array.isArray(o.evidence) || o.evidence.length === 0) {
    problems.push("evidence must be a non-empty array");
  } else {
    o.evidence.forEach((raw, i) => {
      const e = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
      if (!(EVIDENCE_KINDS as readonly unknown[]).includes(e.kind)) problems.push(`evidence[${i}].kind is invalid`);
      if (!isNonEmptyString(e.id)) problems.push(`evidence[${i}].id must be a non-empty string`);
      if (!isNonEmptyString(e.label)) problems.push(`evidence[${i}].label must be a non-empty string`);
      if (!isNonEmptyString(e.source)) problems.push(`evidence[${i}].source must be a non-empty string`);
      if (typeof e.kind === "string" && typeof e.id === "string") {
        evidenceKinds.push(e.kind);
        (e.kind === "questionnaire" ? evidenceQ : evidenceObs).push(e.id);
      }
    });
    if (isPotential && !evidenceKinds.includes("questionnaire")) {
      problems.push("a potential opportunity must be grounded in a user-reported goal or concern");
    }
    const sameIds = (declared: unknown, derived: string[]) =>
      isStringArray(declared) && new Set(declared).size === new Set(derived).size && derived.every((id) => declared.includes(id));
    if (!sameIds(o.evidenceObservationIds, evidenceObs)) problems.push("evidenceObservationIds must match the observation/video evidence");
    if (!sameIds(o.evidenceQuestionIds, evidenceQ)) problems.push("evidenceQuestionIds must match the questionnaire evidence");
  }

  if (!isStringArray(o.limitations)) problems.push("limitations must be an array of strings");
  else if (isPotential && o.limitations.length === 0) problems.push("a potential opportunity must carry at least one limitation");

  if (typeof o.consumerReady !== "boolean") problems.push("consumerReady must be a boolean");
  else if (o.consumerReady !== isConsumerReady(evidenceObs)) {
    problems.push("consumerReady does not match the calibration status of the cited observations");
  }

  if (o.clinicianReviewRequired !== true) problems.push("clinicianReviewRequired must be true");
  if (!isNonEmptyString(o.methodologyVersion)) problems.push("methodologyVersion must be a non-empty string");
  if (!isNonEmptyString(o.createdAt) || Number.isNaN(Date.parse(o.createdAt))) problems.push("createdAt must be a valid ISO date string");

  for (const field of ["title", "rationale"] as const) {
    if (typeof o[field] === "string" && FORBIDDEN_LANGUAGE.test(o[field])) {
      problems.push(`${field} contains language a treatment opportunity must not use (need/suitability/diagnosis/attractiveness/percentage)`);
    }
  }

  return problems;
}

export function isValidOpportunity(value: unknown): boolean {
  return validateOpportunity(value).length === 0;
}
