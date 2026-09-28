/**
 * The developer-only "Illustration Preview" workbench
 * (components/dev/IllustrationPreviewWorkbench.tsx,
 * app/dev/illustration-preview/page.tsx). It reuses the EXISTING
 * devTestHandler.ts/devClient.ts/handler.ts pipeline verbatim (see
 * dev-illustration-test.test.ts for that pipeline's own coverage); this file
 * proves the NEW UI surface adds no bypass, no storage, and no weakened
 * gate on top of it.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { isDevIllustrationTestEnabled } from "../../lib/image-generation/devIllustrationFixture.ts";
import { CALIBRATION_STATE, VISUAL_OBSERVATIONS_CALIBRATED, isCategoryCalibrated } from "../../lib/facial-analysis/calibration/status.ts";
import { VISUAL_THRESHOLDS } from "../../lib/facial-analysis/calibration/thresholds.ts";
import { ILLUSTRATION_POLICY, decideIllustrationEligibility } from "../../lib/visualization/eligibility.ts";
import { buildVisualizationPlan } from "../../lib/visualization/build.ts";
import { evaluateTreatmentOpportunities } from "../../lib/treatment-opportunities/evaluate.ts";
import { buildMogaFaceAnalysis } from "../../lib/observation/build.ts";
import { createEmptyAppearanceConcerns } from "../../lib/assessment/appearanceConcerns.ts";
import { buildFilledAssessment, buildMultiPhotoAnalysisWithFront } from "../observation/fixtures.ts";

const ROOT = new URL("../../", import.meta.url).pathname;
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

const NEW_FILES = ["components/dev/IllustrationPreviewWorkbench.tsx", "app/dev/illustration-preview/page.tsx"];

// ===========================================================================
// 1. Developer preview does not change calibration state
// ===========================================================================

test("1. the new workbench/page never assign to CALIBRATION_STATE or VISUAL_OBSERVATIONS_CALIBRATED", () => {
  for (const path of NEW_FILES) {
    const src = read(path);
    assert.doesNotMatch(src, /CALIBRATION_STATE\s*[.\[]/, path);
    assert.doesNotMatch(src, /VISUAL_OBSERVATIONS_CALIBRATED\s*=/, path);
  }
  assert.deepEqual(CALIBRATION_STATE, { expression: false, "facialStructure.contour": false, "eyeArea.underEye": false });
  assert.equal(VISUAL_OBSERVATIONS_CALIBRATED, false);
});

// ===========================================================================
// 2. Developer preview does not change production eligibility
// ===========================================================================

test("2. the new workbench/page never import eligibility.ts or the real opportunity engine, and never call decideIllustrationEligibility/evaluateTreatmentOpportunities (mentioning ILLUSTRATION_POLICY by name in a doc comment is fine; importing or calling it is not)", () => {
  for (const path of NEW_FILES) {
    const src = read(path);
    assert.doesNotMatch(src, /from ["'].*eligibility\.ts["']/, path);
    assert.doesNotMatch(src, /\bdecideIllustrationEligibility\s*\(/, path);
    assert.doesNotMatch(src, /\bevaluateTreatmentOpportunities\s*\(/, path);
  }
});

test("2. production illustration eligibility for expression_lines is unaffected after this work", () => {
  const assessment = buildFilledAssessment();
  assessment.goals = { areas: [], priorities: [] };
  assessment.appearanceConcerns = { ...createEmptyAppearanceConcerns(), selected: ["FACIAL_LINES"] };
  const analysis = buildMogaFaceAnalysis(assessment, buildMultiPhotoAnalysisWithFront());
  const opportunities = evaluateTreatmentOpportunities({ assessment, analysis });
  const plan = buildVisualizationPlan({ frontPhoto: { ref: "blob:x", qualityValid: true }, opportunities });
  assert.equal(decideIllustrationEligibility(plan, opportunities).eligible, false);
});

// ===========================================================================
// 3. Developer preview cannot create a consumer-ready opportunity
// ===========================================================================

test("3. the new workbench never constructs or mutates a TreatmentOpportunity / consumerReady field", () => {
  for (const path of NEW_FILES) {
    const src = read(path);
    assert.doesNotMatch(src, /consumerReady/, path);
    assert.doesNotMatch(src, /TreatmentOpportunity/, path);
  }
});

// ===========================================================================
// 4. Production routes remain fail-closed
// ===========================================================================

test("4. the dev illustration test route stays disabled by default (fail closed), unaffected by the new UI", () => {
  assert.equal(isDevIllustrationTestEnabled({}), false);
  assert.equal(isDevIllustrationTestEnabled({ NODE_ENV: "production", DEV_ILLUSTRATION_TEST: "1" }), false);
  assert.equal(isDevIllustrationTestEnabled({ NODE_ENV: "development" }), false);
});

test("4. the production /api/generate-illustration route is a separate file, untouched by this work", () => {
  assert.doesNotMatch(read("app/api/generate-illustration/route.ts"), /IllustrationPreviewWorkbench|illustration-preview/);
});

// ===========================================================================
// 5. No photo bytes written to localStorage/sessionStorage
// ===========================================================================

test("5. the new workbench/page never touch localStorage, sessionStorage, or IndexedDB", () => {
  for (const path of NEW_FILES) {
    const src = read(path);
    assert.doesNotMatch(src, /localStorage|sessionStorage|indexedDB/, path);
  }
});

test("5. the chosen photo is only ever an in-memory object URL, revoked on replacement and unmount", () => {
  const src = read("components/dev/IllustrationPreviewWorkbench.tsx");
  assert.match(src, /URL\.createObjectURL\(file\)/);
  assert.match(src, /URL\.revokeObjectURL\(photoUrl\)/);
  assert.match(src, /URL\.revokeObjectURL\(photoUrlRef\.current\)/);
  assert.match(src, /URL\.revokeObjectURL\(generatedUrlRef\.current\)/);
});

// ===========================================================================
// 6. No API key exposed to the browser
// ===========================================================================

test("6. the new workbench/page never reference the OpenAI credential", () => {
  for (const path of NEW_FILES) assert.doesNotMatch(read(path), /OPENAI_API_KEY/, path);
});

// ===========================================================================
// 7. Existing image-generation safety validation still runs (unweakened, unbypassed)
// ===========================================================================

test("7. the new workbench calls the SAME devClient/dev route as the existing DevIllustrationTest — no parallel image-generation call path", () => {
  const src = read("components/dev/IllustrationPreviewWorkbench.tsx");
  assert.match(src, /requestDevIllustrationTest/);
  assert.doesNotMatch(src, /fetch\(\s*["'`]\/api\/generate-illustration/, "must not call the production route directly, bypassing the dev gate");
  assert.doesNotMatch(src, /new (Request|Response)\(|fetch\(\s*["'`]https?:/, "no direct outbound network call — only the shared devClient does that");
});

test("7. the new workbench is restricted to the 'single' (expression_lines) fixture only — never opens the multi/policy-override fixture", () => {
  const src = read("components/dev/IllustrationPreviewWorkbench.tsx");
  assert.match(src, /fixture:\s*"single"/);
  assert.doesNotMatch(src, /"multi"|DEV_FULL_ILLUSTRATION_POLICY|DEV_MULTI_AREA/);
});

// ===========================================================================
// 8. Existing consent requirement remains enforced
// ===========================================================================

test("8. generation only ever fires from an explicit 'Continue' click after a consent screen, never automatically", () => {
  const src = read("components/dev/IllustrationPreviewWorkbench.tsx");
  // this component (unlike DevIllustrationTest.tsx) owns its own object URL for the
  // locally-chosen file, so it legitimately uses useEffect for cleanup — the actual
  // safety property is that `run(...)` (the generation call) never appears inside one.
  const effectBodies = [...src.matchAll(/useEffect\(([\s\S]*?)\n {2}\);/g)].map((m) => m[1]);
  assert.ok(effectBodies.length > 0, "expected at least one useEffect (object URL cleanup)");
  for (const body of effectBodies) assert.doesNotMatch(body, /\brun\(/, "no useEffect may call the generation function");
  assert.match(src, /void run\("granted"\)/);
  assert.match(src, /onClick=\{\(\) => void run\("granted"\)\}/);
});

test("8. photo bytes are only fetched/sent by devClient AFTER allowsPhotoProcessing(consent) is true", () => {
  const src = read("lib/image-generation/devClient.ts");
  assert.match(src, /if \(!allowsPhotoProcessing\(input\.consent\)\) return \{ status: "consent_required" \};/);
});

// ===========================================================================
// 9. The preview is developer-only
// ===========================================================================

test("9. the illustration-preview page returns notFound() in production, mirroring /dev/calibration's own guard", () => {
  const src = read("app/dev/illustration-preview/page.tsx");
  assert.match(src, /process\.env\.NODE_ENV === "production"/);
  assert.match(src, /notFound\(\)/);
});

test("9. the workbench cannot generate anything unless the server ALSO has NODE_ENV=development AND DEV_ILLUSTRATION_TEST=1 (double gate, independent of the page/component)", () => {
  // the page/component gate alone is never sufficient — the server route enforces its own, separate check
  assert.equal(isDevIllustrationTestEnabled({ NODE_ENV: "development", DEV_ILLUSTRATION_TEST: "1" }), true);
  assert.equal(isDevIllustrationTestEnabled({ NODE_ENV: "development", DEV_ILLUSTRATION_TEST: "0" }), false);
});

// ===========================================================================
// 10. Contour/under-eye remain blocked
// ===========================================================================

test("10. contour and under-eye calibration remain false, and the real ILLUSTRATION_POLICY still blocks facial_contour", () => {
  assert.equal(isCategoryCalibrated("facialStructure.contour"), false);
  assert.equal(isCategoryCalibrated("eyeArea.underEye"), false);
  assert.equal(ILLUSTRATION_POLICY.facial_contour, false);
  assert.equal(ILLUSTRATION_POLICY.under_eye, false);
  assert.equal(ILLUSTRATION_POLICY.jawline_definition, false);
  assert.equal(ILLUSTRATION_POLICY.skin_appearance, false);
  assert.equal(ILLUSTRATION_POLICY.expression_lines, true, "the only category this preview ever exercises");
});

// ===========================================================================
// Supplementary: thresholds untouched, disclaimer wording present
// ===========================================================================

test("no threshold value changed by adding this preview", () => {
  assert.equal(VISUAL_THRESHOLDS.find((t) => t.id === "lineContrast.ratio")!.value, 1.3);
});

test("the required disclaimer wording is present in the developer preview", () => {
  const src = read("components/dev/IllustrationPreviewWorkbench.tsx");
  assert.match(src, /DEVELOPMENT ONLY.*NOT CALIBRATED|Development only — not calibrated/i);
  assert.match(src, /Illustrative visualization only\. This preview does not establish treatment suitability, diagnosis, or clinical recommendation\./);
  assert.match(src, /Developer preview — manually selected visualization\./);
});

test("no beauty-score/promise language appears in the new files (perfect, ideal, flaw, glow-up, botox)", () => {
  for (const path of [...NEW_FILES, "lib/visualization/types.ts"]) {
    const text = read(path).toLowerCase();
    for (const w of ["perfect", "ideal", "flaw", "glow-up", "glow up", "botox"]) assert.ok(!text.includes(w), `${path} contains "${w}"`);
  }
});
