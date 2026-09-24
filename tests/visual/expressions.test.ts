import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MOVEMENT_THRESHOLD_PCT,
  classifyFrame,
  computeExpressionFeatures,
  establishBaseline,
  movementPercent,
} from "../../lib/facial-analysis/video/expressions.ts";
import type { NeutralBaseline } from "../../lib/facial-analysis/video/types.ts";
import { BROW_RAISED, FROWNING, NEUTRAL, SIZE, SMILING, SQUINTING, expressionFace } from "./fixtures.ts";

const feat = (lm = NEUTRAL()) => computeExpressionFeatures(lm, SIZE, SIZE)!;
const baseline = (): NeutralBaseline => ({ frames: [0, 1, 2], features: feat(), stable: true, maxSpread: 0 });

test("neutral frame: features are finite, positive, and scale-free (interocular-normalized)", () => {
  const f = feat();
  assert.ok(Object.values(f).every((v) => Number.isFinite(v) && v > 0));
  assert.ok(Math.abs(f.browToEye - 0.55) < 1e-9);
  assert.ok(Math.abs(f.mouthWidth - 2) < 1e-9);
});

test("features do not depend on where the face sits in the frame or how large it is", () => {
  const shifted = NEUTRAL().map((p) => ({ ...p, x: p.x * 0.5 + 0.2, y: p.y * 0.5 + 0.2 }));
  const a = feat();
  const b = computeExpressionFeatures(shifted, SIZE, SIZE)!;
  for (const k of Object.keys(a) as (keyof typeof a)[]) assert.ok(Math.abs(a[k] - b[k]) < 1e-9, k);
});

test("features return null instead of NaN for missing or collapsed landmarks", () => {
  assert.equal(computeExpressionFeatures([], SIZE, SIZE), null);
  const collapsed = NEUTRAL();
  collapsed[133] = { ...collapsed[362] }; // inner eye corners coincide → interocular distance 0
  assert.equal(computeExpressionFeatures(collapsed, SIZE, SIZE), null);
});

test("baseline: three steady neutral frames are stable, and the baseline is their median", () => {
  const u = [0, 1, 2].map((index) => ({ index, features: feat() }));
  const { baseline: b, note } = establishBaseline(u);
  assert.equal(b?.stable, true);
  assert.deepEqual(b?.frames, [0, 1, 2]);
  assert.equal(note, null);
});

test("baseline: opening frames that are not a steady neutral face give NO baseline (no guessing)", () => {
  const u = [NEUTRAL(), BROW_RAISED(), NEUTRAL()].map((lm, index) => ({ index, features: feat(lm) }));
  const { baseline: b, note } = establishBaseline(u);
  assert.equal(b, null);
  assert.match(note!, /steady neutral face/);
});

test("baseline: a single usable frame is kept but flagged unstable; no frames → none", () => {
  const one = establishBaseline([{ index: 4, features: feat() }]);
  assert.equal(one.baseline?.stable, false);
  assert.match(one.note!, /stability could not be checked/);
  assert.equal(establishBaseline([]).baseline, null);
});

test("expression comparison: each state moves its own metric in the expected direction", () => {
  const b = feat();
  const m = (lm: ReturnType<typeof NEUTRAL>) => movementPercent(feat(lm), b);
  assert.ok(Math.abs(m(BROW_RAISED()).BROW_RAISE - 27.27) < 0.1);
  assert.ok(m(FROWNING()).FROWN > 15);
  assert.ok(Math.abs(m(SMILING()).SMILE - 20) < 0.1);
  assert.ok(Math.abs(m(SQUINTING()).SQUINT - 40) < 0.1);
  // and not the opposite way
  assert.ok(m(BROW_RAISED()).FROWN < 0 && m(SMILING()).SQUINT <= 0.01);
  // neutral vs itself is zero everywhere
  for (const v of Object.values(m(NEUTRAL()))) assert.ok(Math.abs(v) < 1e-9);
});

test("classify: neutral frame", () => {
  assert.equal(classifyFrame(0, feat(), baseline()).state, "NEUTRAL");
});

test("classify: brow raise, frown, smile, squint", () => {
  assert.equal(classifyFrame(1, feat(BROW_RAISED()), baseline()).state, "BROW_RAISE");
  assert.equal(classifyFrame(2, feat(FROWNING()), baseline()).state, "FROWN");
  assert.equal(classifyFrame(3, feat(SMILING()), baseline()).state, "SMILE");
  assert.equal(classifyFrame(4, feat(SQUINTING()), baseline()).state, "SQUINT");
});

test("classify: a frame between neutral and an expression is AMBIGUOUS, never forced into a state", () => {
  const partial = expressionFace({ browRaise: 0.004 }); // ~ +7%: above neutral tolerance, below the 12% threshold
  assert.equal(classifyFrame(0, feat(partial), baseline()).state, "AMBIGUOUS");
});

test("classify: two competing expressions are AMBIGUOUS (smile with a strong squint)", () => {
  const both = expressionFace({ smile: 0.02, squint: 0.006 });
  assert.equal(classifyFrame(0, feat(both), baseline()).state, "AMBIGUOUS");
});

test("thresholds are documented as positive numbers for every active state", () => {
  for (const v of Object.values(MOVEMENT_THRESHOLD_PCT)) assert.ok(v > 0);
});
