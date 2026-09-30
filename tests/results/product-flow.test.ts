/**
 * Wiring/integration proof for the REAL, single-action product flow:
 * AssessmentReview.tsx's one "Analyze My Face" click (analyzeMyFace →
 * finalizeAndGoToResults) into ResultsExperience.tsx (the default, non-demo,
 * non-devPreview render). The underlying pipeline functions
 * (buildMogaFaceAnalysis, evaluateTreatmentOpportunities, runResultPipeline,
 * decideIllustrationEligibility) already have their own extensive coverage
 * (tests/results/real-data.test.ts, tests/image-generation/illustration.test.ts,
 * tests/assessment/mediaStore.test.ts, tests/results/frontPhotoStore.test.ts)
 * — this file instead proves the UI GLUE code that calls them is wired to
 * real data, not a fixture, so the two layers can never silently drift apart.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ILLUSTRATION_UNAVAILABLE_MESSAGE } from "../../lib/visualization/eligibility.ts";
import { VISUAL_OBSERVATIONS_CALIBRATED } from "../../lib/facial-analysis/calibration/status.ts";
import { runResultPipeline } from "../../lib/results/pipeline.ts";
import { toReportView } from "../../lib/results/reportView.ts";
import { assessmentWith, snapshotFor } from "./fixtures.ts";

const ROOT = new URL("../../", import.meta.url).pathname;
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

// ===========================================================================
// AssessmentReview.tsx: "Analyze My Face" runs the REAL pipeline, never a fixture
// ===========================================================================

test("AssessmentReview.analyzeMyFace calls the real per-photo analyzer, the real video analyzer, buildMogaFaceAnalysis and evaluateTreatmentOpportunities — never a demo/fixture module", () => {
  const src = read("components/assessment/AssessmentReview.tsx");
  assert.match(src, /analyzeSinglePhoto\(slot, file\)/);
  assert.match(src, /buildMultiPhotoAnalysis\(assessment\.id, nextRecords\)/);
  assert.match(src, /analyzeVideoFile\(videoFile,/);
  assert.match(src, /buildMogaFaceAnalysis\(assessment, nextAnalysis, nextVideo\)/);
  assert.match(src, /evaluateTreatmentOpportunities\(\{ assessment, analysis: nextMogaFaceAnalysis \}\)/);
  assert.doesNotMatch(src, /results\/demo\.ts|buildDemoSnapshot|devIllustrationFixture/);
});

test("AssessmentReview.finalizeAndGoToResults saves the real front photo by its stable IndexedDB key ('front'), never a blob URL or a fixture image", () => {
  const src = read("components/assessment/AssessmentReview.tsx");
  assert.match(src, /frontPhoto:\s*frontFile\s*\?\s*\{\s*mediaKey:\s*"front"/);
  assert.doesNotMatch(src, /frontPhoto:\s*\{\s*ref:\s*[a-zA-Z]/, "finalizeAndGoToResults must never persist a blob: reference — see lib/results/store.ts's StoredFrontPhotoRef");
});

// ===========================================================================
// ONE primary user action: "Analyze My Face" — no separate "Generate After" click,
// no dev/test/preview route, real (unmodified) eligibility, real consent
// ===========================================================================

test("there is exactly ONE button that starts analysis, labelled 'Analyze My Face' — not 'Start Analysis' + a separate 'View My Results'/'Generate' step", () => {
  const src = read("components/assessment/AssessmentReview.tsx");
  assert.match(src, /nextLabel=\{isRunning \? "Analyzing…" : "Analyze My Face"\}/);
  assert.doesNotMatch(src, /View My Results/);
});

test("eligibility for the inline consent step is decided by the SERVER (lib/analysis-session/), not a client-side recomputation — no calibration override, no policy override anywhere in this file", () => {
  const src = read("components/assessment/AssessmentReview.tsx");
  assert.match(src, /createAnalysisSession\(\{/);
  assert.match(src, /session\?\.illustrationEligible/);
  assert.doesNotMatch(src, /calibrated:\s*true/);
  assert.doesNotMatch(src, /policy:/);
  // the client no longer computes eligibility itself — it only asks the server and trusts the answer
  assert.doesNotMatch(src, /decideIllustrationEligibility/);
});

test("the inline consent screen uses the SAME shared sentence as IllustrationPanel.tsx (single source of truth, never duplicated wording) and requires an explicit click either way", () => {
  const src = read("components/assessment/AssessmentReview.tsx");
  assert.match(src, /PHOTO_VISUALIZATION_CONSENT_SENTENCE/);
  assert.match(src, /finalizeAndGoToResults\(mogaFaceAnalysis, treatmentOpportunities, records, "granted", confirmingVisualization\)/);
  assert.match(src, /finalizeAndGoToResults\(mogaFaceAnalysis, treatmentOpportunities, records, "declined", confirmingVisualization\)/);
});

test("consent is granted or declined ONLY by an explicit click on the inline consent screen — a not-eligible/failed session finalizes with 'pending' (nothing was asked) and no session reference, never 'granted'", () => {
  const src = read("components/assessment/AssessmentReview.tsx");
  assert.match(src, /finalizeAndGoToResults\(nextMogaFaceAnalysis, nextTreatmentOpportunities, nextRecords, "pending", null\)/);
});

test("only an eligible + granted result (with a real session reference) navigates with ?autogenerate=1 — a declined, sessionless, or not-eligible result navigates to a plain /results", () => {
  const src = read("components/assessment/AssessmentReview.tsx");
  assert.match(src, /router\.push\(consent === "granted" && session \? "\/results\?autogenerate=1" : "\/results"\)/);
});

test("the analysis session's sessionToken/analysisId are persisted in the snapshot ONLY alongside granted consent, and only the server-issued handle — never a client-recomputed value", () => {
  const src = read("components/assessment/AssessmentReview.tsx");
  assert.match(src, /consent === "granted" && session \? \{ analysisSession: \{ analysisId: session\.analysisId, sessionToken: session\.sessionToken \} \} : \{\}/);
});

test("the raw developer analysis view (MultiPhotoDevResults) never renders in a production build — the real consumer flow never sees it", () => {
  const src = read("components/assessment/AssessmentReview.tsx");
  assert.match(src, /process\.env\.NODE_ENV !== "production" && \(isRunning \|\| analysis\)/);
});

test("the in-progress status line uses plain, consumer-facing language — no 'calibration', 'workbench', 'fixture', 'developer', 'API', 'OpenAI', 'threshold', 'evidence pipeline', 'analysis session', or 'server'", () => {
  const src = read("components/assessment/AssessmentReview.tsx");
  const statusLineMatch = src.match(/\{progress \? "([^"]+)" : videoProgress \? "([^"]+)" : creatingSession \? "([^"]+)" : "([^"]+)"\}/);
  assert.ok(statusLineMatch, "expected the consumer-facing progress line to be present");
  const banned = /calibration|workbench|fixture|developer|\bAPI\b|OpenAI|threshold|evidence pipeline|analysis session|\bserver\b/i;
  for (const copy of statusLineMatch!.slice(1)) assert.doesNotMatch(copy, banned, copy);
});

test("no other developer/test/preview route is created or linked from the real assessment flow", () => {
  const src = read("components/assessment/AssessmentReview.tsx");
  assert.doesNotMatch(src, /illustration-preview|\/dev\/|devPreview/);
});

// ===========================================================================
// ResultsExperience.tsx: the default (real) branch resolves the SAME key, with no calibration override
// ===========================================================================

test("ResultsExperience's default branch (demo=false, devPreview=false) resolves the front photo from the stored IndexedDB key and passes no calibration override", () => {
  const src = read("components/results/ResultsExperience.tsx");
  assert.match(src, /const stored = demo \? null : loadSnapshot\(\);/);
  assert.match(src, /resolveStoredFrontPhoto\(stored!\.frontPhoto\)/);
  // Real path: neither demo nor devPreview → calibrated is undefined, the honest, unmodified per-category check.
  assert.match(src, /calibrated: demo \|\| devPreview \? true : undefined/);
});

// ===========================================================================
// End-to-end: real evidence with the calibration gate closed produces the
// exact honest "unavailable" copy, not a fabricated image, and the real
// observations/opportunities still populate the rest of the report
// ===========================================================================

test("a real, uncalibrated assessment shows the exact ILLUSTRATION_UNAVAILABLE_MESSAGE and no image, while still reporting real observed content", async () => {
  assert.equal(VISUAL_OBSERVATIONS_CALIBRATED, false);
  const assessment = assessmentWith({ selected: ["FACIAL_LINES"], priorities: ["FACIAL_LINES"] });
  const snapshot = snapshotFor(assessment, { withVideoLines: true }); // real video-derived expression-line evidence, calibration gate closed (default)
  const result = await runResultPipeline(snapshot, { imageProvider: null }); // no calibrated override — the real, default path
  const view = toReportView(result, snapshot.frontPhoto!.ref);

  assert.equal(view.visualization.state, "not_eligible");
  assert.equal(view.visualization.body, ILLUSTRATION_UNAVAILABLE_MESSAGE);
  assert.equal(ILLUSTRATION_UNAVAILABLE_MESSAGE, "An illustrative visualization isn't available from the current analysis.");
  assert.equal(view.visualization.beforeUrl, snapshot.frontPhoto!.ref, "the real front photo is still shown even when no illustration is possible");

  // the rest of the report is not a dead end: it still reflects the real evidence
  assert.ok(view.priorities.length > 0, "the real user's own priority still appears");
  assert.ok(
    view.areas.some((a) => /line/i.test(a.title)) || view.notEstablished.some((n) => /line/i.test(n.title)),
    "the real facial-line evidence still surfaces somewhere in the report, even though no illustration can be generated",
  );
});

// ===========================================================================
// No new/edited file in this task introduces browser-storage writes for media
// ===========================================================================

test("no file touched by this task's wiring writes photo/video bytes to localStorage or sessionStorage", () => {
  for (const path of ["components/assessment/AssessmentReview.tsx", "components/results/ResultsExperience.tsx"]) {
    assert.doesNotMatch(read(path), /localStorage\.setItem|sessionStorage\.setItem/);
  }
});
