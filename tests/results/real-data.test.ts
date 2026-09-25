/**
 * The report must work with REAL assessment data. None of these tests uses the
 * demo fixture: assessments and analyses are built by the production
 * functions (buildMogaFaceAnalysis, evaluateTreatmentOpportunities,
 * runResultPipeline) from fixture INPUTS (test landmarks/records), which is
 * exactly what the app does after a real photo has been analysed. The
 * calibration gate stays closed (VISUAL_OBSERVATIONS_CALIBRATED = false).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { buildMogaFaceAnalysis } from "../../lib/observation/build.ts";
import { evaluateTreatmentOpportunities } from "../../lib/treatment-opportunities/evaluate.ts";
import { runResultPipeline } from "../../lib/results/pipeline.ts";
import { toReportView } from "../../lib/results/reportView.ts";
import { chooseResultSource } from "../../lib/results/source.ts";
import { buildDemoSnapshot } from "../../lib/results/demo.ts";
import { clearSnapshot, loadSnapshot, saveSnapshot } from "../../lib/results/store.ts";
import { SNAPSHOT_VERSION } from "../../lib/results/types.ts";
import type { AssessmentSnapshot, MogaFaceResult } from "../../lib/results/types.ts";
import { selectInterpretationProvider } from "../../lib/interpretation/select.ts";
import { VISUAL_OBSERVATIONS_CALIBRATED } from "../../lib/facial-analysis/calibration/status.ts";
import type { Assessment } from "../../lib/assessment/types.ts";
import type { MogaFaceAnalysis } from "../../lib/observation/types.ts";
import type { ReportStatement } from "../../lib/interpretation/types.ts";
import { buildMultiPhotoAnalysisWithFront } from "../observation/fixtures.ts";
import { assessmentWith, snapshotFor } from "./fixtures.ts";

class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}
Object.assign(globalThis, { window: { sessionStorage: new MemoryStorage() } });

const FRONT_URL = "blob:http://localhost/real-front-photo";
const ALL_CONCERNS = ["FACIAL_DEFINITION", "FACIAL_LINES", "FACIAL_VOLUME", "FACIAL_LIFTING", "UNDER_EYE", "SKIN_TONE"] as const;

/** A snapshot exactly as AssessmentReview.openResults builds it, from a given analysis. */
function realSnapshot(assessment: Assessment, analysis: MogaFaceAnalysis): AssessmentSnapshot {
  return {
    version: SNAPSHOT_VERSION,
    createdAt: new Date().toISOString(),
    assessment,
    analysis,
    opportunities: evaluateTreatmentOpportunities({ assessment, analysis }),
    frontPhoto: { ref: FRONT_URL, qualityValid: true },
  };
}
const noPhotos = (a: Assessment) => realSnapshot(a, buildMogaFaceAnalysis(a, null));
const frontOnly = (a: Assessment) => realSnapshot(a, buildMogaFaceAnalysis(a, buildMultiPhotoAnalysisWithFront()));
const run = (s: AssessmentSnapshot) => runResultPipeline(s, { imageProvider: null });

const statementsOf = (r: MogaFaceResult): ReportStatement[] => {
  const rep = r.interpretation.report;
  return [rep.overview, ...rep.priorities.flatMap((p) => [p.why, p.evidence]), ...Object.values(rep.sections).flatMap((s) => s?.statements ?? []), ...rep.opportunities.map((o) => o.why)];
};
const refTypes = (r: MogaFaceResult) => new Set(statementsOf(r).flatMap((s) => s.evidenceRefs.map((e) => e.sourceType)));

test("the calibration gate is closed for every test in this file", () => {
  assert.equal(VISUAL_OBSERVATIONS_CALIBRATED, false);
});

// ---- the five critical evidence tests ----

test("A real assessment with NO visual evidence produces no visual observations and no visual content", async () => {
  const snap = noPhotos(assessmentWith({ selected: [...ALL_CONCERNS], priorities: ["FACIAL_DEFINITION", "FACIAL_LINES"] }));
  assert.equal(snap.analysis.observations.filter((o) => o.type !== "user_reported").length, 0, "the production pipeline created no measured observations");

  const r = await run(snap);
  assert.ok(!refTypes(r).has("visual_observation"), "no statement cites a visual observation");
  const { sections } = r.interpretation.report;
  assert.equal(sections.expression, null);
  for (const key of ["facialStructure", "eyeArea"] as const) {
    assert.ok(sections[key].statements.every((s) => s.sourceType === "limitation"), key);
    assert.equal(sections[key].basis, "not_assessed");
    assert.match(sections[key].statements[0].text, /No reliable visual evidence was available|do not provide enough evidence to characterize it/);
  }
  assert.ok(r.interpretation.report.limitations.some((l) => /No reliable facial measurements were available/.test(l)));
  assert.ok(r.interpretation.report.opportunities.every((o) => o.status !== "observation_only"));
});

test("A real assessment with ONLY questionnaire data produces questionnaire-backed content only", async () => {
  const r = await run(noPhotos(assessmentWith({ selected: ["SKIN_TONE", "FACIAL_DEFINITION"], priorities: ["SKIN_TONE"] })));
  assert.deepEqual([...refTypes(r)].filter((t) => t !== "questionnaire" && t !== "assessment" && t !== "treatment_opportunity"), []);
  const { sections } = r.interpretation.report;
  for (const key of ["skin", "hair", "facialHair", "lifestyle", "style"] as const) assert.equal(sections[key].basis === "not_assessed", false, key);
  for (const key of ["hair", "facialHair", "lifestyle", "style"] as const) assert.ok(sections[key].statements.every((s) => s.sourceType === "user_reported"), key);
  assert.ok(sections.skin.statements.every((s) => s.evidenceRefs.every((e) => e.sourceType === "questionnaire")));
  assert.equal(r.interpretation.report.priorities[0].concern, "Skin tone");
  assert.equal(r.interpretation.report.priorities[0].evidence.sourceType, "user_reported");
});

test("A real assessment with facial measurements produces ONLY the supported facial-structure content", async () => {
  const r = await run(frontOnly(assessmentWith({ selected: [...ALL_CONCERNS], priorities: ["FACIAL_DEFINITION"] })));
  const { sections } = r.interpretation.report;

  const structure = sections.facialStructure.statements.filter((s) => s.sourceType === "observed");
  assert.ok(structure.length > 0 && sections.facialStructure.basis === "observed");
  assert.ok(sections.facialStructure.statements.flatMap((s) => s.evidenceRefs).filter((e) => e.sourceType === "visual_observation").every((e) => /^facialStructure\.(?!contour\.)/.test(e.sourceId)));
  assert.match(structure[0].text, /Your front photo provided measurements of/);
  assert.equal(sections.facialStructure.howAssessed, "Based on facial landmarks detected across your submitted views.");

  // the eye area states only what was measured; under-eye stays out (its evidence is uncalibrated)
  const eye = sections.eyeArea.statements.map((s) => s.text).join(" ");
  assert.match(eye, /Your front photo allowed the width of each eye, the distance between the eyes and left-to-right comparisons of the eye area to be measured\./);
  assert.doesNotMatch(eye, /under-eye appearance relative/);

  // nothing that rests on uncalibrated evidence is stated
  assert.equal(sections.expression, null);
  const cited = statementsOf(r).flatMap((s) => s.evidenceRefs).map((e) => e.sourceId);
  assert.ok(!cited.some((id) => id.startsWith("expression.") || id.startsWith("facialStructure.contour.") || id.startsWith("eyeArea.underEye") || id.startsWith("eyeArea.visibleUnderEye")));
  assert.ok(!r.interpretation.report.limitations.some((l) => /No reliable facial measurements/.test(l)));
});

test("A real assessment with insufficient treatment evidence produces NO treatment recommendation", async () => {
  const assessment = assessmentWith({ selected: ["FACIAL_DEFINITION", "FACIAL_LINES", "FACIAL_VOLUME", "FACIAL_LIFTING", "UNDER_EYE"], priorities: ["FACIAL_DEFINITION", "FACIAL_LINES"] });

  // No photos at all: nothing can be discussed, and only the person's own goals are cited.
  const none = await run(noPhotos(assessment));
  const rep = none.interpretation.report;
  assert.ok(rep.opportunities.length > 0);
  for (const o of rep.opportunities) {
    assert.equal(o.status, "insufficient_evidence", o.title);
    assert.equal(o.category, null);
    assert.equal(o.why.sourceType, "limitation");
    assert.equal(o.clinicianCanEvaluate, "Additional clinical assessment would be needed.");
    assert.ok(o.why.evidenceRefs.every((e) => e.sourceType === "questionnaire"), "only the user's own goal is cited");
  }
  assert.ok(rep.priorities.every((p) => p.status === "recorded"));
  assert.deepEqual(toReportView(none, FRONT_URL).areas, [], "the areas-to-discuss list is empty");
  assert.ok(!statementsOf(none).some((s) => s.evidenceRefs.some((e) => e.sourceType === "treatment_opportunity")));

  // Front measurements only: lines (video), volume (needs two views), lifting (no method) and under-eye (uncalibrated) stay insufficient.
  // Facial definition is supported because the ENGINE found a consumer-ready opportunity from the front geometry; the report only follows it.
  const front = frontOnly(assessment);
  const withFront = await run(front);
  for (const o of withFront.interpretation.report.opportunities) {
    if (o.area === "facial_definition") continue;
    assert.equal(o.status, "insufficient_evidence", o.title);
    assert.equal(o.category, null);
  }
  const definition = withFront.interpretation.report.opportunities.find((o) => o.area === "facial_definition")!;
  assert.equal(definition.status, "discuss");
  const backing = front.opportunities.find((o) => o.category === definition.category)!;
  assert.deepEqual([backing.status, backing.consumerReady], ["potential_opportunity", true]);
  assert.ok(definition.why.evidenceRefs.some((e) => e.sourceType === "treatment_opportunity" && e.sourceId === backing.id));

  // Even with the engine's output removed entirely, no area can be created by the report layer.
  const bare = frontOnly(assessmentWith({ selected: ["SKIN_TONE", "FACIAL_DEFINITION"] }));
  const r = await run({ ...bare, opportunities: [] });
  assert.ok(r.interpretation.report.opportunities.every((o) => o.status === "insufficient_evidence" && o.category === null));
});

test("Demo content appears ONLY when demo mode is explicitly requested", async () => {
  const demo = buildDemoSnapshot();
  assert.equal(demo.isDemo, true);
  const real = snapshotFor(assessmentWith({ selected: ["SKIN_TONE"] }));
  assert.equal(real.isDemo, undefined);

  // 1. no real-data module imports the demo fixture
  const root = new URL("../../", import.meta.url).pathname;
  const importers: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (["node_modules", ".next", ".git", "tests", "docs"].includes(name)) continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(name) && /results\/demo(\.ts)?["']/.test(readFileSync(p, "utf8"))) importers.push(p.replace(root, ""));
    }
  };
  walk(root);
  assert.deepEqual(importers, ["components/results/ResultsExperience.tsx"]);

  // 2. in that one place the demo needs ?demo=1 AND a non-production build, and there is no fallback to it
  const src = readFileSync(join(root, "components/results/ResultsExperience.tsx"), "utf8");
  assert.match(src, /const demo = !IS_PRODUCTION && params\.get\("demo"\) === "1";/);
  assert.equal(src.match(/buildDemoSnapshot\(\)/g)?.length, 1);
  assert.match(src, /const base = demo \? buildDemoSnapshot\(\) : stored!;/);
  assert.match(src, /source === "legacy" \? \{ kind: "legacy" \} : \{ kind: "empty" \}/);
  assert.match(src, /chooseInterpretationProvider\(\{\s*demo,/); // the demo never takes the third-party path (checked in chooseInterpretationProvider's tests)
  assert.match(src, /calibrated: demo \? true : undefined/);

  // 3. nothing stored and no analysis → "none" → the empty state, not a report
  assert.equal(chooseResultSource(null, null), "none");
});

// ---- the rest of the real-data contract ----

test("areas to discuss come ONLY from the treatment-opportunity engine", async () => {
  const snap = frontOnly(assessmentWith({ selected: ["SKIN_TONE", "FACIAL_DEFINITION", "FACIAL_VOLUME"], priorities: ["SKIN_TONE"] }));
  const r = await run(snap);
  const engine = new Map(snap.opportunities.map((o) => [o.id, o]));
  const discussed = r.interpretation.report.opportunities.filter((o) => o.status === "discuss");
  assert.ok(discussed.length > 0, "the skin goal is supported by an engine opportunity");
  for (const o of discussed) {
    const backing = o.why.evidenceRefs.filter((e) => e.sourceType === "treatment_opportunity" || o.area === "skin");
    const opp = [...engine.values()].find((e) => e.category === o.category);
    assert.ok(opp && opp.consumerReady && opp.status === "potential_opportunity", o.title);
    assert.ok(backing.length > 0 || o.area === "skin");
  }
  assert.ok(discussed.length <= [...engine.values()].filter((e) => e.consumerReady && e.status === "potential_opportunity").length);
  assert.ok(r.treatmentOpportunities === snap.opportunities, "the result carries the engine's own list, unchanged");
  const cats = new Set(discussed.map((o) => o.category));
  for (const c of cats) assert.ok([...engine.values()].some((e) => e.category === c));
});

test("a real result is not a demo: no demo markers, the real photo, no image, no mock", async () => {
  const snap = frontOnly(assessmentWith({ selected: [...ALL_CONCERNS] }));
  const r = await run(snap);
  const view = toReportView(r, FRONT_URL);
  assert.equal(r.assessmentId, snap.assessment.id);
  assert.equal(r.assessmentCreatedAt, snap.assessment.createdAt);
  assert.doesNotMatch(JSON.stringify(view), /demo|synthetic|placeholder photo|not a real photo|mock/i);
  assert.ok(view.visualization.state !== "ready", "a real result never shows a generated (or mock) image");
  assert.equal(view.visualization.beforeUrl, FRONT_URL);
  assert.equal(view.visualization.placeholder, r.visualizationPlan.status === "planned" ? "Your illustrative visualization will appear here." : "An illustrative visualization needs more visual evidence.");
  assert.equal(r.visualization.imageUrl, undefined);
  assert.equal(r.visualization.isMock, undefined);
});

test("the persisted path is lossless: saving and loading the snapshot yields the same report", async () => {
  const snap = frontOnly(assessmentWith({ selected: ["SKIN_TONE", "FACIAL_DEFINITION", "UNDER_EYE"], priorities: ["SKIN_TONE"] }));
  assert.equal(saveSnapshot(snap), true);
  const loaded = loadSnapshot()!;
  clearSnapshot();
  assert.deepEqual((await run(loaded)).interpretation.report, (await run(snap)).interpretation.report);
});

test("report limitations describe what is actually missing in THIS report", async () => {
  const bare = (await run(noPhotos(assessmentWith({ selected: ["FACIAL_DEFINITION", "FACIAL_VOLUME"] })))).interpretation.report.limitations;
  assert.ok(bare.some((l) => /No reliable facial measurements were available/.test(l)));
  assert.ok(bare.some((l) => /Expression and facial-line evidence is not included/.test(l)));
  assert.ok(bare.some((l) => /You told us about facial definition and facial fullness, but there was not enough visual evidence to assess them\./.test(l)));
  const withFront = (await run(frontOnly(assessmentWith({ selected: ["SKIN_TONE"] })))).interpretation.report.limitations;
  assert.ok(!withFront.some((l) => /No reliable facial measurements/.test(l)));
  assert.ok(!withFront.some((l) => /You told us about/.test(l)));
});

test("the AI provider default stays local, and no secret is present in the repository", () => {
  assert.equal(selectInterpretationProvider({}).id, "local-rules");
  const root = new URL("../../", import.meta.url).pathname;
  assert.ok(!existsSync(join(root, ".env")) && !existsSync(join(root, ".env.production")), "no committed env file");
  assert.ok(!/sk-[A-Za-z0-9_-]{16,}/.test(readFileSync(join(root, ".env.example"), "utf8")));
});

test("ConsumerResult.tsx is gone and nothing references the component", () => {
  const root = new URL("../../", import.meta.url).pathname;
  assert.equal(existsSync(join(root, "components/results/ConsumerResult.tsx")), false);
  const refs: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (["node_modules", ".next", ".git", "docs"].includes(name)) continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(name) && /\bConsumerResult\b/.test(readFileSync(p, "utf8")) && !p.endsWith("real-data.test.ts")) refs.push(p.replace(root, ""));
    }
  };
  walk(root);
  assert.deepEqual(refs, []);
});
