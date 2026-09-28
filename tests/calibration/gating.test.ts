import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { evaluateTreatmentOpportunities } from "../../lib/treatment-opportunities/evaluate.ts";
import { CONTOUR_VIEW_DISAGREEMENT_DEG } from "../../lib/treatment-opportunities/evidence.ts";
import { TREATMENT_RULES } from "../../lib/treatment-opportunities/rules.ts";
import { selectConsumerOpportunities, TREATMENT_CONCERNS, createOpportunity } from "../../lib/treatment-opportunities/types.ts";
import { validateOpportunity } from "../../lib/treatment-opportunities/validate.ts";
import {
  CALIBRATION_CATEGORIES,
  CALIBRATION_STATE,
  categoryOfObservation,
  isCategoryCalibrated,
  isConsumerReady,
  isUncalibratedVisualObservation,
  UNCALIBRATED_VISUAL_OBSERVATION_PREFIXES,
  VISUAL_OBSERVATIONS_CALIBRATED,
} from "../../lib/facial-analysis/calibration/status.ts";
import { VISUAL_THRESHOLDS } from "../../lib/facial-analysis/calibration/thresholds.ts";
import { buildVisualizationPlan } from "../../lib/visualization/build.ts";
import { decideIllustrationEligibility } from "../../lib/visualization/eligibility.ts";
import { buildMogaFaceAnalysis } from "../../lib/observation/build.ts";
import { measuredObservation } from "../../lib/observation/helpers.ts";
import { createEmptyAppearanceConcerns, type AppearanceConcerns } from "../../lib/assessment/appearanceConcerns.ts";
import { buildFilledAssessment, buildMultiPhotoAnalysisWithFront } from "../observation/fixtures.ts";
import { analysisWithFront, cheekContour, context, signal, videoObservation } from "../treatment-opportunities/fixtures.ts";
import { frontRecord, videoAnalysis } from "./fixtures.ts";
import type { Assessment } from "../../lib/assessment/types.ts";

const ROOT = new URL("../../", import.meta.url).pathname;

function assessmentWith(partial: Partial<AppearanceConcerns>): Assessment {
  const a = buildFilledAssessment();
  a.goals = { areas: [], priorities: [] };
  a.appearanceConcerns = { ...createEmptyAppearanceConcerns(), ...partial };
  return a;
}
const withVideo = (a: Assessment) =>
  evaluateTreatmentOpportunities({ assessment: a, analysis: buildMogaFaceAnalysis(a, { ...buildMultiPhotoAnalysisWithFront(), photos: [frontRecord()] }, videoAnalysis()) });

// ---- production gating ----

test("the visual layer ships uncalibrated: VISUAL_OBSERVATIONS_CALIBRATED is false", () => {
  assert.equal(VISUAL_OBSERVATIONS_CALIBRATED, false);
});

test("gating: an opportunity citing video/contour/under-eye evidence is NOT consumer-ready while uncalibrated", () => {
  const [lines] = withVideo(assessmentWith({ selected: ["FACIAL_LINES"] }));
  assert.equal(lines.status, "potential_opportunity");
  assert.equal(lines.category, "NEUROMODULATOR");
  assert.equal(lines.consumerReady, false);
  for (const id of ["expression.x", "facialStructure.contour.cheekContourAngle.front.left", "eyeArea.underEyeBrightnessRatio.right", "eyeArea.visibleUnderEyeDarkness"]) {
    assert.equal(isUncalibratedVisualObservation(id), true, id);
    assert.equal(isConsumerReady([id]), false, id);
  }
});

test("gating: user-reported evidence and older front-geometry evidence are unaffected", () => {
  const a = assessmentWith({ selected: ["SKIN_TONE"] });
  const [skin] = evaluateTreatmentOpportunities({ assessment: a, analysis: analysisWithFront() });
  assert.equal(skin.category, "SKIN_TREATMENT");
  assert.equal(skin.consumerReady, true);
  assert.equal(isConsumerReady(["facialStructure.jawWidth", "facialStructure.thirdsLower"]), true);
});

test("gating: raw observations stay visible and the engine still produces opportunities — only the consumer selector filters", () => {
  const a = assessmentWith({ selected: ["FACIAL_LINES", "SKIN_TONE"] });
  const out = withVideo(a);
  assert.equal(out.length, 2, "dev view still sees every opportunity");
  assert.deepEqual(selectConsumerOpportunities(out).map((o) => o.category), ["SKIN_TREATMENT"]);
  assert.ok(out.every((o) => o.clinicianReviewRequired === true));
});

test("gating: with the flag set (calibrated) the same evidence becomes consumer-ready — the flag is the only switch", () => {
  const ids = ["expression.visibleForeheadLinePattern"];
  assert.equal(isConsumerReady(ids, false), false);
  assert.equal(isConsumerReady(ids, true), true);
});

test("gating: the validator rejects a consumerReady value that contradicts the cited evidence, or is not a boolean", () => {
  const [o] = withVideo(assessmentWith({ selected: ["FACIAL_LINES"] }));
  assert.deepEqual(validateOpportunity(o), []);
  assert.match(validateOpportunity({ ...o, consumerReady: true }).join(), /consumerReady does not match/);
  assert.match(validateOpportunity({ ...o, consumerReady: "yes" }).join(), /consumerReady must be a boolean/);
  assert.match(validateOpportunity({ ...o, consumerReady: undefined }).join(), /consumerReady must be a boolean/);
});

test("gating: every gated prefix corresponds to a layer the calibration workflow covers", () => {
  assert.deepEqual([...UNCALIBRATED_VISUAL_OBSERVATION_PREFIXES].sort(), ["expression.", "eyeArea.underEye", "eyeArea.visibleUnderEye", "facialStructure.contour."]);
  assert.ok(VISUAL_THRESHOLDS.some((t) => t.affects.some((a) => a.startsWith("expression"))));
});

// ---- calibration-gating architecture: per-category state, not one global switch ----

test("A. all calibration categories are false today — no category has been calibrated", () => {
  assert.deepEqual(CALIBRATION_STATE, { expression: false, "facialStructure.contour": false, "eyeArea.underEye": false });
  for (const category of CALIBRATION_CATEGORIES) assert.equal(isCategoryCalibrated(category), false, category);
});

test("B. an expression observation is NOT consumer-ready while expression calibration is false", () => {
  assert.equal(categoryOfObservation("expression.visibleForeheadLinePattern"), "expression");
  assert.equal(isConsumerReady(["expression.visibleForeheadLinePattern"]), false);
});

test("C. a contour observation is NOT consumer-ready while contour calibration is false", () => {
  assert.equal(categoryOfObservation("facialStructure.contour.cheekContourAngle.front.left"), "facialStructure.contour");
  assert.equal(isConsumerReady(["facialStructure.contour.cheekContourAngle.front.left"]), false);
});

test("D. an under-eye observation is NOT consumer-ready while under-eye calibration is false", () => {
  assert.equal(categoryOfObservation("eyeArea.underEyeBrightnessRatio.right"), "eyeArea.underEye");
  assert.equal(categoryOfObservation("eyeArea.visibleUnderEyeDarkness"), "eyeArea.underEye");
  assert.equal(isConsumerReady(["eyeArea.underEyeBrightnessRatio.right"]), false);
  assert.equal(isConsumerReady(["eyeArea.visibleUnderEyeDarkness"]), false);
});

test("E. a hypothetical expression=true would NOT automatically calibrate contour", () => {
  assert.equal(CALIBRATION_STATE.expression, false, "precondition: not actually calibrated");
  CALIBRATION_STATE.expression = true;
  try {
    assert.equal(isConsumerReady(["expression.visibleForeheadLinePattern"]), true, "expression itself would become ready");
    assert.equal(isConsumerReady(["facialStructure.contour.cheekContourAngle.front.left"]), false, "contour must not inherit expression's calibration");
  } finally {
    CALIBRATION_STATE.expression = false; // restore — this test simulates a hypothetical, it does not decide anything
  }
  assert.equal(CALIBRATION_STATE.expression, false, "state was restored, not left changed");
});

test("F. a hypothetical expression=true would NOT automatically calibrate under-eye", () => {
  assert.equal(CALIBRATION_STATE.expression, false, "precondition: not actually calibrated");
  CALIBRATION_STATE.expression = true;
  try {
    assert.equal(isConsumerReady(["eyeArea.visibleUnderEyeDarkness"]), false, "under-eye must not inherit expression's calibration");
  } finally {
    CALIBRATION_STATE.expression = false;
  }
  assert.equal(CALIBRATION_STATE.expression, false, "state was restored, not left changed");
});

test("G. existing production behavior is unchanged today: the VISUAL_OBSERVATIONS_CALIBRATED alias still means 'every category calibrated', and is still false", () => {
  assert.equal(VISUAL_OBSERVATIONS_CALIBRATED, Object.values(CALIBRATION_STATE).every(Boolean));
  assert.equal(VISUAL_OBSERVATIONS_CALIBRATED, false);
  // the exact call shape every production path already uses (no override) behaves exactly as it did under the old global flag
  assert.equal(isConsumerReady(["expression.x", "facialStructure.contour.cheekContourAngle.front.left", "eyeArea.underEyeBrightnessRatio.right"]), false);
  assert.equal(isConsumerReady(["facialStructure.jawWidth", "facialStructure.thirdsLower"]), true, "ungated observations are unaffected");
});

test("H. no visualization becomes eligible merely because the per-category abstraction exists", () => {
  const [lines] = withVideo(assessmentWith({ selected: ["FACIAL_LINES"] }));
  assert.equal(lines.category, "NEUROMODULATOR");
  assert.equal(lines.consumerReady, false, "the opportunity itself is still not consumer-ready");
  const plan = buildVisualizationPlan({ frontPhoto: { ref: "blob:x", qualityValid: true }, opportunities: [lines] });
  const decision = decideIllustrationEligibility(plan, [lines]); // no calibrated override — the real production call shape
  assert.equal(decision.eligible, false, "expression_lines is still not eligible for illustration today");
  for (const category of CALIBRATION_CATEGORIES) assert.equal(isCategoryCalibrated(category), false, category);
});

// ---- contour disagreement across views → insufficient ----

test("contour measurements that disagree across the two 45° views are set aside (insufficient), not averaged", () => {
  const c = { ...context({ signals: [signal("facial_volume")] }) };
  const contourRule = TREATMENT_RULES.find((r) => r.id.startsWith("B."))!;
  const agree = [cheekContour("front"), cheekContour("leftFortyFive", "left", 120), cheekContour("rightFortyFive", "right", 125)];
  assert.equal(contourRule.evaluate({ ...c, observations: agree })[0].category, "DERMAL_FILLER");

  const disagree = [cheekContour("front"), cheekContour("leftFortyFive", "left", 120), cheekContour("rightFortyFive", "right", 120 + CONTOUR_VIEW_DISAGREEMENT_DEG + 5)];
  const [o] = contourRule.evaluate({ ...c, observations: disagree });
  assert.equal(o.status, "insufficient_evidence");
  assert.equal(o.category, null);
  assert.match(o.limitations.join(" "), /disagreed/);
});

test("contour disagreement also withholds contouring that relied on contour evidence, but not on unrelated front geometry", () => {
  const rule = TREATMENT_RULES.find((r) => r.id.startsWith("B."))!;
  const jawGeometry = measuredObservation({ id: "facialStructure.jawWidth", domain: "facial-structure", label: "Jaw width", value: 0.4, source: "front" });
  const disputed = [jawGeometry, cheekContour("leftFortyFive", "left", 100), cheekContour("rightFortyFive", "right", 150)];
  const out = rule.evaluate({ ...context({ signals: [signal("facial_definition")] }), observations: disputed });
  assert.equal(out.length, 1);
  assert.deepEqual(out[0].evidenceObservationIds, ["facialStructure.jawWidth"]); // the disputed contour angles were not cited
});

// ---- ambiguous evidence stays insufficient (Part 8) ----

test("FACIAL_LINES with ambiguous video evidence stays insufficient_evidence", () => {
  const out = TREATMENT_RULES.find((r) => r.id.startsWith("A."))!.evaluate(
    context({ signals: [signal("expression_lines")], videoAnalyzed: true, videoObservations: [{ id: "expression.browRaise.foreheadRegionMovementPct", label: "m", supports: "expression_lines" }] }),
  );
  assert.equal(out[0].status, "insufficient_evidence", "movement without a line-pattern observation is not enough");
  assert.equal(out[0].category, null);
});

// ---- naming: the concern is facial_lifting; the old laxity identifier must not exist ----

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (["node_modules", ".next", ".git"].includes(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|md|mjs)$/.test(name)) out.push(p);
  }
  return out;
}

test("terminology: the concern is facial_lifting, and the old laxity identifier appears nowhere in code, tests or docs", () => {
  assert.ok((TREATMENT_CONCERNS as readonly string[]).includes("facial_lifting"));
  assert.ok(!(TREATMENT_CONCERNS as readonly string[]).some((c) => c.includes("laxity")));
  const banned = "facial_" + "laxity";
  const files = ["lib", "components", "app", "tests", "docs"].flatMap((d) => walk(join(ROOT, d))).concat(["README.md", "ARCHITECTURE.md", "PROJECT_RULES.md", "FACIAL_ANALYSIS_METHODOLOGY.md"].map((f) => join(ROOT, f)));
  const offenders = files.filter((f) => readFileSync(f, "utf8").includes(banned));
  assert.deepEqual(offenders, []);
});

test("terminology: a lifting opportunity is identified as facial_lifting and never implies laxity in its own text", () => {
  const rule = TREATMENT_RULES.find((r) => r.id.startsWith("C."))!;
  assert.equal(rule.concern, "facial_lifting");
  const [o] = rule.evaluate(context({ signals: [signal("facial_lifting")] }));
  assert.equal(o.id, "facial_lifting:insufficient_evidence");
  assert.doesNotMatch(o.title + o.rationale, /laxity|sagging|ptosis/i);
  const direct = createOpportunity({ concern: "facial_lifting", category: null, title: "t", rationale: "r", evidence: [{ kind: "questionnaire", id: "q", label: "q", source: "user" }], status: "not_available", confidence: null, limitations: [] });
  assert.equal(direct.consumerReady, true);
});

// ---- under-eye terminology ----

test("terminology: under-eye wording stays observational across observations, decisions and thresholds", () => {
  const rec = frontRecord(0.7);
  const a = buildMogaFaceAnalysis(buildFilledAssessment(), { ...buildMultiPhotoAnalysisWithFront(), photos: [rec] });
  const eyeText = [
    ...a.observations.filter((o) => o.id.startsWith("eyeArea.")).map((o) => o.label),
    ...a.eyeArea.notMeasured.map((n) => `${n.label} ${n.reason}`),
    ...VISUAL_THRESHOLDS.filter((t) => t.id.startsWith("underEye.")).map((t) => t.meaning),
  ].join(" ").toLowerCase();
  assert.match(eyeText, /dark-looking/);
  assert.match(eyeText, /apparent under-eye hollowing/);
  for (const w of ["volume deficiency", "hyperpigmentation", "pigmentation disorder", "vascular", "dark circles", "diagnos", "melasma", "deficien"]) {
    assert.ok(!eyeText.includes(w), `under-eye text mentions "${w}"`);
  }
});

test("the raw evidence a developer sees never contains a diagnosis, cause, or treatment word", () => {
  const a = buildMogaFaceAnalysis(buildFilledAssessment(), { ...buildMultiPhotoAnalysisWithFront(), photos: [frontRecord(0.7)] }, videoAnalysis());
  const text = JSON.stringify(a.observations.map((o) => o.label)).toLowerCase();
  for (const w of ["botox", "filler", "wrinkle", "aging", "diagnos", "acne", "rosacea", "laxity", "candidate"]) assert.ok(!text.includes(w), w);
  assert.ok(videoObservation("expression.x", 1).source.startsWith("video_frame_"));
});

// ---- documentation stays in sync with the code ----

test("docs/VISUAL_CALIBRATION.md documents every threshold in the registry and states the calibration status honestly", () => {
  const doc = readFileSync(join(ROOT, "docs/VISUAL_CALIBRATION.md"), "utf8");
  for (const t of VISUAL_THRESHOLDS) assert.ok(doc.includes(`\`${t.id}\``), `threshold ${t.id} is missing from docs/VISUAL_CALIBRATION.md`);
  assert.match(doc, /engineering heuristics and have not been clinically validated/);
  assert.match(doc, /not been performed/i);
  assert.doesNotMatch(doc, /calibration (was|has been) (completed|performed successfully)/i);
});

test("VISUAL_OBSERVATION_LAYER.md and TREATMENT_OPPORTUNITY_ENGINE.md carry the calibration status and gating", () => {
  const layer = readFileSync(join(ROOT, "docs/VISUAL_OBSERVATION_LAYER.md"), "utf8");
  assert.match(layer, /Thresholds are engineering heuristics and have not been clinically validated/);
  assert.match(layer, /VISUAL_OBSERVATIONS_CALIBRATED = false/);
  const engine = readFileSync(join(ROOT, "docs/TREATMENT_OPPORTUNITY_ENGINE.md"), "utf8");
  assert.match(engine, /selectConsumerOpportunities/);
  assert.match(engine, /consumerReady/);
});
