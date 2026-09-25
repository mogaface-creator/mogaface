import { test } from "node:test";
import assert from "node:assert/strict";
import { runResultPipeline } from "../../lib/results/pipeline.ts";
import { toConsumerView, CLINICIAN_NOTE } from "../../lib/results/consumer.ts";
import { resolveConsultationCta } from "../../lib/results/config.ts";
import { buildDemoSnapshot, demoAfterImage, demoBeforeImage } from "../../lib/results/demo.ts";
import { clearSnapshot, loadSnapshot, saveSnapshot } from "../../lib/results/store.ts";
import { createMockProvider } from "../../lib/image-generation/mockProvider.ts";
import { VISUAL_OBSERVATIONS_CALIBRATED } from "../../lib/facial-analysis/calibration/status.ts";
import { findForbiddenLanguage } from "../../lib/safety/language.ts";
import type { ImageGenerationProvider } from "../../lib/image-generation/types.ts";
import type { ResultStage } from "../../lib/results/types.ts";
import { assessmentWith, snapshotFor } from "./fixtures.ts";

const MOCK = () => createMockProvider({ latencyMs: 0 });
const demoRun = (provider: ImageGenerationProvider | null) => {
  const snapshot = buildDemoSnapshot();
  return { snapshot, run: runResultPipeline(snapshot, { imageProvider: provider, calibrated: true }) };
};

// ---- the four result outcomes ----

test("result: image ready — interpretation, opportunities, plan and a mock visualization all present", async () => {
  const stages: ResultStage[] = [];
  const snapshot = buildDemoSnapshot();
  const r = await runResultPipeline(snapshot, { imageProvider: MOCK(), calibrated: true, onStage: (s) => stages.push(s) });
  assert.equal(r.status, "visualization_ready");
  assert.equal(r.visualization.status, "ready");
  assert.equal(r.visualization.isMock, true);
  assert.equal(r.visualizationPlan.status, "planned");
  assert.ok(r.interpretation.opportunities.length > 0);
  assert.equal(r.treatmentOpportunities, snapshot.opportunities);
  assert.equal(r.assessmentId, snapshot.assessment.id);
  assert.equal(r.interpretation.clinicianReviewRequired, true);
  assert.ok(r.limitations.length > 0 && r.id.length > 0);
  assert.deepEqual(stages, ["interpreting", "preparing_visualization"]);
});

test("result: image unavailable (no provider) — interpretation and opportunities are preserved", async () => {
  const { run } = demoRun(null);
  const r = await run;
  assert.equal(r.status, "visualization_unavailable");
  assert.deepEqual([r.visualization.status, r.visualization.errorCode], ["unavailable", "provider_not_configured"]);
  assert.ok(r.interpretation.opportunities.some((o) => o.status === "discuss"));
  assert.ok(r.treatmentOpportunities.length > 0);
});

test("result: image failure does NOT fail the assessment, and is not retried", async () => {
  let calls = 0;
  const failing: ImageGenerationProvider = { id: "flaky", isMock: false, async generateIllustration() { calls++; throw new Error("provider exploded"); } };
  const { run } = demoRun(failing);
  const r = await run;
  assert.equal(calls, 1);
  assert.equal(r.status, "visualization_unavailable");
  assert.equal(r.visualization.status, "failed");
  assert.ok(r.interpretation.summary.statement.length > 0, "interpretation preserved");
  assert.ok(r.treatmentOpportunities.length > 0, "opportunities preserved");
  const view = toConsumerView(r, "blob:x");
  assert.equal(view.visualization.state, "failed");
  assert.equal((view.visualization as { body: string }).body, "We couldn't generate the illustrative visualization this time. Your results below are unaffected.");
  assert.ok(view.areas.length > 0, "results still shown");
});

test("result: interpretation is available without any image at all (real evidence, gate closed, no provider)", async () => {
  const snapshot = snapshotFor(assessmentWith({ selected: ["FACIAL_DEFINITION", "SKIN_TONE"], priorities: ["SKIN_TONE"] }), { withVideoLines: true });
  const stages: ResultStage[] = [];
  const r = await runResultPipeline(snapshot, { imageProvider: null, onStage: (s) => stages.push(s) });
  assert.equal(r.visualizationPlan.status, "not_eligible");
  assert.deepEqual(r.visualization, { status: "unavailable", errorCode: "not_eligible" });
  assert.deepEqual(stages, ["interpreting"], "no 'preparing visualization' stage when nothing will be generated");
  assert.equal(r.interpretation.priorities[0].label, "Skin tone");
});

// ---- Phase 7 gating ----

test("a real (gate closed) assessment never produces an image, even with a working mock provider", async () => {
  assert.equal(VISUAL_OBSERVATIONS_CALIBRATED, false);
  let calls = 0;
  const provider: ImageGenerationProvider = { id: "spy", isMock: true, async generateIllustration() { calls++; return { imageUrl: "x", provider: "spy", createdAt: "" }; } };
  const r = await runResultPipeline(snapshotFor(assessmentWith({ selected: ["FACIAL_DEFINITION", "FACIAL_LINES"] }), { withVideoLines: true }), { imageProvider: provider });
  assert.equal(calls, 0);
  assert.equal(r.visualization.status, "unavailable");
});

test("no front photo, or a front photo that failed validation → no image", async () => {
  for (const frontPhoto of [null, { ref: "blob:x", qualityValid: false }]) {
    const snap = { ...buildDemoSnapshot(), frontPhoto };
    const r = await runResultPipeline(snap, { imageProvider: MOCK(), calibrated: true });
    assert.equal(r.visualizationPlan.status, "not_eligible");
    assert.equal(r.visualization.status, "unavailable");
  }
});

// ---- consumer view: no developer data ----

test("consumer view: ready state has before, illustrative after, 'what changed', label and notice", async () => {
  const { snapshot, run } = demoRun(createMockProvider({ latencyMs: 0, render: () => demoAfterImage() }));
  const view = toConsumerView(await run, snapshot.frontPhoto!.ref);
  assert.equal(view.visualization.state, "ready");
  if (view.visualization.state !== "ready") return;
  assert.equal(view.visualization.beforeUrl, demoBeforeImage());
  assert.equal(view.visualization.afterUrl, demoAfterImage());
  assert.notEqual(view.visualization.beforeUrl, view.visualization.afterUrl);
  assert.equal(view.visualization.label, "Illustrative visualization");
  assert.equal(view.visualization.notice, "Not a prediction of treatment outcome.");
  assert.equal(view.visualization.isMock, true);
  assert.deepEqual(view.visualization.changes, [
    "Subtle reduction in the visible appearance of expression-related forehead lines",
    "Subtle visual emphasis of facial contour and definition",
  ]);
  assert.equal(view.clinicianNote, CLINICIAN_NOTE);
});

test("consumer view: the required sections exist with human-readable copy", async () => {
  const { snapshot, run } = demoRun(MOCK());
  const v = toConsumerView(await run, snapshot.frontPhoto!.ref);
  assert.equal(v.headline, "Your MogaFace assessment");
  assert.equal(v.intro, "Here's what your assessment highlighted.");
  assert.deepEqual(v.priorities, ["A more defined appearance", "Expression-related facial lines", "Skin tone"]);
  assert.ok(v.keyObservations.length > 0);
  assert.ok(v.areas.some((a) => a.title === "Facial definition"));
  assert.ok(v.notEstablished.some((a) => a.title === "Facial fullness"));
  assert.match(v.clinicianNote, /qualified clinician should assess your face in person/);
});

test("consumer view exposes NONE of: evidence ids, raw numbers, thresholds, calibration, versions, debug", async () => {
  const { snapshot, run } = demoRun(MOCK());
  const text = JSON.stringify(toConsumerView(await run, snapshot.frontPhoto!.ref), (_k, v) => (typeof v === "string" && v.startsWith("data:") ? "<image>" : v));
  const leaks = [
    /user_reports_/, /facialStructure\./, /eyeArea\./, /expression\./, /video_frame/, /dynamic_facial_lines/, /facial_contour_volume/, /skin_appearance:/,
    /consumerReady/i, /calibrat/i, /threshold/i, /methodology/i, /"version"/i, /landmark/i, /symmetry/i, /borderline/i, /uncalibrated/i, /evidenceIds?/i, /sourceId/i,
    /NEUROMODULATOR|DERMAL_FILLER|FACIAL_CONTOURING|FACIAL_LIFTING|SKIN_TREATMENT/, /\d+\.\d{2,}/, /\d\s?%/, /debug/i,
  ];
  for (const l of leaks) assert.doesNotMatch(text, l, String(l));
});

test("consumer view: every string is free of forbidden language (and none says 'need', 'suitable', or scores)", async () => {
  const { snapshot, run } = demoRun(MOCK());
  const v = toConsumerView(await run, snapshot.frontPhoto!.ref);
  const allow = ["Illustrative visualization", "Not a prediction of treatment outcome.", CLINICIAN_NOTE];
  const strings: string[] = [v.headline, v.intro, v.summary, v.clinicianNote, ...v.priorities, ...v.keyObservations, ...v.limitations, ...v.areas.flatMap((a) => [a.title, a.body]), ...v.notEstablished.flatMap((a) => [a.title, a.body])];
  if (v.visualization.state === "ready") strings.push(...v.visualization.changes);
  for (const s of strings) assert.deepEqual(findForbiddenLanguage(s, allow), [], s);
});

test("consumer view drops any string that would break the language rules (defence in depth)", async () => {
  const { snapshot, run } = demoRun(MOCK());
  const r = await run;
  r.interpretation.priorities.push({ id: "p", label: "You need Botox", evidence: [] });
  r.interpretation.opportunities[0].statement = "You are a candidate for fillers.";
  const v = toConsumerView(r, snapshot.frontPhoto!.ref);
  assert.ok(!JSON.stringify(v).includes("Botox"));
  assert.ok(!JSON.stringify(v).includes("candidate"));
});

test("no-image card: 'Your assessment is ready', with the two specified explanations", async () => {
  const withAreas = toConsumerView(await demoRun(null).run, "blob:x");
  assert.equal(withAreas.visualization.state, "unavailable");
  const notEligibleWithAreas = toConsumerView(await runResultPipeline({ ...buildDemoSnapshot(), frontPhoto: null }, { imageProvider: MOCK(), calibrated: true }), null);
  assert.equal((notEligibleWithAreas.visualization as { title: string }).title, "Your assessment is ready");
  assert.equal((notEligibleWithAreas.visualization as { body: string }).body, "We found useful areas to discuss, but there isn't enough visual evidence to create an illustrative visualization yet.");

  const nothing = toConsumerView(await runResultPipeline(snapshotFor(assessmentWith({}), { frontPhoto: null }), { imageProvider: null }), null);
  assert.equal((nothing.visualization as { body: string }).body, "Your current assessment doesn't provide enough evidence for an illustrative visualization.");
  assert.deepEqual(nothing.areas, []);
});

test("an unavailable provider gets its own honest, non-blocking message", async () => {
  const r = await demoRun(null).run;
  const v = toConsumerView(r, "blob:x");
  assert.equal((v.visualization as { body: string }).body, "The illustrative visualization isn't available right now. Your results below are unaffected.");
});

// ---- store, config, demo ----

class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}
const storage = new MemoryStorage();
Object.assign(globalThis, { window: { sessionStorage: storage } });

test("snapshot store: round-trips, and refuses a photo reference that looks like image data", () => {
  const snap = snapshotFor(assessmentWith({ selected: ["SKIN_TONE"] }));
  assert.equal(saveSnapshot(snap), true);
  const loaded = loadSnapshot()!;
  assert.equal(loaded.assessment.id, snap.assessment.id);
  assert.equal(loaded.frontPhoto?.ref, "blob:http://localhost/front");
  assert.equal(saveSnapshot({ ...snap, frontPhoto: { ref: "data:image/jpeg;base64," + "A".repeat(5000), qualityValid: true } }), false);
  clearSnapshot();
  assert.equal(loadSnapshot(), null);
});

test("snapshot store: malformed or wrong-version data loads as nothing, never throws", () => {
  storage.setItem("mogaface:result-snapshot", "{not json");
  assert.equal(loadSnapshot(), null);
  storage.setItem("mogaface:result-snapshot", JSON.stringify({ version: "9.9.9" }));
  assert.equal(loadSnapshot(), null);
  storage.setItem("mogaface:result-snapshot", JSON.stringify({ version: "0.1.0", assessment: {} }));
  assert.equal(loadSnapshot(), null);
  clearSnapshot();
});

test("consultation CTA is configurable and safe", () => {
  assert.deepEqual(resolveConsultationCta(), { label: "Discuss My Results", href: "/" });
  assert.deepEqual(resolveConsultationCta({ url: "https://clinic.example/book", label: "Book a Consultation" }), { label: "Book a Consultation", href: "https://clinic.example/book" });
  assert.equal(resolveConsultationCta({ url: "mailto:hello@clinic.example" }).href, "mailto:hello@clinic.example");
  assert.equal(resolveConsultationCta({ url: "/consult" }).href, "/consult");
  for (const url of ["javascript:alert(1)", "//evil.example", "data:text/html,x", "ftp://x"]) assert.equal(resolveConsultationCta({ url }).href, "/", url);
  assert.equal(resolveConsultationCta({ label: "   " }).label, "Discuss My Results");
});

test("demo fixture: clearly marked, synthetic, small, and it does not touch the production gate", () => {
  const snap = buildDemoSnapshot();
  assert.equal(snap.isDemo, true);
  assert.ok(snap.opportunities.every((o) => o.consumerReady));
  assert.equal(VISUAL_OBSERVATIONS_CALIBRATED, false, "building the demo must not open the real gate");
  assert.match(decodeURIComponent(demoBeforeImage()), /NOT A REAL PHOTO/);
  assert.match(decodeURIComponent(demoAfterImage()), /MOCK ILLUSTRATION/);
  assert.ok(demoBeforeImage().length < 4000 && demoAfterImage().length < 4000);
  assert.ok(snap.frontPhoto!.ref.length < 4000);
});
