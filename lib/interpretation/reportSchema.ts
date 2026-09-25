/**
 * The JSON Schema a model must answer with (OpenAI strict structured output:
 * every property required, additionalProperties false, nullability by union).
 * It mirrors the editable part of the deterministic report (see
 * prompts.ts → editableDraft). The schema only fixes the SHAPE; the values
 * are checked afterwards by validateInterpretation and immutable.ts — a model
 * that fills the shape with changed facts is still rejected.
 */

import { EVIDENCE_LEVELS, EVIDENCE_SOURCE_TYPES, INTERPRETATION_AREAS, REPORT_SOURCE_TYPES } from "./types.ts";

const str = { type: "string" } as const;
const nullableStr = { type: ["string", "null"] } as const;
const obj = (properties: Record<string, unknown>) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false }) as const;
const arr = (items: unknown) => ({ type: "array", items }) as const;
const oneOf = (values: readonly string[]) => ({ type: "string", enum: [...values] }) as const;

const evidenceRef = obj({ sourceType: oneOf(EVIDENCE_SOURCE_TYPES), sourceId: str });
const statement = obj({
  id: str,
  text: str,
  evidenceRefs: arr(evidenceRef),
  confidence: oneOf(EVIDENCE_LEVELS),
  sourceType: oneOf(REPORT_SOURCE_TYPES),
});
const section = obj({ basis: oneOf(["observed", "user_reported", "not_assessed"]), statements: arr(statement), howAssessed: nullableStr });
const priority = obj({ id: str, concern: str, why: statement, evidence: statement, status: oneOf(["discuss", "observation_only", "recorded"]) });
const opportunity = obj({
  id: str,
  area: oneOf(INTERPRETATION_AREAS),
  title: str,
  status: oneOf(["discuss", "observation_only", "insufficient_evidence"]),
  why: statement,
  evidenceLines: arr(str),
  clinicianCanEvaluate: str,
  category: nullableStr,
});

export const REPORT_OUTPUT_SCHEMA = obj({
  overview: statement,
  priorities: arr(priority),
  sections: obj({
    facialStructure: section,
    eyeArea: section,
    expression: { anyOf: [section, { type: "null" }] },
    skin: section,
  }),
  opportunities: arr(opportunity),
});
