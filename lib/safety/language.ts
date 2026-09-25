/**
 * Structural language safety for everything a consumer can read.
 *
 * MogaFace never diagnoses, never says a person needs or is suitable for a
 * treatment, never scores a face, and never predicts a result. Those rules
 * are enforced HERE, in code, on every string the interpretation and
 * visualization layers produce — including anything an AI provider returns —
 * rather than trusted to a prompt.
 */

export interface ForbiddenPattern {
  /** Short name reported back, e.g. "need/suitability claim". */
  label: string;
  pattern: RegExp;
}

export const FORBIDDEN_LANGUAGE: ForbiddenPattern[] = [
  // Need / suitability / candidacy claims
  { label: "need claim", pattern: /\byou (really |absolutely )?need\b/i },
  { label: "should-get claim", pattern: /\byou should (get|have|undergo|book|take|try|consider having)\b/i },
  { label: "suitability claim", pattern: /\b(suitable|ideal|perfect) (for|candidate)\b/i },
  { label: "candidacy claim", pattern: /\bcandidates? for\b/i },
  { label: "will-benefit claim", pattern: /\b(will benefit|would benefit|is recommended|we recommend|recommended for you)\b/i },
  // Diagnosis and medical claims
  { label: "diagnosis", pattern: /\bdiagnos/i },
  { label: "medical condition", pattern: /\bmedical (condition|issue|problem)\b/i },
  { label: "named condition", pattern: /\b(acne|melasma|rosacea|dermatitis|scarring|hyperpigmentation|pigmentation disorder|eczema|psoriasis)\b/i },
  { label: "anatomical cause", pattern: /\b(tear[- ]?trough|fat pad|vascular|ptosis|volume (loss|deficiency|deficit)|laxity|sagging)\b/i },
  { label: "aging claim", pattern: /\b(aging|ageing|aged|wrinkles?|premature)\b/i },
  // Scores and comparison to an ideal
  { label: "score", pattern: /\bscores?\b/i },
  { label: "percentage", pattern: /\d\s?%/ },
  { label: "attractiveness claim", pattern: /\b(attractive|unattractive|beautiful|beauty|ugly|handsome)\b/i },
  { label: "ideal comparison", pattern: /\b(ideal|perfect|perfectly|flawless|golden ratio) (face|proportion|symmetry|features?)\b/i },
  { label: "ideal comparison", pattern: /\b(ideal|perfect) face\b/i },
  // Outcome promises
  { label: "outcome promise", pattern: /\b(guarantee[ds]?|will (look|give you|make you|remove|erase|fix)|results? will|you will (look|see))\b/i },
  { label: "transformation claim", pattern: /\b(transform(ation|ed)?|dramatic|younger|de-?age|makeover)\b/i },
  // Brand names — categories only
  { label: "brand name", pattern: /\b(botox|dysport|xeomin|juvederm|restylane|sculptra|ultherapy)\b/i },
];

/**
 * Returns the labels of every forbidden pattern found in `text`. `allow`
 * lists exact strings (e.g. the fixed disclaimer, which legitimately says
 * "Not a prediction of treatment outcome") that are removed before scanning.
 */
export function findForbiddenLanguage(text: string, allow: readonly string[] = []): string[] {
  let scanned = text;
  for (const a of allow) scanned = scanned.split(a).join(" ");
  const found = new Set<string>();
  for (const { label, pattern } of FORBIDDEN_LANGUAGE) if (pattern.test(scanned)) found.add(label);
  return [...found];
}
