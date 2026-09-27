/**
 * Safety validation of everything that can reach an image model.
 *
 * An illustration is a rendering of an approved MogaFace finding — not a
 * treatment simulation, a procedure, an age change or a beauty edit. So any
 * instruction or prompt that names a treatment, a procedure, a quantity, an
 * age or attractiveness goal, a dramatic change, or a promise is refused.
 * The FIXED prompt template and the FIXED per-category instructions are scanned
 * with the same list, so a future edit that breaks the rules fails a test.
 */

interface Rule {
  label: string;
  pattern: RegExp;
}

export const UNSAFE_VISUAL_RULES: Rule[] = [
  // beauty / attractiveness / age optimisation
  { label: "beauty edit", pattern: /\bmake\b[^.\n]{0,40}\b(prettier|handsome|beautiful|younger|more attractive|attractive)\b|\bbeautif\w*|\bprettier\b|\bhandsome\b|\bbeautiful\b|\bglow[- ]?up\b/i },
  { label: "attractiveness", pattern: /\battractive(ness)?\b|\bperfect (face|features?|symmetry|proportions?)\b|\bideal (face|features?|proportions?|symmetry)\b|\bmodel[- ]like\b|\bmodel face\b|\bcelebrity\b|\bflawless\b/i },
  { label: "flaws", pattern: /\bflaws?\b|\bimperfections?\b/i },
  { label: "age change", pattern: /\b(younger|youthful|rejuvenat\w*|de-?age\w*|anti-?aging|age[- ]reduc\w*|look(s|ing)? \d+)\b/i },
  // treatments, procedures, quantities
  { label: "named treatment", pattern: /\b(botox|dysport|xeomin|neuromodulators?|fillers?|juvederm|restylane|sculptra|threads?|thread ?lifts?|implants?|lasers?)\b/i },
  { label: "procedure", pattern: /\b(inject\w*|needles?|syringes?|cannulas?|incisions?|sutures?|surgery|surgical|surgeon|facelift|face-?lift|procedures?|anesthe\w*|prescri\w*|diagnos\w*)\b/i },
  { label: "quantity", pattern: /\b(dosage|dose|doses|units)\b|\b\d+(\.\d+)?\s?(ml|mg|cc|units?)\b|\bml\s+filler\b/i },
  // dramatic or reshaping language
  { label: "reshaping", pattern: /\b(sharper|sharpen\w*|chisel\w*|sculpt\w*|slimm\w*|plump\w*|enlarg\w*|reshap\w*|augment\w*|lifted|lifting)\b/i },
  // promises
  { label: "promise", pattern: /\b(guarantee[ds]?|will (look|give|make|remove|erase|fix)|expected result|predicted result)\b/i },
];

/** Every reason `text` is not safe to send to an image model. Empty means safe. */
export function findUnsafeVisualText(text: string): string[] {
  return UNSAFE_VISUAL_RULES.filter((r) => r.pattern.test(text)).map((r) => r.label);
}

/** The whole prompt — template and instructions together — must pass. */
export function validateIllustrationPrompt(prompt: unknown): string[] {
  if (typeof prompt !== "string" || prompt.trim().length === 0) return ["prompt must be a non-empty string"];
  const found = findUnsafeVisualText(prompt);
  return found.map((f) => `prompt contains unsafe wording (${f})`);
}
