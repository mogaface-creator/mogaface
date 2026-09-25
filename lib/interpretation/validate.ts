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
import { EVIDENCE_LEVELS, EVIDENCE_SOURCE_TYPES, INTERPRETATION_AREAS, REPORT_SOURCE_TYPES } from "./types.ts";
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

  // ---- the personalised report (checked below, once every helper is defined) ----
  const REPORT_SECTION_KEYS = ["facialStructure", "eyeArea", "expression", "skin", "hair", "facialHair", "lifestyle", "style"] as const;

  const checkReportStatement = (s: unknown, where: string) => {
    if (!isObject(s)) return problems.push(`${where}: statement must be an object`);
    checkStatement({ id: s.id, statement: s.text, evidence: s.evidenceRefs }, where);
    if (!(REPORT_SOURCE_TYPES as readonly unknown[]).includes(s.sourceType)) problems.push(`${where}: invalid sourceType`);
    if (!(EVIDENCE_LEVELS as readonly unknown[]).includes(s.confidence)) problems.push(`${where}: invalid confidence`);
    const refs = Array.isArray(s.evidenceRefs) ? s.evidenceRefs.filter(isObject) : [];
    const cites = (t: string) => refs.some((e) => e.sourceType === t);
    if (s.sourceType === "user_reported" && (cites("visual_observation") || cites("treatment_opportunity"))) problems.push(`${where}: a user-reported statement cannot rest on observations or opportunities`);
    if (s.sourceType === "observed" && !cites("visual_observation")) problems.push(`${where}: an observed statement needs a visual observation reference`);
    if (s.sourceType === "opportunity" && !cites("treatment_opportunity")) problems.push(`${where}: an opportunity statement needs a treatment opportunity reference`);
    if (s.sourceType === "limitation" && (cites("treatment_opportunity") || s.confidence !== "limited")) problems.push(`${where}: a limitation statement must be low-evidence and cannot cite an opportunity`);
  };

  const checkReportSection = (sec: unknown, where: string) => {
    if (!isObject(sec) || !Array.isArray(sec.statements) || sec.statements.length === 0) return problems.push(`${where} must have at least one statement`);
    if (!["observed", "user_reported", "not_assessed"].includes(String(sec.basis))) problems.push(`${where}: invalid basis`);
    if (sec.howAssessed !== null && !isText(sec.howAssessed)) problems.push(`${where}: howAssessed must be text or null`);
    else if (isText(sec.howAssessed)) checkText(sec.howAssessed, `${where}.howAssessed`);
    sec.statements.forEach((x: unknown, i: number) => checkReportStatement(x, `${where}.statements[${i}]`));
  };

  const checkReport = (rep: unknown) => {
    if (!isObject(rep)) return problems.push("report must be an object");
    checkReportStatement(rep.overview, "report.overview");

    const interpretationPriorities = Array.isArray(r.priorities) ? r.priorities : [];
    if (!Array.isArray(rep.priorities)) problems.push("report.priorities must be an array");
    else {
      if (rep.priorities.length > 3) problems.push("report: at most 3 priorities");
      if (rep.priorities.length !== interpretationPriorities.length) problems.push("report.priorities must match the interpretation priorities");
      rep.priorities.forEach((p: unknown, i: number) => {
        const where = `report.priorities[${i}]`;
        if (!isObject(p)) return problems.push(`${where} must be an object`);
        checkText(p.concern, `${where}.concern`);
        const expected = interpretationPriorities[i];
        if (isObject(expected) && expected.label !== p.concern) problems.push(`${where}: concern differs from the interpretation priority`);
        if (!["discuss", "observation_only", "recorded"].includes(String(p.status))) problems.push(`${where}: invalid status`);
        checkReportStatement(p.why, `${where}.why`);
        checkReportStatement(p.evidence, `${where}.evidence`);
      });
    }

    if (!isObject(rep.sections)) problems.push("report.sections must be an object");
    else
      for (const key of REPORT_SECTION_KEYS) {
        const sec = rep.sections[key];
        if (key === "expression" && sec === null) continue; // shown only with valid expression evidence
        checkReportSection(sec, `report.sections.${key}`);
      }

    const interpretationOpportunities = Array.isArray(r.opportunities) ? r.opportunities : [];
    if (!Array.isArray(rep.opportunities)) problems.push("report.opportunities must be an array");
    else {
      if (rep.opportunities.length !== interpretationOpportunities.length) problems.push("report.opportunities must match the interpretation opportunities");
      rep.opportunities.forEach((o: unknown, i: number) => {
        const where = `report.opportunities[${i}]`;
        if (!isObject(o)) return problems.push(`${where} must be an object`);
        // The report may rephrase an area but never change the decision the interpretation made about it.
        const expected = interpretationOpportunities[i];
        if (isObject(expected) && (expected.id !== o.id || expected.area !== o.area || expected.status !== o.status || expected.category !== o.category)) {
          problems.push(`${where}: differs from the interpretation opportunity (area, status or category changed)`);
        }
        checkText(o.title, `${where}.title`);
        checkText(o.clinicianCanEvaluate, `${where}.clinicianCanEvaluate`);
        if (!Array.isArray(o.evidenceLines)) problems.push(`${where}.evidenceLines must be an array`);
        else o.evidenceLines.forEach((l: unknown, j: number) => checkText(l, `${where}.evidenceLines[${j}]`));
        checkReportStatement(o.why, `${where}.why`);
        if (isObject(o.why) && (o.status === "insufficient_evidence") !== (o.why.sourceType === "limitation")) problems.push(`${where}: only an insufficient-evidence area may be a limitation`);
      });
    }

    if (!Array.isArray(rep.limitations) || rep.limitations.length === 0) problems.push("report.limitations must be a non-empty array");
    else rep.limitations.forEach((l: unknown, i: number) => checkText(l, `report.limitations[${i}]`));
    checkText(rep.clinicianReview, "report.clinicianReview");
    if (!isObject(rep.cta)) problems.push("report.cta must be an object");
    else {
      checkText(rep.cta.heading, "report.cta.heading");
      checkText(rep.cta.supportingText, "report.cta.supportingText");
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

  checkReport(r.report);

  return problems;
}

export function isValidInterpretation(value: unknown, input: InterpretationInput, options: ValidateOptions = {}): boolean {
  return validateInterpretation(value, input, options).length === 0;
}
