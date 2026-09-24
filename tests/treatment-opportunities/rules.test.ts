import { test } from "node:test";
import assert from "node:assert/strict";
import { TREATMENT_RULES } from "../../lib/treatment-opportunities/rules.ts";
import { validateOpportunity } from "../../lib/treatment-opportunities/validate.ts";
import { measuredObservation } from "../../lib/observation/helpers.ts";
import type { TreatmentOpportunity } from "../../lib/treatment-opportunities/types.ts";
import { analysisWithFront, cheekContour, context, signal, videoObservation, visualFeature } from "./fixtures.ts";

const rule = (letter: string) => TREATMENT_RULES.find((r) => r.id.startsWith(`${letter}.`))!;
const structure = () => analysisWithFront().observations;

function assertConservativeWording(o: TreatmentOpportunity) {
  assert.match(o.rationale, /may be worth (discussing|assessing)|may justify discussing/);
  assert.doesNotMatch(o.rationale + o.title, /you need|botox|filler is|threads/i);
}

test("Rule A: expression-line goal + video line pattern + video movement → NEUROMODULATOR, moderate (one video is one source)", () => {
  const ctx = context({
    signals: [signal("expression_lines")],
    observations: [
      videoObservation("expression.visibleForeheadLinePattern", true),
      videoObservation("expression.browRaise.foreheadRegionMovementPct", 21),
    ],
    // derived exactly as evaluate.ts does
    videoObservations: [{ id: "expression.browRaise.foreheadRegionMovementPct", label: "Brow raise", supports: "expression_lines" }],
  });
  const [o] = rule("A").evaluate(ctx);
  assert.equal(o.status, "potential_opportunity");
  assert.equal(o.category, "NEUROMODULATOR");
  assert.equal(o.confidence, "moderate");
  assert.equal(
    o.rationale,
    "Your submitted images/video show features associated with facial expression lines. A neuromodulator consultation may be worth discussing with your clinician.",
  );
  assert.deepEqual(o.evidenceObservationIds.sort(), ["expression.browRaise.foreheadRegionMovementPct", "expression.visibleForeheadLinePattern"]);
  assert.equal(validateOpportunity(o).length, 0);
  assertConservativeWording(o);
});

test("Rule A: high needs a source independent of the video (e.g. a photo observation)", () => {
  const ctx = context({
    signals: [signal("expression_lines")],
    observations: [visualFeature("expression.visibleForeheadLinePattern", "front")],
    videoObservations: [{ id: "video.brow", label: "Lines more apparent on eyebrow movement", supports: "expression_lines" }],
  });
  assert.equal(rule("A").evaluate(ctx)[0].confidence, "high");
});

test("Rule A: without video the wording says images only and confidence is moderate", () => {
  const ctx = context({
    signals: [signal("expression_lines")],
    observations: [visualFeature("expression.visibleGlabellarLinePattern")],
  });
  const [o] = rule("A").evaluate(ctx);
  assert.equal(o.confidence, "moderate");
  assert.ok(o.rationale.startsWith("Your submitted images show features"));
});

test("Rule A: goal alone (no lines observation) → insufficient_evidence, no category", () => {
  const [o] = rule("A").evaluate(context({ signals: [signal("expression_lines")] }));
  assert.equal(o.status, "insufficient_evidence");
  assert.equal(o.category, null);
  assert.equal(o.confidence, null);
  assert.equal(validateOpportunity(o).length, 0);
});

test("Rule A: video alone without an observation is still insufficient", () => {
  const ctx = context({
    photoAnalysisAvailable: false,
    signals: [signal("expression_lines")],
    videoObservations: [{ id: "v", label: "v", supports: "expression_lines" }],
  });
  assert.equal(rule("A").evaluate(ctx)[0].status, "insufficient_evidence");
});

test("Rule A: observation without a user goal creates nothing", () => {
  assert.deepEqual(rule("A").evaluate(context({ observations: [visualFeature("expression.visibleForeheadLinePattern")] })), []);
});

test("Rule B: definition goal + facial-structure observations → FACIAL_CONTOURING, conservative wording", () => {
  const ctx = context({ signals: [signal("facial_definition", "general")], observations: structure() });
  const [o] = rule("B").evaluate(ctx);
  assert.equal(o.category, "FACIAL_CONTOURING");
  assert.equal(o.confidence, "low"); // general goal, single view
  assert.equal(
    o.rationale,
    "Your goals and facial-structure observations suggest that a facial contour/volume assessment may be worth discussing with your clinician.",
  );
  assertConservativeWording(o);
});

test("Rule B: explicit contour goal is moderate; multi-view corroboration is high", () => {
  const front = structure();
  const [moderate] = rule("B").evaluate(context({ signals: [signal("facial_contour")], observations: front }));
  assert.equal(moderate.confidence, "moderate");

  const left = [measuredObservation({ id: "facialStructure.jawWidth", domain: "facial-structure", label: "Jaw width", value: 0.4, source: "leftFortyFive" })];
  const [high] = rule("B").evaluate(context({ signals: [signal("facial_contour")], observations: [...front, ...left] }));
  assert.equal(high.confidence, "high");
});

test("Rule B: a volume goal alone (generic geometry only) is NOT enough for DERMAL_FILLER", () => {
  const [o] = rule("B").evaluate(context({ signals: [signal("facial_volume")], observations: structure() }));
  assert.equal(o.status, "insufficient_evidence");
  assert.equal(o.category, null);
});

test("Rule B: volume goal + cheek contour geometry from two views → DERMAL_FILLER, capped at moderate; with a definition goal → both", () => {
  const observations = [...structure(), cheekContour("front", "left"), cheekContour("front", "right"), cheekContour("leftFortyFive", "left")];
  const [filler] = rule("B").evaluate(context({ signals: [signal("facial_volume")], observations }));
  assert.equal(filler.category, "DERMAL_FILLER");
  assert.equal(filler.confidence, "moderate"); // explicit + 3 obs + 2 views would be "high" for other evidence; capped here
  assert.ok(filler.evidenceObservationIds.every((id) => id.startsWith("facialStructure.contour.cheekContourAngle.")));
  assertConservativeWording(filler);

  const both = rule("B").evaluate(context({ signals: [signal("facial_volume"), signal("facial_definition")], observations }));
  assert.deepEqual(both.map((o) => o.category), ["DERMAL_FILLER", "FACIAL_CONTOURING"]);
  assert.notDeepEqual(both[0].evidenceQuestionIds, both[1].evidenceQuestionIds);
});

test("Rule B: cheek contour from a single view is not enough for the volume branch (missing angle)", () => {
  const observations = [...structure(), cheekContour("front", "left"), cheekContour("front", "right")];
  const [o] = rule("B").evaluate(context({ signals: [signal("facial_volume")], observations }));
  assert.equal(o.status, "insufficient_evidence");
  assert.equal(o.category, null);
});

test("Rule B: contour evidence present but volume evidence missing → contouring plus an insufficient note for volume", () => {
  const out = rule("B").evaluate(context({ signals: [signal("facial_volume"), signal("facial_definition")], observations: structure() }));
  assert.deepEqual(out.map((o) => [o.status, o.category]), [
    ["potential_opportunity", "FACIAL_CONTOURING"],
    ["insufficient_evidence", null],
  ]);
});

test("Rule B: goal but no structure observations → insufficient_evidence (or not_available if no analysis ran)", () => {
  const goal = [signal("facial_definition")];
  assert.equal(rule("B").evaluate(context({ signals: goal }))[0].status, "insufficient_evidence");
  const none = rule("B").evaluate(context({ signals: goal, photoAnalysisAvailable: false }))[0];
  assert.equal(none.status, "not_available");
  assert.equal(none.category, null);
});

test("Rule C: lifting goal + a lifting-relevant visual observation → FACIAL_LIFTING with cautious wording", () => {
  const ctx = context({
    signals: [signal("facial_lifting")],
    observations: [...structure(), visualFeature("facialStructure.visual.jawlinePosition")],
  });
  // (Reserved contract only: no layer produces this observation today.)
  const [o] = rule("C").evaluate(ctx);
  assert.equal(o.category, "FACIAL_LIFTING");
  assert.equal(
    o.rationale,
    "Your stated goals and available facial observations may justify discussing facial lifting/contouring options with your clinician.",
  );
  assert.ok(o.limitations.some((l) => l.includes("cannot measure tissue laxity")));
  assertConservativeWording(o);
  // Only the lifting-relevant observation is cited — generic geometry is not laxity evidence.
  assert.deepEqual(o.evidenceObservationIds, ["facialStructure.visual.jawlinePosition"]);
});

test("Rule C: a lifting goal with only generic facial geometry → insufficient_evidence, no category", () => {
  const [o] = rule("C").evaluate(context({ signals: [signal("facial_lifting")], observations: structure() }));
  assert.equal(o.status, "insufficient_evidence");
  assert.equal(o.category, null);
});

test("Rule C: does not trigger from contour/definition goals, only from a lifting signal", () => {
  const ctx = context({ signals: [signal("facial_contour"), signal("facial_definition")], observations: structure() });
  assert.deepEqual(rule("C").evaluate(ctx), []);
});

test("Rule D: skin goal + visual skin observations → SKIN_TREATMENT citing images and responses", () => {
  const ctx = context({
    signals: [signal("skin_concern")],
    observations: [visualFeature("skin.visual.unevenTone"), visualFeature("skin.visual.rednessAppearance", "leftFortyFive")],
  });
  const [o] = rule("D").evaluate(ctx);
  assert.equal(o.category, "SKIN_TREATMENT");
  assert.equal(o.confidence, "high");
  assert.equal(
    o.rationale,
    "Your submitted images and responses indicate skin-related concerns that may be worth assessing with your clinician.",
  );
  assert.doesNotMatch(o.rationale, /acne|melasma|rosacea|scarring|dermatitis/i);
});

test("Rule D: user-reported skin concern alone → low-confidence opportunity, wording does not claim images", () => {
  const [o] = rule("D").evaluate(context({ signals: [signal("skin_concern")] }));
  assert.equal(o.status, "potential_opportunity");
  assert.equal(o.confidence, "low");
  assert.equal(
    o.rationale,
    "Your submitted responses indicate skin-related concerns that may be worth assessing with your clinician.",
  );
  assert.deepEqual(o.evidenceObservationIds, []);
});

test("Rule D: a skin observation without a user concern creates nothing", () => {
  assert.deepEqual(rule("D").evaluate(context({ observations: [visualFeature("skin.visual.unevenTexture")] })), []);
});

test("every rule returns nothing when there are no signals (conservative default)", () => {
  for (const r of TREATMENT_RULES) assert.deepEqual(r.evaluate(context({ observations: structure() })), []);
});
