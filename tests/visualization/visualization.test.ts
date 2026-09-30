import { test } from "node:test";
import assert from "node:assert/strict";
import { buildVisualizationPlan } from "../../lib/visualization/build.ts";
import { validateVisualizationPlan } from "../../lib/visualization/validate.ts";
import { VISUALIZATION_CATEGORIES, VISUALIZATION_CATEGORY_TREATMENT_CATEGORY, VISUALIZATION_DISCLAIMER, PRESERVATION_RULES } from "../../lib/visualization/types.ts";
import { VISUALIZATION_PLAN_VERSION } from "../../lib/visualization/versions.ts";
import { buildIllustrationPrompt } from "../../lib/image-generation/provider.ts";
import { findUnsafeVisualText, validateIllustrationPrompt } from "../../lib/visualization/safety.ts";
import { decideIllustrationEligibility, ILLUSTRATION_POLICY } from "../../lib/visualization/eligibility.ts";
import { visualizedAreaFor } from "../../lib/visualization/present.ts";
import {
  buildDevMultiAreaPlan,
  DEV_FULL_ILLUSTRATION_POLICY,
  DEV_MULTI_AREA_FIXTURE_OPPORTUNITIES_LIST,
} from "../../lib/image-generation/devIllustrationFixture.ts";
import { assessmentWith, inputFor, opened } from "../results/fixtures.ts";
import type { VisualizationPlan } from "../../lib/visualization/types.ts";

const FRONT = { ref: "blob:front", qualityValid: true };
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

function plannable() {
  const { opportunities } = inputFor(assessmentWith({ selected: ["FACIAL_DEFINITION", "FACIAL_LINES", "SKIN_TONE", "FACIAL_VOLUME"] }), { withVideoLines: true, open: true });
  return opportunities;
}

test("only a consumer-ready opportunity can produce a visualization change", () => {
  const plan = buildVisualizationPlan({ frontPhoto: FRONT, opportunities: plannable() });
  assert.equal(plan.status, "planned");
  assert.deepEqual(plan.changes.map((c) => c.category).sort(), ["expression_lines", "facial_contour"]);
  assert.deepEqual(validateVisualizationPlan(plan, plannable()), []);
});

test("the same opportunities with the calibration gate CLOSED yield no change and no image (not eligible)", () => {
  const { opportunities } = inputFor(assessmentWith({ selected: ["FACIAL_DEFINITION", "FACIAL_LINES"] }), { withVideoLines: true }); // real consumerReady
  assert.ok(opportunities.some((o) => o.status === "potential_opportunity" && !o.consumerReady));
  const plan = buildVisualizationPlan({ frontPhoto: FRONT, opportunities });
  assert.equal(plan.status, "not_eligible");
  assert.equal(plan.ineligibleReason, "no_supported_change");
  assert.deepEqual(plan.changes, []);
  assert.ok(plan.excludedChanges.some((e) => e.category === "facial_contour" && /not yet at a standard/.test(e.reason)));
});

test("unsupported categories are never planned: filler, lifting and skin are excluded with a reason", () => {
  const opps = plannable();
  const plan = buildVisualizationPlan({ frontPhoto: FRONT, opportunities: opps });
  assert.ok(plan.excludedChanges.some((e) => e.category === "skin_appearance"));
  assert.ok(!plan.changes.some((c) => !(VISUALIZATION_CATEGORIES as readonly string[]).includes(c.category)));
  // A plan that tries to include a category outside the whole taxonomy is rejected.
  const bad = clone(plan);
  bad.changes.push({ category: "unsupported_visualization", description: "Subtle change", intensity: "subtle", evidenceIds: ["x"] } as never);
  assert.match(validateVisualizationPlan(bad).join(), /not an approved visualization category/);
});

test("eligibility: no front photo, a front photo that failed quality, or no supported change → not eligible, no changes", () => {
  const opps = plannable();
  assert.equal(buildVisualizationPlan({ frontPhoto: null, opportunities: opps }).ineligibleReason, "no_front_photo");
  assert.equal(buildVisualizationPlan({ frontPhoto: { ref: "blob:x", qualityValid: false }, opportunities: opps }).ineligibleReason, "front_photo_quality");
  const skinOnly = inputFor(assessmentWith({ selected: ["SKIN_TONE"] }), { open: true }).opportunities;
  assert.equal(buildVisualizationPlan({ frontPhoto: FRONT, opportunities: skinOnly }).ineligibleReason, "no_supported_change");
  for (const p of [buildVisualizationPlan({ frontPhoto: null, opportunities: opps }), buildVisualizationPlan({ frontPhoto: FRONT, opportunities: skinOnly })]) {
    assert.deepEqual(p.changes, []);
    assert.deepEqual(validateVisualizationPlan(p), []);
  }
});

test("the source photo is always the FRONT photo", () => {
  const plan = buildVisualizationPlan({ frontPhoto: FRONT, opportunities: plannable() });
  assert.deepEqual(plan.sourcePhoto, { slot: "front", ref: "blob:front" });
});

test("empty evidence is rejected", () => {
  const plan = buildVisualizationPlan({ frontPhoto: FRONT, opportunities: plannable() });
  const bad = clone(plan);
  bad.changes[0].evidenceIds = [];
  assert.match(validateVisualizationPlan(bad).join(), /evidenceIds must be a non-empty array/);
  const missing = clone(plan) as unknown as Record<string, unknown>;
  (missing.changes as { evidenceIds?: unknown }[])[0].evidenceIds = undefined;
  assert.ok(validateVisualizationPlan(missing).length > 0);
  // and a change with evidence that isn't a consumer-ready opportunity of its category is rejected when opportunities are supplied
  const unbacked = clone(plan);
  unbacked.changes[0].evidenceIds = ["some.other.id"];
  assert.match(validateVisualizationPlan(unbacked, plannable()).join(), /not backed by a consumer-ready/);
});

test("excessive or intense changes are rejected: only 'subtle' and 'light' are allowed", () => {
  const plan = buildVisualizationPlan({ frontPhoto: FRONT, opportunities: plannable() });
  assert.ok(plan.changes.every((c) => c.intensity === "subtle"));
  for (const intensity of ["moderate", "strong", "dramatic", "extreme", "", 3]) {
    const bad = clone(plan);
    (bad.changes[0] as { intensity: unknown }).intensity = intensity;
    assert.match(validateVisualizationPlan(bad).join(), /intensity .* is not allowed/, String(intensity));
  }
  const light = clone(plan);
  light.changes[0].intensity = "light";
  assert.deepEqual(validateVisualizationPlan(light), []);
});

test("change descriptions may not promise transformations, youthfulness, or make claims", () => {
  const plan = buildVisualizationPlan({ frontPhoto: FRONT, opportunities: plannable() });
  for (const text of ["A dramatic transformation", "Look ten years younger", "Perfect face symmetry", "You need this change"]) {
    const bad = clone(plan);
    bad.changes[0].description = text;
    assert.match(validateVisualizationPlan(bad).join(), /forbidden language/, text);
  }
});

test("the disclaimer is always present — on planned and not-eligible plans — and cannot be altered or removed", () => {
  const planned = buildVisualizationPlan({ frontPhoto: FRONT, opportunities: plannable() });
  const none = buildVisualizationPlan({ frontPhoto: null, opportunities: [] });
  for (const p of [planned, none]) {
    assert.deepEqual(p.disclaimer, VISUALIZATION_DISCLAIMER);
    assert.equal(p.disclaimer.label, "Illustrative visualization");
    assert.equal(p.disclaimer.notice, "Not a prediction of treatment outcome.");
  }
  for (const mutate of [(p: VisualizationPlan) => { (p as unknown as Record<string, unknown>).disclaimer = undefined; }, (p: VisualizationPlan) => { (p.disclaimer as { notice: string }).notice = "This will be your result."; }]) {
    const bad = clone(planned);
    mutate(bad);
    assert.match(validateVisualizationPlan(bad).join(), /fixed disclaimer/);
  }
});

test("plan structure rules: planned needs a change and a front source; not-eligible needs a reason and no changes", () => {
  const planned = buildVisualizationPlan({ frontPhoto: FRONT, opportunities: plannable() });
  assert.match(validateVisualizationPlan({ ...clone(planned), changes: [] }).join(), /at least one change/);
  assert.match(validateVisualizationPlan({ ...clone(planned), sourcePhoto: null }).join(), /front photo as its source/);
  const none = buildVisualizationPlan({ frontPhoto: null, opportunities: [] });
  assert.match(validateVisualizationPlan({ ...clone(none), ineligibleReason: null }).join(), /must say why/);
  assert.match(validateVisualizationPlan({ ...clone(none), changes: clone(planned.changes) }).join(), /no changes/);
  assert.equal(planned.version, VISUALIZATION_PLAN_VERSION);
  for (const v of [null, undefined, 3, "x", []]) assert.ok(validateVisualizationPlan(v).length > 0);
});

test("the image prompt is built from the approved fields only: instructions, preservation rules, subtle limits — and passes the safety validator", () => {
  const plan = buildVisualizationPlan({ frontPhoto: FRONT, opportunities: plannable() });
  const prompt = buildIllustrationPrompt(plan);
  for (const c of plan.changes) assert.ok(prompt.includes(c.visualInstruction));
  for (const rule of PRESERVATION_RULES) assert.ok(prompt.includes(rule), rule);
  assert.match(prompt, /^Edit the supplied portrait of the same person\./);
  assert.match(prompt, /Apply only the following approved visual change\(s\) — nothing else:/);
  assert.match(prompt, /Preserve the person's identity and every facial characteristic that is unrelated/);
  assert.match(prompt, /clearly visible in a side-by-side comparison.*natural, moderate and anatomically plausible/);
  assert.match(prompt, /Do not create a dramatic transformation\./);
  assert.match(prompt, /recognizably the same person\./);
  assert.ok(!/skin_appearance|fullness|lifting/i.test(prompt), "excluded changes never reach the model");
  assert.deepEqual(validateIllustrationPrompt(prompt), []);
  assert.equal(buildIllustrationPrompt({ ...plan, changes: [] }), "", "no approved change → no prompt");
});

// =====================================================================================
// Multi-area plan representation, the new categories' production fail-closed
// behavior, and the dev-only composite fixture (see devIllustrationFixture.ts).
// =====================================================================================

test("A: a single plan can represent multiple independently evidence-backed visual areas", () => {
  const plan = buildDevMultiAreaPlan("blob:front");
  assert.equal(plan.status, "planned");
  assert.equal(plan.changes.length, 6);
  assert.deepEqual(
    plan.changes.map((c) => c.category).sort(),
    [...VISUALIZATION_CATEGORIES].sort(),
  );
  // every item independently carries what the image-generation layer needs
  for (const c of plan.changes) {
    assert.ok(c.targetRegion, c.category);
    assert.ok(c.evidenceRefs.length > 0, `${c.category} evidenceRefs`);
    assert.ok(c.evidenceIds.length > 0, `${c.category} evidenceIds`);
    assert.equal(c.consumerReady, true);
    assert.equal(c.safetyStatus, "approved");
  }
  assert.deepEqual(validateVisualizationPlan(plan, DEV_MULTI_AREA_FIXTURE_OPPORTUNITIES_LIST), []);
  // and the UI-facing shape carries an area name, description and (where one applies) a treatment family
  const areas = plan.changes.map(visualizedAreaFor);
  assert.deepEqual(
    areas.map((a) => a.area).sort(),
    ["Expression lines", "Facial contour", "Hair appearance", "Jawline definition", "Skin appearance", "Under-eye appearance"],
  );
  assert.ok(areas.every((a) => a.description.length > 0));
  assert.ok(areas.every((a) => typeof a.treatmentFamily === "string"));
});

test("B: production eligibility rejects every category the real policy hasn't approved, including the new ones", () => {
  assert.deepEqual(ILLUSTRATION_POLICY, { expression_lines: true, facial_contour: false, jawline_definition: false, under_eye: false, skin_appearance: false, hair_appearance: false });
  const plan = buildDevMultiAreaPlan("blob:front");
  // the REAL policy/calibration state (no dev override at all)
  const real = decideIllustrationEligibility(plan, DEV_MULTI_AREA_FIXTURE_OPPORTUNITIES_LIST);
  assert.equal(real.eligible, false, "not even expression_lines survives without the calibration override");
  assert.deepEqual(real.approvedChanges, []);
  // even calibrated (the closed gate opened), the real policy alone still blocks the other five
  const calibratedOnly = decideIllustrationEligibility(plan, DEV_MULTI_AREA_FIXTURE_OPPORTUNITIES_LIST, { calibrated: true });
  assert.deepEqual(calibratedOnly.approvedChanges.map((c) => c.category), ["expression_lines"]);
  assert.deepEqual(
    calibratedOnly.blocked.map((b) => b.category).sort(),
    ["facial_contour", "hair_appearance", "jawline_definition", "skin_appearance", "under_eye"],
  );
  // jawline_definition and under_eye can never even be BUILT from a real opportunity — no rule produces them
  const real45 = inputFor(assessmentWith({ selected: ["FACIAL_DEFINITION", "FACIAL_VOLUME", "FACIAL_LIFTING", "UNDER_EYE", "SKIN_TONE"] }), { withVideoLines: true, open: true }).opportunities;
  const realPlan = buildVisualizationPlan({ frontPhoto: FRONT, opportunities: real45 });
  assert.ok(!realPlan.changes.some((c) => c.category === "jawline_definition" || c.category === "under_eye"));
});

test("C: the dev-only composite fixture represents six categories without touching the real production policy or calibration objects", () => {
  const beforePolicy = { ...ILLUSTRATION_POLICY };
  const plan = buildDevMultiAreaPlan("blob:front");
  decideIllustrationEligibility(plan, DEV_MULTI_AREA_FIXTURE_OPPORTUNITIES_LIST, { calibrated: true, policy: DEV_FULL_ILLUSTRATION_POLICY });
  // the real policy object is untouched by exercising the dev-only override
  assert.deepEqual(ILLUSTRATION_POLICY, beforePolicy);
  assert.notEqual(DEV_FULL_ILLUSTRATION_POLICY, ILLUSTRATION_POLICY);
  // the dev override opens exactly the taxonomy, all true — a separate object, never mutating the real one
  assert.deepEqual(DEV_FULL_ILLUSTRATION_POLICY, { expression_lines: true, facial_contour: true, jawline_definition: true, under_eye: true, skin_appearance: true, hair_appearance: true });
});

test("D–E: the multi-area prompt contains only the six approved instructions, in the approved fixed wording, and no beautification language", () => {
  const plan = buildDevMultiAreaPlan("blob:front");
  const decision = decideIllustrationEligibility(plan, DEV_MULTI_AREA_FIXTURE_OPPORTUNITIES_LIST, { calibrated: true, policy: DEV_FULL_ILLUSTRATION_POLICY });
  assert.equal(decision.approvedChanges.length, 6);
  const prompt = buildIllustrationPrompt({ ...plan, changes: decision.approvedChanges });
  for (const c of decision.approvedChanges) assert.ok(prompt.includes(c.visualInstruction), c.category);
  assert.equal(prompt.split("\n").filter((l) => l.startsWith("- ")).length, 6);
  assert.deepEqual(findUnsafeVisualText(prompt), []);
  assert.deepEqual(validateIllustrationPrompt(prompt), []);
  for (const bad of ["beautif", "flawless", "attractive", "perfect", "ideal", "glow up", "flaw", "imperfection", "botox", "filler", "inject", "guarantee"]) {
    assert.doesNotMatch(prompt, new RegExp(bad, "i"), bad);
  }
});

test("F: identity- and scene-preservation requirements are present in the multi-area prompt", () => {
  const plan = buildDevMultiAreaPlan("blob:front");
  const prompt = buildIllustrationPrompt(plan);
  for (const rule of PRESERVATION_RULES) assert.ok(prompt.includes(rule), rule);
  for (const must of ["eye shape", "nose shape", "lip shape", "facial structure", "head position and camera angle", "lighting", "hairstyle", "ethnicity and gender presentation", "apparent age"]) {
    assert.ok(prompt.includes(must), must);
  }
  assert.match(prompt, /recognizably the same person/);
});

test("G: a fabricated 'jawline_definition' change still needs a real, matching, consumer-ready opportunity — the validator is not bypassed for the new categories", () => {
  const plan = buildDevMultiAreaPlan("blob:front");
  const jawlineChange = plan.changes.find((c) => c.category === "jawline_definition")!;
  // without the matching opportunity supplied, the validator refuses it — same rule as every existing category
  assert.match(validateVisualizationPlan(plan, []).join(), /not backed by a consumer-ready/);
  // the category's declared treatment family must be the one actually checked
  assert.equal(VISUALIZATION_CATEGORY_TREATMENT_CATEGORY.jawline_definition, "FACIAL_CONTOURING");
  assert.ok(DEV_MULTI_AREA_FIXTURE_OPPORTUNITIES_LIST.some((o) => o.id === jawlineChange.sourceOpportunityId && o.category === "FACIAL_CONTOURING"));
});

test("H: existing expression_lines-only production behavior is unchanged by the new categories", () => {
  const opps = plannable();
  const plan = buildVisualizationPlan({ frontPhoto: FRONT, opportunities: opps });
  assert.deepEqual(plan.changes.map((c) => c.category).sort(), ["expression_lines", "facial_contour"]);
  const decision = decideIllustrationEligibility(plan, opps, { calibrated: true });
  assert.deepEqual(decision.approvedChanges.map((c) => c.category), ["expression_lines"]);
});

test("opened() opportunities in the fixtures are the only source of the demo/calibrated path", () => {
  const { opportunities } = inputFor(assessmentWith({ selected: ["FACIAL_LINES"] }), { withVideoLines: true });
  assert.ok(opportunities.every((o) => !o.consumerReady || !o.evidenceObservationIds.some((id) => id.startsWith("expression."))));
  assert.ok(opened(opportunities).every((o) => o.consumerReady));
});
