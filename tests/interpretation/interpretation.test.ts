import { test } from "node:test";
import assert from "node:assert/strict";
import { buildInterpretation, buildInterpretationInput, CONSUMER_LIMITATIONS } from "../../lib/interpretation/build.ts";
import { validateInterpretation } from "../../lib/interpretation/validate.ts";
import { INTERPRETATION_VERSION } from "../../lib/interpretation/versions.ts";
import { serializeEvidenceForModel, buildInterpretationPrompt, INTERPRETATION_SYSTEM_PROMPT } from "../../lib/interpretation/prompts.ts";
import { createAiInterpretationProvider, createLocalRulesProvider, interpretWithFallback, ProviderNotConfigured } from "../../lib/interpretation/provider.ts";
import { findForbiddenLanguage } from "../../lib/safety/language.ts";
import { createEmptyAssessment } from "../../lib/assessment/defaults.ts";
import type { InterpretationInput, InterpretationResult } from "../../lib/interpretation/types.ts";
import { assessmentWith, inputFor, userReported } from "../results/fixtures.ts";

const CAL = { calibrated: true };
const build = (input: InterpretationInput, options = {}) => buildInterpretation(input, options);
const area = (r: InterpretationResult, a: string) => r.opportunities.find((o) => o.area === a);
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

// ---- supported observations → valid, traceable statements ----

test("supported evidence → a valid statement with evidence references that resolve to the input", () => {
  const { input } = inputFor(assessmentWith({ selected: ["FACIAL_DEFINITION"], details: ["JAW_DEFINITION"] }), { open: true });
  const r = build(input, CAL);
  const def = area(r, "facial_definition")!;
  assert.equal(def.status, "discuss");
  assert.equal(def.category, "FACIAL_CONTOURING");
  assert.equal(
    def.statement,
    "Your assessment identified facial contour characteristics relevant to your goal of a more defined appearance. Facial contouring options may be worth discussing with your clinician.",
  );
  const types = new Set(def.evidence.map((e) => e.sourceType));
  assert.deepEqual([...types].sort(), ["questionnaire", "treatment_opportunity", "visual_observation"]);
  assert.ok(def.evidence.some((e) => e.sourceId === "user_reports_facial_definition_goal"));
  assert.deepEqual(validateInterpretation(r, input, CAL), []);
});

test("the example statements from the brief: questionnaire and visual observation sources", () => {
  const { input } = inputFor(assessmentWith({ selected: ["FACIAL_DEFINITION"] }), { open: true });
  const r = build(input, CAL);
  const stmt = r.facialStructure.statements.find((s) => s.statement === "The assessment detected measurable facial contour geometry.")!;
  assert.ok(stmt.evidence.every((e) => e.sourceType === "visual_observation" && e.sourceId.startsWith("facialStructure.contour.")));
  assert.ok(area(r, "facial_definition")!.evidence.some((e) => e.sourceType === "questionnaire" && e.sourceId === "user_reports_facial_definition_goal"));
});

test("facial lines: consumer-ready video line evidence → the neuromodulator-consultation wording (never 'need')", () => {
  const { input } = inputFor(assessmentWith({ selected: ["FACIAL_LINES"], details: ["FOREHEAD_LINES"] }), { withVideoLines: true, open: true });
  const lines = area(build(input, CAL), "facial_lines")!;
  assert.equal(lines.status, "discuss");
  assert.equal(lines.statement, "Expression-related facial lines were observed during the assessment. A neuromodulator consultation may be worth discussing with your clinician.");
  assert.deepEqual(findForbiddenLanguage(lines.statement), []);
});

test("under-eye: a usable dark-looking observation → observation-only wording, no diagnosis, no treatment", () => {
  const { input } = inputFor(assessmentWith({ selected: ["UNDER_EYE"] }), { open: true });
  const r = build(input, CAL);
  const u = area(r, "under_eye")!;
  assert.equal(u.status, "observation_only");
  assert.equal(u.category, null);
  assert.equal(u.statement, "Your assessment identified a visible difference in under-eye appearance relative to nearby facial skin.");
  assert.ok(u.evidence.some((e) => e.sourceId === "eyeArea.visibleUnderEyeDarkness"));
  assert.deepEqual(validateInterpretation(r, input, CAL), []);
});

test("skin: questionnaire only — no visual evidence is cited", () => {
  const { input } = inputFor(assessmentWith({ selected: ["SKIN_TONE"] }));
  const r = build(input);
  const skin = area(r, "skin")!;
  assert.equal(skin.status, "discuss");
  assert.equal(skin.statement, "Your responses indicate skin-related concerns that may be worth assessing with your clinician.");
  assert.ok(skin.evidence.every((e) => e.sourceType !== "visual_observation"));
});

// ---- missing evidence → insufficient evidence (spec strings) ----

test("missing evidence → insufficient evidence, with the specified wording, never a recommendation", () => {
  const { input } = inputFor(assessmentWith({ selected: ["FACIAL_VOLUME", "FACIAL_LIFTING", "FACIAL_LINES"] }));
  const r = build(input);
  assert.equal(area(r, "facial_volume")!.statement, "We couldn't establish enough visual evidence to interpret facial volume from these images.");
  assert.equal(area(r, "facial_lifting")!.statement, "Your goal was recorded, but the current assessment does not have enough visual evidence to evaluate lifting-related changes.");
  assert.equal(area(r, "facial_lines")!.statement, "We couldn't establish enough visual evidence to interpret facial lines from these images.");
  for (const a of ["facial_volume", "facial_lifting", "facial_lines"]) {
    assert.equal(area(r, a)!.status, "insufficient_evidence");
    assert.equal(area(r, a)!.category, null);
  }
  assert.deepEqual(validateInterpretation(r, input), []);
});

test("a questionnaire answer alone never becomes a treatment area (volume without evidence)", () => {
  const { input } = inputFor(assessmentWith({ selected: ["FACIAL_VOLUME"], details: ["CHEEK_FULLNESS"] }));
  assert.equal(area(build(input), "facial_volume")!.status, "insufficient_evidence");
});

test("lifting stays insufficient even when the gate is open and every other observation exists", () => {
  const { input } = inputFor(assessmentWith({ selected: ["FACIAL_LIFTING"] }), { withVideoLines: true, open: true });
  const l = area(build(input, CAL), "facial_lifting")!;
  assert.equal(l.status, "insufficient_evidence");
  assert.doesNotMatch(l.statement, /laxity|sagging|lifted appearance/i);
});

test("uncalibrated visual evidence is not stated to a consumer: gated opportunities become 'not enough evidence'", () => {
  const { input } = inputFor(assessmentWith({ selected: ["FACIAL_DEFINITION", "UNDER_EYE"] }), { withVideoLines: true }); // engine's real consumerReady (false for contour)
  const r = build(input); // calibration flag is false
  assert.equal(area(r, "facial_definition")!.status, "insufficient_evidence");
  assert.equal(area(r, "under_eye")!.status, "insufficient_evidence");
  assert.equal(r.facialStructure.statements.some((s) => /contour/.test(s.statement)), false);
  assert.ok(!r.evidence.some((e) => e.sourceId.startsWith("facialStructure.contour.") || e.sourceId.startsWith("expression.")));
});

// ---- unsupported claims are rejected structurally ----

function valid() {
  const { input } = inputFor(assessmentWith({ selected: ["FACIAL_DEFINITION"] }), { open: true });
  return { input, result: build(input, CAL) };
}

test("an unsupported observation is rejected: a statement citing an observation that is not in the input", () => {
  const { input, result } = valid();
  const bad = clone(result);
  bad.facialStructure.statements.push({ id: "x", statement: "The assessment measured something.", evidence: [{ sourceType: "visual_observation", sourceId: "facialStructure.doesNotExist" }] });
  assert.match(validateInterpretation(bad, input, CAL).join(), /does not exist in the input/);
});

test("a statement with no evidence is rejected", () => {
  const { input, result } = valid();
  const bad = clone(result);
  bad.skin.statements.push({ id: "x", statement: "Nice skin.", evidence: [] });
  assert.match(validateInterpretation(bad, input, CAL).join(), /no evidence \(unsupported\)/);
});

test("a visual observation that is uncalibrated is rejected as evidence for a consumer statement", () => {
  const { input, result } = valid();
  assert.deepEqual(validateInterpretation(result, input, CAL), []);
  assert.match(validateInterpretation(result, input).join(), /not consumer-usable/); // same result, gate closed
});

test("an unsupported treatment is rejected: 'discuss' without a backing consumer-ready opportunity, or with the wrong category", () => {
  const { input, result } = valid();
  const noBacking = clone(result);
  const def = noBacking.opportunities.find((o) => o.area === "facial_definition")!;
  def.evidence = def.evidence.filter((e) => e.sourceType !== "treatment_opportunity");
  assert.match(validateInterpretation(noBacking, input, CAL).join(), /not backed by a treatment opportunity/);

  const wrongCategory = clone(result);
  wrongCategory.opportunities.find((o) => o.area === "facial_definition")!.category = "DERMAL_FILLER";
  assert.match(validateInterpretation(wrongCategory, input, CAL).join(), /unsupported treatment/);

  const notReady = clone(input);
  notReady.opportunities = notReady.opportunities.map((o) => ({ ...o, consumerReady: false }));
  assert.match(validateInterpretation(result, notReady, CAL).join(), /not consumer-ready/);
});

test("naming a treatment in a statement without an opportunity reference is rejected", () => {
  const { input, result } = valid();
  const bad = clone(result);
  bad.skin.statements.push({ id: "x", statement: "Dermal filler options exist.", evidence: [{ sourceType: "assessment", sourceId: input.assessmentId }] });
  assert.match(validateInterpretation(bad, input, CAL).join(), /names a treatment without a backing treatment opportunity/);
});

test("non-'discuss' items may not carry a treatment category", () => {
  const { input, result } = valid();
  const bad = clone(result);
  bad.opportunities[0].status = "insufficient_evidence";
  assert.match(validateInterpretation(bad, input, CAL).join(), /only "discuss" items may carry a treatment category/);
});

test("diagnosis wording, 'you need Botox', attractiveness and other score claims are rejected anywhere in the result", () => {
  const { input, result } = valid();
  const cases: [string, RegExp][] = [
    ["You need Botox for this.", /need claim|brand name/],
    ["You should get fillers.", /should-get claim/],
    ["You are suitable for filler.", /suitability claim/],
    ["You are a candidate for threads.", /candidacy claim/],
    ["This is a diagnosis of a medical condition.", /diagnosis/],
    ["You have a medical condition.", /medical condition/],
    ["Your attractiveness score is high.", /attractiveness claim|score/],
    ["Your beauty score is 8.", /attractiveness claim|score/],
    ["An ideal face is symmetrical.", /ideal comparison/],
    ["You have a perfect face.", /ideal comparison/],
    ["Your aging score is low.", /aging claim|score/],
    ["Your face is 92% symmetrical.", /percentage/],
    ["Tear trough hollowing from a fat pad.", /anatomical cause/],
    ["Signs of hyperpigmentation.", /named condition/],
  ];
  for (const [text, expected] of cases) {
    const bad = clone(result);
    bad.skin.statements.push({ id: "x", statement: text, evidence: [{ sourceType: "assessment", sourceId: input.assessmentId }] });
    assert.match(validateInterpretation(bad, input, CAL).join(), expected, text);
  }
  const badSummary = clone(result);
  badSummary.summary.statement = "You need to see a clinician.";
  assert.match(validateInterpretation(badSummary, input, CAL).join(), /summary: forbidden language/);
  const badLimit = clone(result);
  badLimit.limitations.push("Your beauty score was not computed.");
  assert.match(validateInterpretation(badLimit, input, CAL).join(), /limitations\[\d+\]: forbidden language/);
});

test("every phrase the brief lists is forbidden", () => {
  for (const p of ["you need", "you should get", "you are suitable for", "you are a candidate for", "diagnosis", "medical condition", "attractiveness score", "beauty score", "ideal face", "perfect face", "aging score"]) {
    assert.ok(findForbiddenLanguage(`... ${p} ...`).length > 0, p);
  }
});

test("clinicianReviewRequired must be true and is always true from the builder", () => {
  const { input, result } = valid();
  assert.equal(result.clinicianReviewRequired, true);
  assert.match(validateInterpretation({ ...result, clinicianReviewRequired: false }, input, CAL).join(), /clinicianReviewRequired must be true/);
});

test("malformed interpretation never throws", () => {
  const { input } = valid();
  for (const v of [null, undefined, 3, "x", [], {}]) {
    assert.doesNotThrow(() => validateInterpretation(v, input));
    assert.ok(validateInterpretation(v, input).length > 0);
  }
});

// ---- the built result ----

test("every statement in a built result has evidence and every reference resolves (all sections, priorities, opportunities)", () => {
  const a = assessmentWith({ selected: ["FACIAL_DEFINITION", "SKIN_TONE", "UNDER_EYE", "FACIAL_LINES"], priorities: ["FACIAL_DEFINITION", "SKIN_TONE"] });
  const { input } = inputFor(a, { withVideoLines: true, open: true });
  const r = build(input, CAL);
  assert.deepEqual(validateInterpretation(r, input, CAL), []);
  const all = [r.summary, ...r.facialStructure.statements, ...r.eyeArea.statements, ...r.skin.statements, ...r.hair.statements, ...r.facialHair.statements, ...r.lifestyle.statements, ...r.style.statements];
  assert.ok(all.every((s) => s.evidence.length > 0));
  assert.ok(r.evidence.length > 0 && r.evidence.every((e) => e.label.length > 0));
  assert.equal(r.version, INTERPRETATION_VERSION);
  assert.deepEqual(r.limitations, CONSUMER_LIMITATIONS);
});

test("priorities: explicit priorities first (max 3), consumer wording, NOT_SURE ignored", () => {
  const { input } = inputFor(assessmentWith({ selected: ["FACIAL_DEFINITION", "SKIN_TONE", "FACIAL_BALANCE", "FACIAL_LINES"], priorities: ["FACIAL_DEFINITION", "SKIN_TONE", "FACIAL_BALANCE"] }));
  assert.deepEqual(build(input).priorities.map((p) => p.label), ["A more defined appearance", "Skin tone", "Facial balance"]);
  const unsure = inputFor(assessmentWith({ selected: ["NOT_SURE"] })).input;
  assert.deepEqual(unsure.goals, []);
  assert.deepEqual(build(unsure).priorities, []);
});

test("summary: counts discussed areas; otherwise an honest 'not enough evidence' summary that still cites something real", () => {
  const some = build(inputFor(assessmentWith({ selected: ["SKIN_TONE"] })).input);
  assert.equal(some.summary.statement, "Your assessment highlighted one area you may want to discuss with your clinician.");
  const none = inputFor(assessmentWith({}));
  const r = build(none.input);
  assert.match(r.summary.statement, /isn't enough information/);
  assert.deepEqual(r.summary.evidence, [{ sourceType: "assessment", sourceId: none.input.assessmentId }]);
  assert.deepEqual(validateInterpretation(r, none.input), []);
});

test("user-reported sections (hair, facial hair, lifestyle, style) are questionnaire-sourced", () => {
  const { input } = inputFor(assessmentWith({ selected: ["SKIN_TONE"] }));
  input.observations.push(userReported("hair.concerns", ["hairline", "other"]), userReported("facialHair.improvements", ["shape", "notApplicable"], "facial-hair"), userReported("lifestyle.sleepHours", "6to7", "lifestyle"), userReported("style.styleGoals", ["clean"], "style"));
  const r = build(input);
  assert.equal(r.hair.statements[0].statement, "You noted hair concerns: hairline.");
  assert.equal(r.facialHair.statements[0].statement, "You noted facial hair goals: shape.");
  assert.ok(r.lifestyle.statements[0].evidence.every((e) => e.sourceType === "questionnaire"));
  assert.ok(r.style.statements.length === 1);
  assert.deepEqual(validateInterpretation(r, input), []);
});

test("deterministic: the same input produces the same statements", () => {
  const { input } = inputFor(assessmentWith({ selected: ["FACIAL_DEFINITION", "SKIN_TONE"] }), { open: true });
  const strip = (r: InterpretationResult) => JSON.stringify({ ...r, createdAt: "" });
  assert.equal(strip(build(input, CAL)), strip(build(input, CAL)));
});

// ---- input + providers ----

test("the provider input carries no age, gender, body measurements, photos or landmarks", () => {
  const a = assessmentWith({ selected: ["FACIAL_DEFINITION"] });
  a.profile = { ageYears: 61, genderPresentation: "female", heightCm: 163, weightKg: 58 };
  const { input } = inputFor(a);
  const text = JSON.stringify(input) + serializeEvidenceForModel(input) + JSON.stringify(buildInterpretationPrompt(input));
  for (const forbidden of ["ageYears", "genderPresentation", "heightCm", "weightKg", "\"61\"", "landmarks", "blob:"]) assert.ok(!text.includes(forbidden), forbidden);
  assert.ok(INTERPRETATION_SYSTEM_PROMPT.includes("STRUCTURED EVIDENCE"));
  assert.equal(buildInterpretationInput(createEmptyAssessment(), null, []).observations.length, 0);
});

test("the app works with no API key: the local provider needs nothing, the AI adapter refuses honestly", async () => {
  const { input } = inputFor(assessmentWith({ selected: ["SKIN_TONE"] }));
  assert.equal((await createLocalRulesProvider().interpret(input)).clinicianReviewRequired, true);
  await assert.rejects(() => createAiInterpretationProvider().interpret(input), ProviderNotConfigured);
  const outcome = await interpretWithFallback(createAiInterpretationProvider(), input);
  assert.equal(outcome.providerId, "local-rules");
  assert.match(outcome.fellBackBecause!, /No AI interpretation provider/);
  assert.deepEqual(validateInterpretation(outcome.result, input), []);
});

test("an AI provider's output is validated: valid output is used, invalid or throwing output falls back to the local rules", async () => {
  const { input } = inputFor(assessmentWith({ selected: ["SKIN_TONE"] }));
  const local = buildInterpretation(input);

  const good = createAiInterpretationProvider({ id: "test-model", complete: async () => JSON.stringify(local) });
  const used = await interpretWithFallback(good, input);
  assert.equal(used.providerId, "test-model");
  assert.equal(used.fellBackBecause, null);

  const evil = clone(local);
  evil.summary.statement = "You need Botox to fix your aging.";
  const bad = await interpretWithFallback(createAiInterpretationProvider({ id: "bad-model", complete: async () => JSON.stringify(evil) }), input);
  assert.equal(bad.providerId, "local-rules");
  assert.match(bad.fellBackBecause!, /invalid output/);

  const inventedEvidence = clone(local);
  inventedEvidence.skin.statements.push({ id: "z", statement: "Extra claim.", evidence: [{ sourceType: "visual_observation", sourceId: "made.up" }] });
  assert.equal((await interpretWithFallback(createAiInterpretationProvider({ complete: async () => JSON.stringify(inventedEvidence) }), input)).providerId, "local-rules");

  assert.equal((await interpretWithFallback(createAiInterpretationProvider({ complete: async () => "not json" }), input)).providerId, "local-rules");
  assert.equal((await interpretWithFallback(createAiInterpretationProvider({ complete: async () => { throw new Error("network"); } }), input)).providerId, "local-rules");
});
