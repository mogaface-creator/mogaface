import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeVideoFrames } from "../../lib/facial-analysis/video/observe.ts";
import { assessFrame } from "../../lib/facial-analysis/video/quality.ts";
import {
  BROW_RAISED,
  FROWNING,
  META,
  NEUTRAL,
  SMILING,
  SQUINTING,
  checker,
  expressionFace,
  flatGray,
  sample,
  stripeCols,
  stripeRows,
  withNeutralOpening,
} from "./fixtures.ts";

const state = (a: ReturnType<typeof analyzeVideoFrames>, s: string) => a.expressions.find((e) => e.expression === s)!;

test("neutral video: baseline established, every expression is insufficient_evidence (nothing guessed)", () => {
  const a = analyzeVideoFrames(META, withNeutralOpening(NEUTRAL(), NEUTRAL()));
  assert.equal(a.status, "analyzed");
  assert.equal(a.baseline?.stable, true);
  assert.deepEqual(a.baseline?.frames, [0, 1, 2]);
  assert.ok(a.classifications.every((c) => c.state === "NEUTRAL"));
  assert.ok(a.expressions.every((e) => e.status === "insufficient_evidence" && e.strength === null && e.evidence.movementPct === null));
});

test("brow raise: observed in the forehead region with neutral and expression frames as provenance", () => {
  const a = analyzeVideoFrames(META, withNeutralOpening(BROW_RAISED()));
  const e = state(a, "BROW_RAISE");
  assert.equal(e.type, "dynamic_expression_observation");
  assert.equal(e.status, "observed");
  assert.equal(e.region, "FOREHEAD");
  assert.deepEqual(e.evidence.neutralFrames, [0, 1, 2]);
  assert.deepEqual(e.evidence.expressionFrames, [3]);
  assert.ok(Math.abs(e.evidence.movementPct! - 27.27) < 0.1);
  assert.match(e.evidence.movementMetric, /brow-to-eye/);
});

test("frown → glabellar region; smile → mouth area; squint → eye area", () => {
  const a = analyzeVideoFrames(META, withNeutralOpening(FROWNING(), SMILING(), SQUINTING()));
  assert.deepEqual([state(a, "FROWN").status, state(a, "FROWN").region], ["observed", "GLABELLA"]);
  assert.deepEqual([state(a, "SMILE").status, state(a, "SMILE").region], ["observed", "MOUTH_AREA"]);
  assert.deepEqual([state(a, "SQUINT").status, state(a, "SQUINT").region], ["observed", "EYE_AREA"]);
  assert.equal(state(a, "BROW_RAISE").status, "insufficient_evidence");
});

test("missing expression state: reported as insufficient_evidence with a reason", () => {
  const a = analyzeVideoFrames(META, withNeutralOpening(BROW_RAISED()));
  const smile = state(a, "SMILE");
  assert.equal(smile.status, "insufficient_evidence");
  assert.match(smile.reason, /No frame could be reliably identified as smile/);
  assert.deepEqual(smile.evidence.expressionFrames, []);
});

test("ambiguous frames are never used as evidence for any state", () => {
  const a = analyzeVideoFrames(META, withNeutralOpening(expressionFace({ browRaise: 0.004 })));
  assert.equal(a.classifications.at(-1)?.state, "AMBIGUOUS");
  assert.ok(a.expressions.every((e) => e.status === "insufficient_evidence"));
});

test("evidence strength: moderate with one expression frame, high with 3+ consistent frames", () => {
  const one = analyzeVideoFrames(META, withNeutralOpening(BROW_RAISED()));
  assert.equal(state(one, "BROW_RAISE").strength, "moderate");

  const many = analyzeVideoFrames(META, withNeutralOpening(BROW_RAISED(), expressionFace({ browRaise: 0.016 }), expressionFace({ browRaise: 0.014 })));
  assert.equal(state(many, "BROW_RAISE").strength, "high");
});

test("evidence strength: 3 frames whose movement is inconsistent stay moderate", () => {
  const a = analyzeVideoFrames(META, withNeutralOpening(expressionFace({ browRaise: 0.007 }), expressionFace({ browRaise: 0.03 }), expressionFace({ browRaise: 0.06 })));
  assert.equal(state(a, "BROW_RAISE").strength, "moderate");
});

test("no steady neutral opening → no baseline → every state insufficient with the reason", () => {
  const frames = [NEUTRAL(), BROW_RAISED(), NEUTRAL(), SMILING()].map((lm, i) => sample(i, lm));
  const a = analyzeVideoFrames(META, frames);
  assert.equal(a.status, "insufficient_evidence");
  assert.equal(a.baseline, null);
  assert.ok(a.expressions.every((e) => e.status === "insufficient_evidence"));
  assert.match(a.notes.join(), /steady neutral face|still, relaxed/);
});

test("a single usable frame gives an unstable (low-evidence) baseline and no expression evidence", () => {
  const a = analyzeVideoFrames(META, [sample(0, NEUTRAL())]);
  assert.equal(a.baseline?.stable, false);
  assert.ok(a.expressions.every((e) => e.status === "insufficient_evidence"));
});

// ---- frame quality ----

test("poor-quality frame: too dark is unusable", () => {
  const f = assessFrame(sample(0, NEUTRAL(), { meanBrightness: 15 }));
  assert.equal(f.usable, false);
  assert.match(f.reasons.join(), /too dark or too bright/);
});

test("no face detected: unusable", () => {
  const f = assessFrame(sample(0, null));
  assert.equal(f.usable, false);
  assert.match(f.reasons.join(), /No face detected/);
});

test("multiple faces: unusable", () => {
  const f = assessFrame(sample(0, null, { faceCount: 2 }));
  assert.equal(f.usable, false);
  assert.match(f.reasons.join(), /Multiple faces/);
});

test("face cut off by the frame edge: unusable", () => {
  const cut = NEUTRAL().map((p) => ({ ...p, x: p.x + 0.26 }));
  assert.equal(assessFrame(sample(0, cut)).usable, false);
});

test("head turned or tilted: unusable for expression comparison", () => {
  assert.match(assessFrame(sample(0, expressionFace({ yawShift: 0.1 }))).reasons.join(), /turned away/);
  assert.match(assessFrame(sample(0, expressionFace({ tiltY: 0.15 }))).reasons.join(), /tilted/);
});

test("a good front frame is usable", () => {
  assert.deepEqual(assessFrame(sample(0, NEUTRAL())).reasons, []);
  assert.equal(assessFrame(sample(0, NEUTRAL())).usable, true);
});

test("unusable frames are excluded from the baseline and from classification", () => {
  const frames = [
    sample(0, null), // no face
    sample(1, NEUTRAL(), { meanBrightness: 10 }), // too dark
    ...[NEUTRAL(), NEUTRAL(), NEUTRAL(), BROW_RAISED()].map((lm, i) => sample(i + 2, lm)),
  ];
  const a = analyzeVideoFrames(META, frames);
  assert.equal(a.framesSampled, 6);
  assert.equal(a.framesUsable, 4);
  assert.deepEqual(a.baseline?.frames, [2, 3, 4]);
  assert.deepEqual(state(a, "BROW_RAISE").evidence.expressionFrames, [5]);
});

test("every frame unusable → insufficient_evidence with an explanation, not a crash", () => {
  const a = analyzeVideoFrames(META, [sample(0, null), sample(1, null, { faceCount: 3 })]);
  assert.equal(a.status, "insufficient_evidence");
  assert.match(a.notes[0], /single, clear, front-facing face/);
});

test("invalid video metadata short-circuits with insufficient_evidence", () => {
  const a = analyzeVideoFrames({ ...META, mimeType: "image/png" }, withNeutralOpening(BROW_RAISED()));
  assert.equal(a.status, "insufficient_evidence");
  assert.match(a.notes[0], /not a video/);
});

// ---- within-video line contrast ----

function withGray(frames: ReturnType<typeof withNeutralOpening>, paint: (index: number) => ReturnType<typeof flatGray>) {
  return frames.map((f) => ({ ...f, gray: paint(f.index) }));
}
const pattern = (a: ReturnType<typeof analyzeVideoFrames>, kind: string, expression: string) =>
  a.linePatterns.find((p) => p.kind === kind && p.expression === expression)!;

test("forehead line pattern: observed when brow-raise frames are more line-banded than neutral frames of the same video", () => {
  const frames = withGray(withNeutralOpening(BROW_RAISED(), expressionFace({ browRaise: 0.016 })), (i) =>
    i >= 3 ? stripeRows(flatGray(), 300, 700, 150, 330) : flatGray(),
  );
  const p = pattern(analyzeVideoFrames(META, frames), "forehead", "BROW_RAISE");
  assert.equal(p.status, "observed");
  assert.equal(p.mode, "DYNAMIC_VIDEO_EVIDENCE");
  assert.ok(p.contrastRatio! >= 1.3);
  assert.deepEqual(p.neutralFrames, [0, 1, 2]);
  assert.deepEqual(p.expressionFrames, [3, 4]);
});

test("forehead line pattern: NOT observed when both neutral and raised frames look the same", () => {
  const same = () => stripeRows(flatGray(), 300, 700, 150, 330);
  const p = pattern(analyzeVideoFrames(META, withGray(withNeutralOpening(BROW_RAISED()), same)), "forehead", "BROW_RAISE");
  assert.equal(p.status, "insufficient_evidence");
  assert.match(p.reason, /did not clearly differ/);
});

test("line pattern: no pixel data → insufficient_evidence (never assumed present)", () => {
  const p = pattern(analyzeVideoFrames(META, withNeutralOpening(BROW_RAISED())), "forehead", "BROW_RAISE");
  assert.equal(p.status, "insufficient_evidence");
  assert.match(p.reason, /Pixel data/);
});

test("line pattern: needs the expression itself — stripes with no brow raise are not a forehead pattern", () => {
  const frames = withGray(withNeutralOpening(NEUTRAL()), (i) => (i >= 3 ? stripeRows(flatGray(), 300, 700, 150, 330) : flatGray()));
  const p = pattern(analyzeVideoFrames(META, frames), "forehead", "BROW_RAISE");
  assert.equal(p.status, "insufficient_evidence");
  assert.match(p.reason, /No reliable/);
});

test("glabellar and lateral-eye patterns are detected from frown and smile frames", () => {
  const frames = withGray(withNeutralOpening(FROWNING(), SMILING()), (i) => {
    const g = flatGray();
    if (i === 3) stripeCols(g, 440, 560, 250, 360);
    if (i === 4) {
      checker(g, 262, 318, 350, 450);
      checker(g, 682, 738, 350, 450);
    }
    return g;
  });
  const a = analyzeVideoFrames(META, frames);
  assert.equal(pattern(a, "glabellar", "FROWN").status, "observed");
  assert.equal(pattern(a, "lateralEye", "SMILE").status, "observed");
  assert.equal(pattern(a, "lateralEye", "SQUINT").status, "insufficient_evidence");
});
