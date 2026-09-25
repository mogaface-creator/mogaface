import { test } from "node:test";
import assert from "node:assert/strict";
import { buildInterpretation, buildInterpretationInput } from "../../lib/interpretation/build.ts";
import { validateInterpretation } from "../../lib/interpretation/validate.ts";
import { buildInterpretationPrompt, DRAFT_MARKER, INTERPRETATION_SYSTEM_PROMPT } from "../../lib/interpretation/prompts.ts";
import { createAiInterpretationProvider, interpretWithFallback } from "../../lib/interpretation/provider.ts";
import { selectInterpretationProvider } from "../../lib/interpretation/select.ts";
import { createRemoteInterpretationProvider } from "../../lib/interpretation/remote.ts";
import { REPORT_CTA } from "../../lib/interpretation/report.ts";
import { runResultPipeline } from "../../lib/results/pipeline.ts";
import { toReportView, formatReportDate } from "../../lib/results/reportView.ts";
import { buildDemoSnapshot } from "../../lib/results/demo.ts";
import { VISUAL_OBSERVATIONS_CALIBRATED } from "../../lib/facial-analysis/calibration/status.ts";
import { findForbiddenLanguage } from "../../lib/safety/language.ts";
import { createEmptyAssessment } from "../../lib/assessment/defaults.ts";
import type { InterpretationInput, InterpretationResult, MogaFaceReport, ReportStatement } from "../../lib/interpretation/types.ts";
import { assessmentWith, inputFor, snapshotFor } from "../results/fixtures.ts";

const CAL = { calibrated: true };
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const demoInput = () => {
  const s = buildDemoSnapshot();
  return { snapshot: s, input: buildInterpretationInput(s.assessment, s.analysis, s.opportunities) };
};
const statementsOf = (r: MogaFaceReport): ReportStatement[] => [
  r.overview,
  ...r.priorities.flatMap((p) => [p.why, p.evidence]),
  ...Object.values(r.sections).flatMap((s) => s?.statements ?? []),
  ...r.opportunities.map((o) => o.why),
];
const allStrings = (r: MogaFaceReport): string[] => [
  ...statementsOf(r).map((s) => s.text),
  ...r.priorities.map((p) => p.concern),
  ...r.opportunities.flatMap((o) => [o.title, o.clinicianCanEvaluate, ...o.evidenceLines]),
  ...r.limitations,
  r.clinicianReview,
  r.cta.heading,
  r.cta.supportingText,
];
const withStatement = (result: InterpretationResult, text: string, refs: ReportStatement["evidenceRefs"], sourceType: ReportStatement["sourceType"] = "limitation", confidence: ReportStatement["confidence"] = "limited") => {
  const bad = clone(result);
  bad.report.sections.skin.statements.push({ id: "x", text, evidenceRefs: refs, sourceType, confidence });
  return bad;
};

// ---- the report data model ----

test("report: every section exists and none is blank (demo evidence, gate open)", () => {
  const { input } = demoInput();
  const { report } = buildInterpretation(input, CAL);
  for (const key of ["facialStructure", "eyeArea", "skin", "hair", "facialHair", "lifestyle", "style"] as const) assert.ok(report.sections[key].statements.length > 0, key);
  assert.ok(report.sections.expression && report.sections.expression.statements.length > 0);
  assert.ok(report.priorities.length > 0 && report.priorities.length <= 3);
  assert.ok(report.opportunities.length > 0 && report.limitations.length > 0);
  assert.deepEqual(report.cta, REPORT_CTA);
  assert.equal(report.cta.heading, "Discuss Your Results With Your Clinician");
});

test("report: user-reported sections are worded as user-reported, descriptive, and never make conclusions", () => {
  const { input } = inputFor(assessmentWith({ selected: ["SKIN_TONE"] }));
  const { report } = buildInterpretation(input);
  const text = (k: keyof MogaFaceReport["sections"]) => report.sections[k]!.statements.map((s) => s.text).join(" ");
  assert.match(text("lifestyle"), /You reported sleeping 6–7 hours per night\./);
  assert.match(text("lifestyle"), /exercise 3–4 times per week, including strength training and cardio/);
  assert.match(text("hair"), /You described your hair as short and straight hair with medium density\./);
  assert.match(text("hair"), /You noted hair concerns: hairline and styling\./);
  assert.match(text("facialHair"), /current facial hair as stubble/);
  assert.match(text("style"), /smart casual/);
  for (const k of ["lifestyle", "hair", "facialHair", "style"] as const) {
    assert.ok(report.sections[k].statements.every((s) => s.sourceType === "user_reported" && s.confidence === "complete"), k);
    assert.equal(report.sections[k].basis, "user_reported");
  }
  assert.doesNotMatch(text("lifestyle"), /because|causing|leads to|affects/i);
  assert.equal(report.sections.hair.statements.some((s) => /textured crop/.test(s.text)), false, "free-text answers are not echoed");
});

test("report: skin separates 'your assessment reports' from what MogaFace can analyze, and never invents a skin observation", () => {
  const { input } = inputFor(assessmentWith({ selected: ["SKIN_TEXTURE", "PIGMENTATION"] }));
  const skin = buildInterpretation(input).report.sections.skin;
  assert.match(skin.statements[0].text, /^Your assessment reports skin-related concerns: skin texture and evenness of skin colour\.$/);
  assert.equal(skin.statements[0].sourceType, "user_reported");
  assert.match(skin.statements[1].text, /does not yet analyze skin from photographs/);
  assert.ok(skin.statements.every((s) => s.evidenceRefs.every((e) => e.sourceType !== "visual_observation")));
  assert.equal(skin.basis, "user_reported");
});

// ---- provenance ----

test("provenance: every factual statement has at least one evidence reference and every reference resolves", () => {
  for (const { input } of [demoInput(), inputFor(assessmentWith({ selected: ["FACIAL_DEFINITION", "UNDER_EYE", "SKIN_TONE"] }), { open: true, withVideoLines: true })]) {
    const result = buildInterpretation(input, CAL);
    assert.deepEqual(validateInterpretation(result, input, CAL), []);
    const statements = statementsOf(result.report);
    assert.ok(statements.length > 10);
    for (const s of statements) {
      assert.ok(s.evidenceRefs.length > 0, s.text);
      assert.ok(["complete", "partial", "limited"].includes(s.confidence), s.text);
    }
  }
});

test("provenance: the source type matches the evidence (observed → a visual observation; opportunity → an opportunity; user-reported → neither)", () => {
  const { input } = demoInput();
  for (const s of statementsOf(buildInterpretation(input, CAL).report)) {
    const types = new Set(s.evidenceRefs.map((e) => e.sourceType));
    if (s.sourceType === "observed") assert.ok(types.has("visual_observation"), s.text);
    if (s.sourceType === "opportunity") assert.ok(types.has("treatment_opportunity"), s.text);
    if (s.sourceType === "user_reported") assert.ok(!types.has("visual_observation") && !types.has("treatment_opportunity"), s.text);
    if (s.sourceType === "limitation") assert.equal(s.confidence, "limited", s.text);
  }
});

test("validation rejects: no evidence, an invented reference, a wrong source type, and a hidden treatment claim", () => {
  const { input } = demoInput();
  const good = buildInterpretation(input, CAL);
  const assessmentRef = [{ sourceType: "assessment" as const, sourceId: input.assessmentId }];

  assert.match(validateInterpretation(withStatement(good, "Something.", []), input, CAL).join(), /no evidence \(unsupported\)/);
  assert.match(validateInterpretation(withStatement(good, "Something.", [{ sourceType: "visual_observation", sourceId: "facialStructure.invented" }]), input, CAL).join(), /does not exist in the input/);
  assert.match(validateInterpretation(withStatement(good, "Something.", assessmentRef, "observed", "partial"), input, CAL).join(), /observed statement needs a visual observation reference/);
  assert.match(validateInterpretation(withStatement(good, "Something.", assessmentRef, "opportunity", "partial"), input, CAL).join(), /needs a treatment opportunity reference/);
  assert.match(validateInterpretation(withStatement(good, "Something.", assessmentRef, "limitation", "complete"), input, CAL).join(), /limitation statement must be low-evidence/);
  assert.match(validateInterpretation(withStatement(good, "Something.", assessmentRef, "wat" as never, "partial"), input, CAL).join(), /invalid sourceType/);
  assert.match(validateInterpretation(withStatement(good, "Something.", assessmentRef, "limitation", "wat" as never), input, CAL).join(), /invalid confidence/);
  assert.match(validateInterpretation(withStatement(good, "Dermal filler options exist.", assessmentRef), input, CAL).join(), /names a treatment without a backing treatment opportunity/);
  const dropped = clone(good);
  (dropped as { report: unknown }).report = undefined;
  assert.match(validateInterpretation(dropped, input, CAL).join(), /report must be an object/);
});

test("validation rejects unsupported treatment claims: a report that changes an area's decision is refused", () => {
  const { input } = inputFor(assessmentWith({ selected: ["FACIAL_VOLUME"] }));
  const good = buildInterpretation(input);
  const volume = good.report.opportunities.find((o) => o.area === "facial_volume")!;
  assert.equal(volume.status, "insufficient_evidence");

  const promoted = clone(good);
  const p = promoted.report.opportunities.find((o) => o.area === "facial_volume")!;
  p.status = "discuss";
  p.why = { ...p.why, sourceType: "opportunity", text: "Facial fullness may be worth discussing with your clinician." };
  assert.match(validateInterpretation(promoted, input).join(), /differs from the interpretation opportunity|only an insufficient-evidence area/);

  const retitled = clone(good);
  retitled.report.opportunities[0].category = "DERMAL_FILLER";
  assert.match(validateInterpretation(retitled, input).join(), /differs from the interpretation opportunity/);

  const reprioritised = clone(good);
  reprioritised.report.priorities.push({ ...reprioritised.report.priorities[0] });
  assert.match(validateInterpretation(reprioritised, input).join(), /priorities must match|at most 3/);
});

test("forbidden language is rejected anywhere in the report: every phrase from the brief", () => {
  const { input } = demoInput();
  const good = buildInterpretation(input, CAL);
  const assessmentRef = [{ sourceType: "assessment" as const, sourceId: input.assessmentId }];
  const phrases = [
    "You need Botox.", "You need filler.", "You are suitable for filler.", "You are a candidate for Botox.", "You should get threads.",
    "You have facial laxity.", "You have a medical condition.", "Your face is attractive.", "Your beauty score is high.", "Your attractiveness score is 8.",
    "You are 20% more attractive.", "Your face scores 84/100.", "You will look better.", "You will become more attractive.", "Signs of aging.",
    "The dose is 20 units.", "A clinician will prescribe this.",
  ];
  for (const text of phrases) assert.ok(validateInterpretation(withStatement(good, text, assessmentRef), input, CAL).length > 0, text);
  const bad = clone(good);
  bad.report.overview.text = "You need to book now.";
  bad.report.cta.supportingText = "You should get this done.";
  bad.report.limitations.push("Your beauty score was not computed.");
  bad.report.opportunities[0].clinicianCanEvaluate = "You are a candidate for fillers.";
  const problems = validateInterpretation(bad, input, CAL).join();
  for (const where of ["report.overview", "report.cta.supportingText", "report.limitations", "clinicianCanEvaluate"]) assert.match(problems, new RegExp(where.replace(".", "\\.")));
});

test("the language rules allow the cautious wording the report uses", () => {
  const { input } = demoInput();
  const good = buildInterpretation(input, CAL);
  const assessmentRef = [{ sourceType: "assessment" as const, sourceId: input.assessmentId }];
  for (const text of [
    "This may be worth discussing with your clinician.",
    "This is an area to explore with your clinician.",
    "Based on the available evidence, this area was recorded.",
    "Your assessment indicates that skin tone matters to you.",
    "The analysis identified visible line patterns in the forehead area.",
    "Not enough visual evidence was available to assess this area.",
  ]) {
    assert.deepEqual(findForbiddenLanguage(text), [], text);
    assert.deepEqual(validateInterpretation(withStatement(good, text, assessmentRef), input, CAL), [], text);
  }
  for (const text of allStrings(good.report)) assert.deepEqual(findForbiddenLanguage(text), [], text);
});

// ---- missing evidence ----

test("missing evidence: an empty assessment yields honest limitation statements, not blank or generic sections", () => {
  const assessment = createEmptyAssessment();
  const input = buildInterpretationInput(assessment, null, []);
  const result = buildInterpretation(input);
  assert.deepEqual(validateInterpretation(result, input), []);
  const { report } = result;
  assert.equal(report.sections.expression, null);
  assert.equal(report.overview.sourceType, "limitation");
  for (const key of ["facialStructure", "eyeArea", "skin", "hair", "facialHair", "lifestyle", "style"] as const) {
    const sec = report.sections[key];
    assert.ok(sec.statements.length > 0 && sec.statements.every((s) => s.sourceType === "limitation"), key);
    assert.equal(sec.basis, "not_assessed");
    assert.equal(sec.howAssessed, null);
  }
  assert.match(report.sections.facialStructure.statements[0].text, /No reliable visual evidence was available/);
  assert.deepEqual(report.priorities, []);
});

test("missing evidence: a goal with no visual support is 'not enough visual evidence', never an observation or a treatment area", () => {
  const { input } = inputFor(assessmentWith({ selected: ["FACIAL_DEFINITION", "FACIAL_LIFTING"], priorities: ["FACIAL_DEFINITION"] }), { withVideoLines: true }); // gate closed
  const { report } = buildInterpretation(input);
  const def = report.priorities[0];
  assert.equal(def.status, "recorded");
  assert.equal(def.evidence.text, "Not enough visual evidence was available to assess this area.");
  assert.equal(def.evidence.sourceType, "limitation");
  for (const o of report.opportunities) {
    assert.equal(o.status, "insufficient_evidence");
    assert.equal(o.clinicianCanEvaluate, "Additional clinical assessment would be needed.");
    assert.equal(o.why.sourceType, "limitation");
  }
});

// ---- consumer readiness ----

test("readiness: with the real (closed) gate the report never states uncalibrated evidence and has no expression section", () => {
  assert.equal(VISUAL_OBSERVATIONS_CALIBRATED, false);
  const { input } = inputFor(assessmentWith({ selected: ["FACIAL_DEFINITION", "FACIAL_LINES", "UNDER_EYE"] }), { withVideoLines: true });
  const result = buildInterpretation(input);
  assert.deepEqual(validateInterpretation(result, input), []);
  assert.equal(result.report.sections.expression, null);
  const refs = statementsOf(result.report).flatMap((s) => s.evidenceRefs);
  assert.ok(!refs.some((e) => e.sourceId.startsWith("expression.") || e.sourceId.startsWith("facialStructure.contour.") || e.sourceId.startsWith("eyeArea.underEye") || e.sourceId.startsWith("eyeArea.visibleUnderEye")));
  assert.ok(result.report.opportunities.every((o) => o.status === "insufficient_evidence"));
  assert.equal(result.report.sections.eyeArea.statements.some((s) => /under-eye appearance relative/.test(s.text)), false);
});

test("readiness: a report built with the gate open is rejected when checked against the closed gate", () => {
  const { input } = demoInput();
  const opened = buildInterpretation(input, CAL);
  assert.deepEqual(validateInterpretation(opened, input, CAL), []);
  assert.match(validateInterpretation(opened, input).join(), /not consumer-usable/);
});

test("readiness: the expression section appears only with valid expression evidence, and its treatment-adjacent line only with a backing opportunity", () => {
  const withOpp = buildInterpretation(demoInput().input, CAL).report.sections.expression!;
  assert.match(withOpp.statements[0].text, /^During the recorded expressions, visible line patterns were observed in the forehead area\.$/);
  const last = withOpp.statements.at(-1)!;
  assert.match(last.text, /this may be an area worth discussing with your clinician/);
  assert.equal(last.sourceType, "opportunity");

  const { input } = inputFor(assessmentWith({ selected: ["SKIN_TONE"] }), { withVideoLines: true, open: true });
  input.opportunities = input.opportunities.filter((o) => o.category !== "NEUROMODULATOR");
  const noOpp = buildInterpretation(input, CAL).report.sections.expression!;
  assert.ok(noOpp.statements.every((s) => !/worth discussing/.test(s.text)));
});

// ---- demo mode ----

test("demo: the report is complete, marked synthetic, and does not touch the real gate", async () => {
  const { snapshot } = demoInput();
  assert.equal(snapshot.isDemo, true);
  assert.equal(VISUAL_OBSERVATIONS_CALIBRATED, false);
  const result = await runResultPipeline(snapshot, { imageProvider: null, calibrated: true });
  const view = toReportView(result, snapshot.frontPhoto!.ref);
  assert.equal(view.cover.title, "Your Personalized Appearance Analysis");
  assert.equal(view.cover.badge, "AI-assisted analysis");
  assert.equal(view.sections.length, 8);
  assert.ok(view.sections.every((s) => s.basis !== "not_assessed"), "the synthetic demo answers fill every section");
  assert.ok(view.areas.length >= 3);
  assert.equal(view.priorities.length, 3);
  assert.ok(view.priorities.every((p) => p.why && p.evidence && p.statusLabel));
  assert.ok(view.notEstablished.length > 0);
  assert.deepEqual(view.cta, REPORT_CTA);
  assert.equal(view.footer.tagline, "AI-assisted appearance analysis for consultation preparation.");
});

// ---- the consumer view ----

test("report view exposes NONE of: evidence ids, raw numbers, thresholds, calibration, versions, debug", async () => {
  const { snapshot } = demoInput();
  const result = await runResultPipeline(snapshot, { imageProvider: null, calibrated: true });
  const text = JSON.stringify(toReportView(result, snapshot.frontPhoto!.ref), (_k, v) => (typeof v === "string" && v.startsWith("data:") ? "<image>" : v))
    .replaceAll("Based on facial landmarks detected", "Based on facial features detected"); // plain-language method note, not landmark data
  const leaks = [
    /user_reports_/, /facialStructure\./, /eyeArea\./, /expression\./, /video_frame/, /hair\.(length|concerns)/, /lifestyle\./, /treatment_opportunity/, /visual_observation/,
    /consumerReady/i, /calibrat/i, /threshold/i, /methodology/i, /"version"/i, /landmark/i, /symmetry/i, /uncalibrated/i, /evidenceRefs?/i, /sourceId/i, /sourceType/i,
    /NEUROMODULATOR|DERMAL_FILLER|FACIAL_CONTOURING|FACIAL_LIFTING|SKIN_TREATMENT/, /\d+\.\d{2,}/, /\d\s?%/, /debug/i, /\bscore/i,
  ];
  for (const l of leaks) assert.doesNotMatch(text, l, String(l));
});

test("report view: every string is free of forbidden language, and an offending string is dropped, not shown", async () => {
  const { snapshot } = demoInput();
  const result = await runResultPipeline(snapshot, { imageProvider: null, calibrated: true });
  const clean = toReportView(result, "x");
  const strings = [clean.overview, clean.clinicianReview, ...clean.limitations, ...clean.priorities.flatMap((p) => [p.concern, p.why, p.evidence]), ...clean.sections.flatMap((s) => s.statements.map((x) => x.text)), ...clean.areas.flatMap((a) => [a.title, a.why, a.clinicianCanEvaluate, ...a.evidence])];
  for (const s of strings) assert.deepEqual(findForbiddenLanguage(s), [], s);

  result.interpretation.report.sections.hair.statements.push({ id: "x", text: "You need Botox.", evidenceRefs: [], confidence: "limited", sourceType: "limitation" });
  result.interpretation.report.sections.style.statements = [{ id: "y", text: "Your face is attractive.", evidenceRefs: [], confidence: "limited", sourceType: "limitation" }];
  const view = toReportView(result, "x");
  assert.ok(!JSON.stringify(view).includes("Botox") && !JSON.stringify(view).includes("attractive"));
  const style = view.sections.find((s) => s.key === "style")!;
  assert.deepEqual([style.basis, style.statements[0].text], ["not_assessed", "No reliable visual evidence was available for this area."], "a section never goes blank");
});

test("report view: the date comes from assessment metadata only, and the visualization placeholder consumes the plan", async () => {
  assert.equal(formatReportDate("2026-09-25T10:00:00.000Z"), "25 September 2026");
  assert.equal(formatReportDate(undefined), null);
  assert.equal(formatReportDate("nonsense"), null);

  const { snapshot } = demoInput();
  const placeholderOf = (v: ReturnType<typeof toReportView>["visualization"]) => {
    assert.notEqual(v.state, "ready");
    return v as Exclude<typeof v, { state: "ready" }>;
  };
  const planned = placeholderOf(toReportView(await runResultPipeline(snapshot, { imageProvider: null, calibrated: true }), "blob:front").visualization);
  assert.equal(planned.state, "unavailable");
  assert.equal(planned.placeholder, "Your illustrative visualization will appear here.");
  assert.equal(planned.beforeUrl, "blob:front");
  assert.ok(planned.plannedChanges.length > 0);

  const notEligible = placeholderOf(toReportView(await runResultPipeline({ ...snapshot, frontPhoto: null }, { imageProvider: null, calibrated: true }), null).visualization);
  assert.equal(notEligible.placeholder, "An illustrative visualization needs more visual evidence.");
  assert.deepEqual(notEligible.plannedChanges, []);
  const real = toReportView(await runResultPipeline(snapshotFor(assessmentWith({ selected: ["SKIN_TONE"] })), { imageProvider: null }), "blob:front");
  assert.equal(real.visualization.state, "unavailable");
});

// ---- the AI provider ----

/** A stub model: receives the prompt, edits the draft it was sent (only the editable part is in the payload) and returns it. */
const modelReturning = (edit: (r: MogaFaceReport) => void) => async ({ user }: { system: string; user: string }) => {
  const draft = JSON.parse(user.slice(user.indexOf(DRAFT_MARKER) + DRAFT_MARKER.length)) as MogaFaceReport;
  edit(draft);
  return JSON.stringify(draft);
};

test("AI provider: a valid rewrite of the wording is used", async () => {
  const { input } = demoInput();
  const ai = createAiInterpretationProvider({ id: "test-model", options: CAL, complete: modelReturning((r) => { r.overview.text = "Your analysis shows a focus on facial definition, and several areas may be worth discussing with your clinician."; }) });
  const outcome = await interpretWithFallback(ai, input, CAL);
  assert.equal(outcome.providerId, "test-model");
  assert.equal(outcome.fellBackBecause, null);
  assert.match(outcome.result.report.overview.text, /^Your analysis shows a focus/);
});

test("AI provider: invented evidence, changed decisions, forbidden wording and bad JSON all fall back to the local rules", async () => {
  const { input } = demoInput();
  const attempts: [string, (r: MogaFaceReport) => void, RegExp][] = [
    ["invented evidence", (r) => { r.sections.eyeArea.statements[0].evidenceRefs = [{ sourceType: "visual_observation", sourceId: "eyeArea.madeUp" }]; }, /does not exist/],
    ["dropped evidence", (r) => { r.sections.skin.statements[0].evidenceRefs = []; }, /no evidence/],
    ["a promoted area", (r) => { const o = r.opportunities.find((x) => x.status === "insufficient_evidence")!; o.status = "discuss"; o.why.sourceType = "opportunity"; }, /differs|invalid/],
    ["a treatment claim", (r) => { r.overview.text = "You need filler for your jaw."; }, /forbidden language/],
    ["a score", (r) => { r.priorities[0].why.text = "Your definition score is high."; }, /forbidden language/],
    ["a named treatment without an opportunity", (r) => { r.sections.skin.statements[0].text = "Fillers suit your skin."; }, /names a treatment/],
  ];
  for (const [name, edit, expected] of attempts) {
    const outcome = await interpretWithFallback(createAiInterpretationProvider({ id: "test-model", options: CAL, complete: modelReturning(edit) }), input, CAL);
    assert.equal(outcome.providerId, "local-rules", name);
    assert.match(outcome.fellBackBecause ?? "", expected, name);
    assert.deepEqual(validateInterpretation(outcome.result, input, CAL), [], name);
  }
  for (const complete of [async () => "not json", async () => { throw new Error("network"); }]) {
    assert.equal((await interpretWithFallback(createAiInterpretationProvider({ options: CAL, complete }), input, CAL)).providerId, "local-rules");
  }
});

test("AI prompt: carries the rules and the editable draft only — no age, gender, body measurements, images, landmarks or questionnaire-only sections", () => {
  const a = assessmentWith({ selected: ["FACIAL_DEFINITION"] });
  a.profile = { ageYears: 61, genderPresentation: "female", heightCm: 163, weightKg: 58 };
  const { input } = inputFor(a);
  const prompt = buildInterpretationPrompt(input, buildInterpretation(input).report);
  for (const rule of ["You are the MogaFace report wording assistant", "not performing analysis", "Never diagnose", "Never prescribe", "Never assess attractiveness", "Never assess treatment suitability", "Never add a new finding", "may be worth discussing with your clinician", "insufficient", "preserve the limitation"]) {
    assert.ok(INTERPRETATION_SYSTEM_PROMPT.includes(rule), rule);
  }
  assert.ok(INTERPRETATION_SYSTEM_PROMPT.includes("STRUCTURED EVIDENCE"));
  assert.ok(prompt.user.startsWith(DRAFT_MARKER));
  for (const forbidden of ["ageYears", "genderPresentation", "heightCm", "weightKg", "\"61\"", "\"landmarks\"", "blob:", "methodologyVersion", input.assessmentId]) assert.ok(!(prompt.system + prompt.user).includes(forbidden), forbidden);
});

test("provider selection (generic): no environment → local; an unknown provider or a missing key → refuses and falls back", async () => {
  const { input } = inputFor(assessmentWith({ selected: ["SKIN_TONE"] }));
  assert.equal(selectInterpretationProvider({}).id, "local-rules");
  assert.equal(selectInterpretationProvider({ INTERPRETATION_PROVIDER: "local" }).id, "local-rules");
  for (const env of [{ INTERPRETATION_PROVIDER: "openai" }, { INTERPRETATION_PROVIDER: "mystery", OPENAI_API_KEY: "k" }, { INTERPRETATION_PROVIDER: "anthropic", OPENAI_API_KEY: "k" }]) {
    const outcome = await interpretWithFallback(selectInterpretationProvider(env), input);
    assert.equal(outcome.providerId, "local-rules");
    assert.match(outcome.fellBackBecause!, /No AI interpretation provider/);
  }
});

test("remote provider: posts only the narrow input, returns the server's result, and refuses a failed or unconfigured server", async () => {
  const { input } = inputFor(assessmentWith({ selected: ["SKIN_TONE"] }));
  const local = buildInterpretation(input);
  let sent = "";
  const ok: typeof fetch = async (url, init) => {
    assert.equal(url, "/api/interpret");
    sent = String(init!.body);
    return new Response(JSON.stringify({ result: local }), { status: 200 });
  };
  assert.deepEqual(await createRemoteInterpretationProvider("granted", ok).interpret(input), local);
  for (const forbidden of ["ageYears", "genderPresentation", "heightCm", "weightKg", "landmarks", "blob:"]) assert.ok(!sent.includes(forbidden), forbidden);

  const unconfigured: typeof fetch = async () => new Response(JSON.stringify({ available: false }), { status: 200 });
  await assert.rejects(() => createRemoteInterpretationProvider("granted", unconfigured).interpret(input), /not configured/);
  const failed: typeof fetch = async () => new Response("{}", { status: 502 });
  await assert.rejects(() => createRemoteInterpretationProvider("granted", failed).interpret(input), /unavailable \(502\)/);
  const outcome = await interpretWithFallback(createRemoteInterpretationProvider("granted", unconfigured), input);
  assert.equal(outcome.providerId, "local-rules");
  const evilResult = clone(local);
  evilResult.report.overview.text = "You need Botox.";
  const evil: typeof fetch = async () => new Response(JSON.stringify({ result: evilResult }), { status: 200 });
  assert.equal((await interpretWithFallback(createRemoteInterpretationProvider("granted", evil), input)).providerId, "local-rules", "the browser validates the server's answer again");
});

test("the interpretation input keeps the assessment date and internal versions out of the model prompt", () => {
  const { input } = inputFor(assessmentWith({ selected: ["SKIN_TONE"] }));
  assert.ok(input.assessmentCreatedAt && input.methodologyVersions);
  const prompt = buildInterpretationPrompt(input as InterpretationInput);
  assert.ok(!prompt.user.includes(input.assessmentCreatedAt!));
  assert.ok(!prompt.user.includes("analysisVersion"));
});
