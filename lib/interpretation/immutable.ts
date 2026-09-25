/**
 * Evidence immutability for an AI-worded report.
 *
 * The deterministic report is the source of truth. A model may rephrase the
 * `text` of a statement that describes findings or goals — nothing else. This
 * compares a candidate report with the deterministic draft and reports every
 * difference that is not allowed wording:
 *
 *  - evidence references, source types, confidence, ids, statuses, categories,
 *    titles, concerns, evidence lines, "what the clinician can evaluate",
 *    section availability, limitations, clinician-review and CTA copy: identical;
 *  - statements whose source type is "limitation": identical text too;
 *  - sections that are not sent to the model (hair, facial hair, lifestyle, style): identical;
 *  - rephrased text may not introduce a treatment, a cause, an instruction, a
 *    judgement of the face, a promise, a number, markup, a link, or grow much
 *    longer than the draft. Words the draft itself used remain allowed.
 *
 * The forbidden-language scan (lib/safety/language.ts) runs separately in
 * validateInterpretation and applies to every string regardless.
 */

import type { MogaFaceReport, ReportStatement } from "./types.ts";

/** The only sections a model is shown and may reword. Everything else is questionnaire description, kept verbatim. */
export const AI_EDITABLE_SECTIONS = ["facialStructure", "eyeArea", "expression", "skin"] as const;
const ALL_SECTIONS = ["facialStructure", "eyeArea", "expression", "skin", "hair", "facialHair", "lifestyle", "style"] as const;

const LEXICON: { label: string; pattern: RegExp }[] = [
  { label: "treatment", pattern: /\b(neuromodulators?|fillers?|threads?|thread lifts?|contouring|injectables?|injections?|injected|lasers?|peels?|microneedling|surgery|surgical|facelift|implants?|botulinum|radiofrequency|hyaluronic|procedures?|treatments?|therapy)\b/gi },
  { label: "cause", pattern: /\b(because|due to|owing to|caused?|causing|as a result|results? from|resulting|leads? to|linked to|stems? from|contribut\w+|explains?|reason for|attributable)\b/gi },
  { label: "instruction", pattern: /\b(should|must|ought|needs?|needed|recommend\w*|advis\w*|encourage\w*|urge\w*|consider)\b/gi },
  { label: "judgement", pattern: /\b(poor|weak|flaw\w*|defect\w*|deficien\w*|lacking|lack of|problem\w*|abnormal|unbalanced|imbalanc\w*|asymmetr\w*|uneven|irregular|sagg\w*|droop\w*|hollow\w*|deteriorat\w*|worse|unhealthy|damaged|dull|normal|typical|average|condition|disorder|disease|syndrome)\b/gi },
  { label: "enhancement", pattern: /\b(better|improv\w*|enhanc\w*|beautif\w*|attractive|stunning|striking|gorgeous|flattering|youthful|rejuvenat\w*|refresh\w*|sculpt\w*|lifted|firmer|smoother|radiant|glow\w*|ideal|perfect\w*|best|natural-looking)\b/gi },
  { label: "promise", pattern: /\b(will|would|definitely|certainly|clearly|proves?|confirms?|guarantee\w*|ensures?|demonstrates?)\b/gi },
  { label: "markup", pattern: /[<>`]|\]\(|\*\*|__|^#{1,6}\s|https?:\/\/|www\.|javascript:/gim },
];

const REPORT_KEYS = ["overview", "priorities", "sections", "opportunities", "limitations", "clinicianReview", "cta"];
const NUMBER = /\d+(?:[.,–-]\d+)*/g;

const termsOf = (text: string, pattern: RegExp): Set<string> => new Set([...text.matchAll(new RegExp(pattern.source, pattern.flags))].map((m) => m[0].toLowerCase()));

/** Things `after` says that `before` did not: new lexicon terms, new numbers, or runaway length. */
export function introducedClaims(before: string, after: string): string[] {
  const out: string[] = [];
  for (const { label, pattern } of LEXICON) {
    const had = termsOf(before, pattern);
    for (const t of termsOf(after, pattern)) if (!had.has(t)) out.push(`${label} "${t}"`);
  }
  const hadNumbers = new Set(before.match(NUMBER) ?? []);
  for (const n of after.match(NUMBER) ?? []) if (!hadNumbers.has(n)) out.push(`number "${n}"`);
  if (after.length > Math.max(before.length * 1.6, before.length + 120)) out.push("much longer than the draft");
  return out;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const refKey = (r: { sourceType?: unknown; sourceId?: unknown }) => `${String(r.sourceType)}:${String(r.sourceId)}`;
const refSet = (refs: unknown): string[] => (Array.isArray(refs) ? refs.filter(isObj).map(refKey).sort() : ["<malformed>"]);

/** A candidate object may not carry fields the draft does not have (e.g. a smuggled `consumerReady`). */
const sameKeys = (draft: object, candidate: object) => same(Object.keys(draft).sort(), Object.keys(candidate).sort());

function checkStatement(draft: ReportStatement, candidate: unknown, where: string, out: string[]) {
  if (!isObj(candidate)) return void out.push(`${where}: statement is missing or malformed`);
  if (!sameKeys(draft, candidate)) out.push(`${where}: fields were added or removed`);
  if (candidate.id !== draft.id) out.push(`${where}: statement id changed`);
  if (!same(refSet(candidate.evidenceRefs), refSet(draft.evidenceRefs))) out.push(`${where}: evidence references were added, removed or changed`);
  if (candidate.sourceType !== draft.sourceType) out.push(`${where}: sourceType changed`);
  if (candidate.confidence !== draft.confidence) out.push(`${where}: confidence changed`);
  if (typeof candidate.text !== "string" || candidate.text.trim() === "") return void out.push(`${where}: text is missing`);
  if (draft.sourceType === "limitation") {
    if (candidate.text !== draft.text) out.push(`${where}: a limitation was reworded`);
    return;
  }
  for (const claim of introducedClaims(draft.text, candidate.text)) out.push(`${where}: introduces ${claim}`);
}

/** Every reason `candidate` is not an allowed rewording of `draft`. Empty means it is. Never throws. */
export function findAiReportViolations(draft: MogaFaceReport, candidate: unknown): string[] {
  const out: string[] = [];
  if (!isObj(candidate)) return ["report is missing or malformed"];
  for (const key of Object.keys(candidate)) if (!REPORT_KEYS.includes(key)) out.push(`unexpected field "${key}"`);

  checkStatement(draft.overview, candidate.overview, "overview", out);

  if (!Array.isArray(candidate.priorities) || candidate.priorities.length !== draft.priorities.length) out.push("priorities: count changed");
  else
    draft.priorities.forEach((p, i) => {
      const c: unknown = (candidate.priorities as unknown[])[i];
      if (!isObj(c)) return void out.push(`priorities[${i}]: malformed`);
      if (!sameKeys(p, c)) out.push(`priorities[${i}]: fields were added or removed`);
      if (c.id !== p.id || c.concern !== p.concern || c.status !== p.status) out.push(`priorities[${i}]: id, concern or status changed`);
      checkStatement(p.why, c.why, `priorities[${i}].why`, out);
      checkStatement(p.evidence, c.evidence, `priorities[${i}].evidence`, out);
    });

  const sections = isObj(candidate.sections) ? candidate.sections : {};
  for (const key of ALL_SECTIONS) {
    const d = draft.sections[key];
    const c = sections[key];
    if (d === null) {
      if (c !== null && c !== undefined) out.push(`sections.${key}: a section that has no evidence was added`);
      continue;
    }
    if (c === undefined) continue; // not returned: the draft is kept unchanged
    if (!isObj(c)) {
      out.push(`sections.${key}: removed or malformed`);
      continue;
    }
    if (c.basis !== d.basis || c.howAssessed !== d.howAssessed) out.push(`sections.${key}: basis or method note changed`);
    if (!(AI_EDITABLE_SECTIONS as readonly string[]).includes(key)) {
      if (!same(c.statements, d.statements)) out.push(`sections.${key}: a section that is not sent for rewording changed`);
      continue;
    }
    const statements = Array.isArray(c.statements) ? c.statements.filter(isObj) : [];
    const byId = new Map(statements.map((s) => [String(s.id), s]));
    if (statements.length !== d.statements.length || byId.size !== d.statements.length) out.push(`sections.${key}: statements were added or removed`);
    for (const s of d.statements) checkStatement(s, byId.get(s.id), `sections.${key}.${s.id}`, out); // order within a section may change
  }

  if (!Array.isArray(candidate.opportunities) || candidate.opportunities.length !== draft.opportunities.length) out.push("opportunities: count changed");
  else
    draft.opportunities.forEach((o, i) => {
      const c: unknown = (candidate.opportunities as unknown[])[i];
      if (!isObj(c)) return void out.push(`opportunities[${i}]: malformed`);
      if (!sameKeys(o, c)) out.push(`opportunities[${i}]: fields were added or removed`);
      for (const f of ["id", "area", "title", "status", "category", "clinicianCanEvaluate"] as const) if (c[f] !== o[f]) out.push(`opportunities[${i}]: ${f} changed`);
      if (!same(c.evidenceLines, o.evidenceLines)) out.push(`opportunities[${i}]: evidence lines changed`);
      checkStatement(o.why, c.why, `opportunities[${i}].why`, out);
    });

  if (candidate.limitations !== undefined && !same(candidate.limitations, draft.limitations)) out.push("limitations changed");
  if (candidate.clinicianReview !== undefined && candidate.clinicianReview !== draft.clinicianReview) out.push("clinician review copy changed");
  if (candidate.cta !== undefined && !same(candidate.cta, draft.cta)) out.push("call to action changed");
  return out;
}
