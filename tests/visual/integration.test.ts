import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateTreatmentOpportunities } from "../../lib/treatment-opportunities/evaluate.ts";
import { explainOpportunity } from "../../lib/treatment-opportunities/evidence.ts";
import { validateOpportunity } from "../../lib/treatment-opportunities/validate.ts";
import { buildMogaFaceAnalysis } from "../../lib/observation/build.ts";
import { calculateContourGeometry } from "../../lib/facial-analysis/contour.ts";
import { LANDMARK } from "../../lib/facial-analysis/landmarkMapping.ts";
import { analyzeVideoFrames } from "../../lib/facial-analysis/video/observe.ts";
import { createEmptyAppearanceConcerns, type AppearanceConcerns } from "../../lib/assessment/appearanceConcerns.ts";
import { buildCompleteFrontRecord, buildFilledAssessment, buildMultiPhotoAnalysisWithFront } from "../observation/fixtures.ts";
import type { Assessment } from "../../lib/assessment/types.ts";
import { BROW_RAISED, META, contourFace, expressionFace, flatGray, stripeRows, withNeutralOpening } from "./fixtures.ts";

function assessmentWith(partial: Partial<AppearanceConcerns>): Assessment {
  const a = buildFilledAssessment();
  a.goals = { areas: [], priorities: [] };
  a.appearanceConcerns = { ...createEmptyAppearanceConcerns(), ...partial };
  return a;
}

function photos(withLeft45: boolean) {
  const front = buildCompleteFrontRecord();
  front.contour = calculateContourGeometry(contourFace(), 1200, 1600, "front");
  front.underEye = {
    right: { underEyeLuminance: 70, cheekLuminance: 100, luminanceRatio: 0.7 },
    left: { underEyeLuminance: 70, cheekLuminance: 100, luminanceRatio: 0.7 },
  };
  const records = [front];
  if (withLeft45) {
    const turned = contourFace();
    turned[LANDMARK.noseTip] = { x: 0.35, y: 0.55, z: 0 };
    records.push({ ...buildCompleteFrontRecord(), slot: "leftFortyFive", contour: calculateContourGeometry(turned, 1200, 1600, "threeQuarter") });
  }
  return { ...buildMultiPhotoAnalysisWithFront(), photos: records };
}

const stripedVideo = () =>
  analyzeVideoFrames(
    META,
    withNeutralOpening(BROW_RAISED(), expressionFace({ browRaise: 0.016 })).map((f) => ({ ...f, gray: f.index >= 3 ? stripeRows(flatGray(), 300, 700, 150, 330) : flatGray() })),
  );
const flatVideo = () =>
  analyzeVideoFrames(META, withNeutralOpening(BROW_RAISED()).map((f) => ({ ...f, gray: stripeRows(flatGray(), 300, 700, 150, 330) })));

const run = (a: Assessment, opts: { left45?: boolean; video?: ReturnType<typeof stripedVideo> | null } = {}) =>
  evaluateTreatmentOpportunities({ assessment: a, analysis: buildMogaFaceAnalysis(a, photos(opts.left45 ?? false), opts.video ?? null) });

const lines: Partial<AppearanceConcerns> = { selected: ["FACIAL_LINES"], details: ["FOREHEAD_LINES"] };

test("Treatment Opportunity Engine consumes the new observations: user goal + video line pattern + video movement → NEUROMODULATOR", () => {
  const [o] = run(assessmentWith(lines), { video: stripedVideo() });
  assert.equal(o.status, "potential_opportunity");
  assert.equal(o.category, "NEUROMODULATOR");
  assert.equal(o.confidence, "moderate"); // one video is one source; no independent corroboration exists
  assert.equal(o.clinicianReviewRequired, true);
  assert.deepEqual(validateOpportunity(o), []);
  assert.ok(o.evidenceObservationIds.includes("expression.visibleForeheadLinePattern"));
  assert.ok(o.evidenceObservationIds.includes("expression.browRaise.foreheadRegionMovementPct"));
  assert.ok(o.evidenceQuestionIds.includes("appearanceConcerns.details.FOREHEAD_LINES"));
  assert.match(o.rationale, /images\/video show features associated with facial expression lines\. A neuromodulator consultation may be worth discussing with your clinician\./);
  assert.doesNotMatch(o.rationale + o.title, /you need|botox is|required/i);
  const why = explainOpportunity(o);
  assert.ok(why.reasons.some((r) => r.startsWith("Video evidence:")));
  assert.ok(why.reasons.some((r) => r.startsWith("Relevant facial observation: Visible forehead line pattern")));
});

test("FACIAL_LINES is not enough on its own: no video → insufficient_evidence, no category", () => {
  const [o] = run(assessmentWith(lines));
  assert.equal(o.status, "insufficient_evidence");
  assert.equal(o.category, null);
});

test("FACIAL_LINES with a video that shows movement but no increase in line contrast → still insufficient_evidence", () => {
  const video = flatVideo();
  assert.equal(video.expressions.find((e) => e.expression === "BROW_RAISE")?.status, "observed");
  const [o] = run(assessmentWith(lines), { video });
  assert.equal(o.status, "insufficient_evidence");
  assert.equal(o.category, null);
  assert.notEqual(o.category, "NEUROMODULATOR");
});

test("FACIAL_LINES with a video that yielded no baseline → insufficient_evidence (video was analyzed, not 'unavailable')", () => {
  const [o] = run(assessmentWith(lines), { video: analyzeVideoFrames(META, []) });
  assert.equal(o.status, "insufficient_evidence");
});

test("volume opportunity with valid evidence: cheek contour geometry from front + 45° → DERMAL_FILLER, capped at moderate, cautious wording", () => {
  const out = run(assessmentWith({ selected: ["FACIAL_VOLUME"], details: ["CHEEK_FULLNESS"] }), { left45: true });
  const o = out.find((x) => x.category === "DERMAL_FILLER")!;
  assert.equal(o.status, "potential_opportunity");
  assert.equal(o.confidence, "moderate");
  assert.ok(o.evidenceObservationIds.some((id) => id.includes("cheekContourAngle.front")));
  assert.ok(o.evidenceObservationIds.some((id) => id.includes("cheekContourAngle.leftFortyFive")));
  assert.match(o.rationale, /may be worth discussing with your clinician/);
  assert.deepEqual(validateOpportunity(o), []);
});

test("volume goal with front-only contour (missing angle) stays insufficient_evidence", () => {
  const out = run(assessmentWith({ selected: ["FACIAL_VOLUME"] }), { left45: false });
  assert.deepEqual(out.map((o) => [o.status, o.category]), [["insufficient_evidence", null]]);
});

test("lifting stays insufficient_evidence even with every new observation present (no validated lifting method)", () => {
  const out = run(assessmentWith({ selected: ["FACIAL_LIFTING"], details: ["JAWLINE_LIFTING"] }), { left45: true, video: stripedVideo() });
  assert.deepEqual(out.map((o) => [o.concern, o.status, o.category]), [["facial_lifting", "insufficient_evidence", null]]);
});

test("under-eye concern with a real 'dark-looking' observation is still only recorded — no opportunity", () => {
  const a = assessmentWith({ selected: ["UNDER_EYE"], details: ["DARK_LOOKING_UNDER_EYES"] });
  const analysis = buildMogaFaceAnalysis(a, photos(false));
  assert.ok(analysis.observations.some((o) => o.id === "eyeArea.visibleUnderEyeDarkness"));
  assert.deepEqual(evaluateTreatmentOpportunities({ assessment: a, analysis }), []);
});

test("contour goal + two-view geometry → FACIAL_CONTOURING; skin stays user-reported at low confidence", () => {
  const out = run(assessmentWith({ selected: ["FACIAL_DEFINITION", "SKIN_TONE"], details: ["JAW_DEFINITION"] }), { left45: true });
  const contouring = out.find((o) => o.category === "FACIAL_CONTOURING")!;
  assert.equal(contouring.status, "potential_opportunity");
  assert.ok(contouring.evidenceObservationIds.some((id) => id.startsWith("facialStructure.contour.")));
  const skin = out.find((o) => o.category === "SKIN_TREATMENT")!;
  assert.equal(skin.confidence, "low");
  assert.deepEqual(skin.evidenceObservationIds, []);
});

test("the questionnaire alone still creates no visual evidence: without photos or video, only insufficient/not_available", () => {
  const a = assessmentWith({ selected: ["FACIAL_LINES", "FACIAL_VOLUME", "FACIAL_LIFTING", "UNDER_EYE"] });
  const out = evaluateTreatmentOpportunities({ assessment: a, analysis: null });
  assert.ok(out.every((o) => o.status !== "potential_opportunity"));
  assert.ok(out.every((o) => o.category === null));
});

test("no treatment recommendation language leaks from the observation layer into any opportunity", () => {
  const a = assessmentWith({ selected: ["FACIAL_LINES", "FACIAL_VOLUME", "FACIAL_DEFINITION", "SKIN_TEXTURE"], details: ["FOREHEAD_LINES"] });
  const text = JSON.stringify(run(a, { left45: true, video: stripedVideo() }));
  assert.doesNotMatch(text, /you need|guarantee|suitable for|will benefit|diagnos(is|ed) (of|with)|\d\s?%/i);
});
