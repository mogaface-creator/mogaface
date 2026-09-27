/**
 * Phase 1 of the mobile Results redesign: the summary section, the sticky
 * mobile CTA, and the Before/After toggle. Pure logic (topPriorities) is
 * tested directly; everything presentation-only is checked the way the rest
 * of this codebase checks components with no rendering harness — by scanning
 * the source for the structural properties that make it correct (see e.g.
 * tests/image-generation/illustration.test.ts's "23. Nothing is generated
 * automatically" test for the same technique).
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { SUMMARY_MAX_PRIORITIES, topPriorities } from "../../lib/results/summary.ts";
import { toReportView } from "../../lib/results/reportView.ts";
import { runResultPipeline } from "../../lib/results/pipeline.ts";
import { buildDemoSnapshot } from "../../lib/results/demo.ts";
import type { ReportPriorityView, ReportView } from "../../lib/results/reportView.ts";

const ROOT = new URL("../../", import.meta.url).pathname;
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

function priority(i: number): ReportPriorityView {
  return { number: String(i + 1).padStart(2, "0"), concern: `Concern ${i}`, why: `Why ${i}`, evidence: `Evidence ${i}`, status: "discuss", statusLabel: "May be worth discussing" };
}

// =====================================================================================
// topPriorities: the pure selection logic behind the mobile summary
// =====================================================================================

test("summary renders priorities from real report data — the same objects, just capped, never recomputed", () => {
  const many = [priority(0), priority(1), priority(2), priority(3), priority(4)];
  const view = { priorities: many } as ReportView;
  const top = topPriorities(view);
  assert.equal(top.length, SUMMARY_MAX_PRIORITIES);
  assert.deepEqual(top, many.slice(0, SUMMARY_MAX_PRIORITIES));
  assert.equal(top[0], many[0], "same object reference — no re-derivation of priority data");
});

test("summary handles a report with no priorities at all", () => {
  const view = { priorities: [] } as unknown as ReportView;
  assert.deepEqual(topPriorities(view), []);
  assert.deepEqual(topPriorities(view, 1), []);
});

test("topPriorities against a real pipeline result (demo, gate open): the summary shows a prefix of the same priorities the full report shows", async () => {
  const snapshot = buildDemoSnapshot();
  const result = await runResultPipeline(snapshot, { imageProvider: null, calibrated: true });
  const view = toReportView(result, snapshot.frontPhoto?.ref ?? null);
  const top = topPriorities(view);
  assert.ok(top.length <= SUMMARY_MAX_PRIORITIES);
  assert.deepEqual(top, view.priorities.slice(0, top.length));
});

// =====================================================================================
// The mobile CTA reuses the existing ConsultationCta config
// =====================================================================================

test("StickyMobileCta renders the SAME ConsultationCta it's given — no hardcoded URL, no new booking system", () => {
  const src = read("components/results/StickyMobileCta.tsx");
  assert.match(src, /cta:\s*ConsultationCta/);
  assert.match(src, /cta\.href/);
  assert.match(src, /cta\.label/);
  assert.doesNotMatch(src, /https?:\/\//, "no hardcoded URL — only the config's own href is used");
  assert.doesNotMatch(src, /fetch\(|\/api\//, "no new backend call");
});

test("StickyMobileCta is mobile-only and starts hidden — it never appears unconditionally on desktop", () => {
  const src = read("components/results/StickyMobileCta.tsx");
  assert.match(src, /sm:hidden/);
  assert.match(src, /useState\(false\)/);
  assert.match(src, /env\(safe-area-inset-bottom\)/);
});

test("Report.tsx wires the summary CTA, the sticky CTA and the final CTA section with the ids StickyMobileCta watches", () => {
  const src = read("components/results/Report.tsx");
  assert.match(src, /<StickyMobileCta cta={cta} \/>/);
  assert.match(src, /id="full-report"/);
  assert.match(src, /id="next-step-section"/);
  assert.match(src, /<ResultsSummary view={view} \/>/);
});

test("ResultsSummary's CTA points at the full report and carries the id StickyMobileCta watches to hide itself", () => {
  const src = read("components/results/ResultsSummary.tsx");
  assert.match(src, /id="summary-cta"/);
  assert.match(src, /href="#full-report"/);
  assert.match(src, /See full results/);
});

// =====================================================================================
// Before/After: a toggle on mobile, the unchanged grid on desktop, same data either way
// =====================================================================================

test("the mobile Before/After toggle switches between the SAME before/after data the desktop layout uses — no separate fetch", () => {
  const src = read("components/results/IllustrationPanel.tsx");
  assert.match(src, /function BeforeAfterFrames\(\{ before, after \}: \{ before: string \| null; after: AfterSlot \}\)/);
  assert.match(src, /useState<"before" \| "after">\("before"\)/);
  assert.match(src, /role="tab"/);
  assert.match(src, /tab === "before" \? <BeforeFrame url={before} \/> : <AfterFrame slot={after} \/>/);
  // desktop layout is untouched, just hidden below sm: — not replaced
  assert.match(src, /hidden items-center gap-4 sm:grid sm:grid-cols-\[1fr_auto_1fr\]/);
  assert.match(src, /<div className="sm:hidden">/);
  assert.doesNotMatch(src, /\bfunction Frames\(/, "the old single-layout component was replaced, not duplicated alongside the new one");
});

// =====================================================================================
// No approvedChanges → the existing calm not-eligible state, unchanged
// =====================================================================================

test("no approvedChanges keeps the calm not-eligible state — unaffected by the Phase 1 UI work (real closed-gate pipeline)", async () => {
  const snapshot = buildDemoSnapshot();
  const result = await runResultPipeline(snapshot, { imageProvider: null }); // no calibrated override — the real production gate
  assert.equal(result.illustration.eligible, false);
  assert.deepEqual(result.illustration.approvedChanges, []);
  const view = toReportView(result, snapshot.frontPhoto?.ref ?? null);
  assert.equal(view.visualization.state, "not_eligible");
});

test("IllustrationPanel's not-eligible branch never triggers generation", () => {
  const src = read("components/results/IllustrationPanel.tsx");
  const start = src.indexOf('view.state === "not_eligible"');
  const end = src.indexOf("// eligible");
  assert.ok(start > 0 && end > start);
  const branch = src.slice(start, end);
  assert.doesNotMatch(branch, /onGenerate|run\(/);
});

// =====================================================================================
// The real Results experience never reads the dev-only fixture
// =====================================================================================

test("the real Results components never import the dev-only fixture — only DevIllustrationTest.tsx (itself server-gated) does", () => {
  for (const path of [
    "components/results/Report.tsx",
    "components/results/ResultsSummary.tsx",
    "components/results/StickyMobileCta.tsx",
    "components/results/IllustrationPanel.tsx",
    "components/results/ResultsExperience.tsx",
    "lib/results/reportView.ts",
    "lib/results/summary.ts",
  ]) {
    assert.doesNotMatch(read(path), /devIllustrationFixture|DEV_MULTI_AREA|DEV_ILLUSTRATION_FIXTURE/, path);
  }
});
