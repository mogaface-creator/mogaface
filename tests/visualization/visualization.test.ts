import { test } from "node:test";
import assert from "node:assert/strict";
import { buildVisualizationPlan } from "../../lib/visualization/build.ts";
import { validateVisualizationPlan } from "../../lib/visualization/validate.ts";
import { VISUALIZATION_CATEGORIES, VISUALIZATION_DISCLAIMER, PRESERVATION_RULES } from "../../lib/visualization/types.ts";
import { VISUALIZATION_PLAN_VERSION } from "../../lib/visualization/versions.ts";
import { buildIllustrationPrompt } from "../../lib/image-generation/provider.ts";
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
  // A plan that tries to include one is rejected.
  const bad = clone(plan);
  bad.changes.push({ category: "skin_appearance" as never, description: "Subtle change", intensity: "subtle", evidenceIds: ["x"] });
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

test("the image prompt lists only approved changes, preserves identity, and forbids dramatic results", () => {
  const plan = buildVisualizationPlan({ frontPhoto: FRONT, opportunities: plannable() });
  const prompt = buildIllustrationPrompt(plan);
  for (const c of plan.changes) assert.ok(prompt.includes(c.description));
  for (const rule of PRESERVATION_RULES) assert.ok(prompt.includes(rule), rule);
  assert.match(prompt, /ONLY these approved changes/);
  assert.match(prompt, /Do not alter the person's identity/);
  assert.match(prompt, /No dramatic transformation, no celebrity-like result/);
  assert.match(prompt, /Illustrative visualization\. Not a prediction of treatment outcome\./);
  assert.ok(!/skin_appearance|fullness|lifting/i.test(prompt), "excluded changes never reach the model");
});

test("opened() opportunities in the fixtures are the only source of the demo/calibrated path", () => {
  const { opportunities } = inputFor(assessmentWith({ selected: ["FACIAL_LINES"] }), { withVideoLines: true });
  assert.ok(opportunities.every((o) => !o.consumerReady || !o.evidenceObservationIds.some((id) => id.startsWith("expression."))));
  assert.ok(opened(opportunities).every((o) => o.consumerReady));
});
