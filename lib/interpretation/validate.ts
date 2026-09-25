/**
 * Structural validation of an InterpretationResult against the input it was
 * supposedly built from. This is what makes the safety rules real: it runs on
 * the local builder's output AND on anything an AI provider returns, so a
 * model cannot get an unsupported claim to a consumer by phrasing it well.
 *
 * Checks: shape; every statement traceable to evidence that exists in the
 * input (and, for visual evidence, is consumer-usable); no forbidden language
 * anywhere; no treatment named without a backing treatment opportunity; and
 * every "discuss" item backed by a real, consumer-ready opportunity.
 * Never throws.
 */

import { isConsumerReady } from "../facial-analysis/calibration/status.ts";
import { findForbiddenLanguage } from "../safety/language.ts";
import { TREATMENT_CATEGORIES } from "../treatment-opportunities/types.ts";
import { EVIDENCE_SOURCE_TYPES, INTERPRETATION_AREAS } from "./types.ts";
import type { InterpretationInput } from "./types.ts";

const AREA_STATUSES = ["discuss", "observation_only", "insufficient_evidence"];
const SECTION_KEYS = ["facialStructure", "eyeArea", "skin", "hair", "facialHair", "lifestyle", "style"] as const;
/** Naming one of these in a statement requires a treatment_opportunity reference on that statement. */
const TREATMENT_WORDS = /\b(neuromodulators?|fillers?|threads?|contouring)\b/i;

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

export interface ValidateOptions {
  /** Override the visual-calibration flag (tests only). */
  calibrated?: boolean;
  /** Exact strings exempt from the language scan (none are needed for interpretation text). */
  allow?: string[];
}

export function validateInterpretation(value: unknown, input: InterpretationInput, options: ValidateOptions = {}): string[] {
  if (!isObject(value)) return ["interpretation must be an object"];
  const problems: string[] = [];
  const r = value;

  const goalIds = new Set(input.goals.map((g) => g.sourceId));
  const observations = new Map(input.observations.map((o) => [o.id, o]));
  const opportunities = new Map(input.opportunities.map((o) => [o.id, o]));

  const checkRef = (ref: unknown, where: string) => {
    if (!isObject(ref) || !(EVIDENCE_SOURCE_TYPES as readonly unknown[]).includes(ref.sourceType) || !isText(ref.sourceId)) {
      problems.push(`${where}: malformed evidence reference`);
      return;
    }
    const id = ref.sourceId;
    switch (ref.sourceType) {
      case "questionnaire": {
        const o = observations.get(id);
        if (!goalIds.has(id) && !(o && o.type === "user_reported")) problems.push(`${where}: questionnaire evidence "${id}" does not exist in the input`);
        break;
      }
      case "visual_observation": {
        const o = observations.get(id);
        if (!o || o.type === "user_reported") problems.push(`${where}: visual observation "${id}" does not exist in the input`);
        else if (!isConsumerReady([id], options.calibrated)) problems.push(`${where}: visual observation "${id}" is not consumer-usable (uncalibrated)`);
        break;
      }
      case "treatment_opportunity":
        if (!opportunities.has(id)) problems.push(`${where}: treatment opportunity "${id}" does not exist in the input`);
        break;
      case "assessment":
        if (id !== input.assessmentId) problems.push(`${where}: assessment reference does not match the input`);
        break;
    }
  };

  const checkText = (text: unknown, where: string) => {
    if (!isText(text)) return problems.push(`${where}: text must be a non-empty string`);
    const found = findForbiddenLanguage(text, options.allow);
    if (found.length > 0) problems.push(`${where}: forbidden language (${found.join(", ")})`);
  };

  const checkStatement = (s: unknown, where: string) => {
    if (!isObject(s)) return problems.push(`${where}: statement must be an object`);
    if (!isText(s.id)) problems.push(`${where}: id must be a non-empty string`);
    checkText(s.statement, where);
    if (!Array.isArray(s.evidence) || s.evidence.length === 0) {
      problems.push(`${where}: statement has no evidence (unsupported)`);
      return;
    }
    s.evidence.forEach((ref, i) => checkRef(ref, `${where}.evidence[${i}]`));
    if (isText(s.statement) && TREATMENT_WORDS.test(s.statement) && !s.evidence.some((e) => isObject(e) && e.sourceType === "treatment_opportunity")) {
      problems.push(`${where}: names a treatment without a backing treatment opportunity`);
    }
  };

  if (!isText(r.version)) problems.push("version must be a non-empty string");
  if (!isText(r.createdAt) || Number.isNaN(Date.parse(r.createdAt))) problems.push("createdAt must be a valid ISO date string");
  if (r.clinicianReviewRequired !== true) problems.push("clinicianReviewRequired must be true");

  checkStatement(r.summary, "summary");

  if (!Array.isArray(r.priorities)) problems.push("priorities must be an array");
  else {
    if (r.priorities.length > 3) problems.push("at most 3 priorities");
    r.priorities.forEach((p: unknown, i: number) => {
      if (!isObject(p)) return problems.push(`priorities[${i}] must be an object`);
      checkText(p.label, `priorities[${i}].label`);
      if (!Array.isArray(p.evidence) || p.evidence.length === 0) problems.push(`priorities[${i}] has no evidence`);
      else p.evidence.forEach((ref, j) => checkRef(ref, `priorities[${i}].evidence[${j}]`));
    });
  }

  for (const key of SECTION_KEYS) {
    const sec = r[key];
    if (!isObject(sec) || !Array.isArray(sec.statements)) problems.push(`${key} must have a statements array`);
    else sec.statements.forEach((s: unknown, i: number) => checkStatement(s, `${key}.statements[${i}]`));
  }

  if (!Array.isArray(r.opportunities)) problems.push("opportunities must be an array");
  else {
    r.opportunities.forEach((o: unknown, i: number) => {
      const where = `opportunities[${i}]`;
      if (!isObject(o)) return problems.push(`${where} must be an object`);
      if (!(INTERPRETATION_AREAS as readonly unknown[]).includes(o.area)) problems.push(`${where}: invalid area`);
      if (!(AREA_STATUSES as readonly unknown[]).includes(o.status)) problems.push(`${where}: invalid status`);
      checkText(o.title, `${where}.title`);
      checkStatement({ id: o.id, statement: o.statement, evidence: o.evidence }, where);

      if (o.status === "discuss") {
        const backing = isObject(o) && Array.isArray(o.evidence) ? o.evidence.find((e) => isObject(e) && e.sourceType === "treatment_opportunity") : undefined;
        const opp = isObject(backing) && isText(backing.sourceId) ? opportunities.get(backing.sourceId) : undefined;
        if (!(TREATMENT_CATEGORIES as readonly unknown[]).includes(o.category)) problems.push(`${where}: "discuss" needs a valid treatment category`);
        if (!opp) problems.push(`${where}: "discuss" is not backed by a treatment opportunity`);
        else {
          if (opp.status !== "potential_opportunity") problems.push(`${where}: backing opportunity is not a potential opportunity`);
          if (!opp.consumerReady) problems.push(`${where}: backing opportunity is not consumer-ready`);
          if (opp.category !== o.category) problems.push(`${where}: category does not match the backing opportunity (unsupported treatment)`);
        }
      } else if (o.category !== null) {
        problems.push(`${where}: only "discuss" items may carry a treatment category`);
      }
      if (o.status === "observation_only" && !(Array.isArray(o.evidence) && o.evidence.some((e) => isObject(e) && e.sourceType === "visual_observation"))) {
        problems.push(`${where}: an observation needs a visual observation reference`);
      }
    });
  }

  if (!Array.isArray(r.limitations) || r.limitations.length === 0) problems.push("limitations must be a non-empty array");
  else r.limitations.forEach((l: unknown, i: number) => checkText(l, `limitations[${i}]`));

  if (!Array.isArray(r.evidence)) problems.push("evidence must be an array");
  else r.evidence.forEach((e: unknown, i: number) => {
    checkRef(e, `evidence[${i}]`);
    if (!isObject(e) || !isText(e.label)) problems.push(`evidence[${i}].label must be a non-empty string`);
  });

  return problems;
}

export function isValidInterpretation(value: unknown, input: InterpretationInput, options: ValidateOptions = {}): boolean {
  return validateInterpretation(value, input, options).length === 0;
}
