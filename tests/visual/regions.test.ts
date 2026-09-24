import { test } from "node:test";
import assert from "node:assert/strict";
import {
  clipRect,
  foreheadRegion,
  glabellarRegion,
  lateralEyeRegions,
  lineBandContrast,
  localTextureContrast,
  meanLuminance,
  underEyeRegions,
} from "../../lib/facial-analysis/regions.ts";
import { measureUnderEye } from "../../lib/facial-analysis/underEye.ts";
import { NEUTRAL, SIZE, checker, flatGray, stripeCols, stripeRows } from "./fixtures.ts";

const rect = { x0: 100, x1: 300, y0: 100, y1: 300 };

test("clipRect clips to the image and rejects regions too small to measure", () => {
  assert.deepEqual(clipRect({ x0: -50, x1: 2000, y0: 10, y1: 20 }, flatGray()), { x0: 0, x1: SIZE, y0: 10, y1: 20 });
  assert.equal(clipRect({ x0: 5, x1: 8, y0: 5, y1: 300 }, flatGray()), null);
  assert.equal(clipRect({ x0: Number.NaN, x1: 10, y0: 0, y1: 10 }, flatGray()), null);
});

test("meanLuminance", () => {
  assert.equal(meanLuminance(flatGray(90), rect), 90);
});

test("line contrast: horizontal stripes score high horizontally, near zero vertically; flat scores zero", () => {
  const striped = stripeRows(flatGray(), 100, 300, 100, 300);
  assert.ok(lineBandContrast(striped, rect, "horizontal")! > 0.1);
  assert.ok(lineBandContrast(striped, rect, "vertical")! < 0.01);
  assert.ok(lineBandContrast(flatGray(), rect, "horizontal")! < 1e-9);
});

test("line contrast: vertical stripes score high vertically only", () => {
  const striped = stripeCols(flatGray(), 100, 300, 100, 300);
  assert.ok(lineBandContrast(striped, rect, "vertical")! > 0.1);
  assert.ok(lineBandContrast(striped, rect, "horizontal")! < 0.01);
});

test("line contrast ignores a slow lighting gradient (it is high-passed away)", () => {
  const img = flatGray();
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) img.data[y * SIZE + x] = 60 + y * 0.1;
  assert.ok(lineBandContrast(img, rect, "horizontal")! < 0.02);
});

test("line contrast returns null for a too-small or too-dark region, not NaN", () => {
  assert.equal(lineBandContrast(flatGray(), { x0: 0, x1: 3, y0: 0, y1: 3 }, "horizontal"), null);
  assert.equal(lineBandContrast(flatGray(2), rect, "horizontal"), null);
});

test("local texture contrast: fine checker pattern scores high, flat scores zero", () => {
  assert.ok(localTextureContrast(checker(flatGray(), 100, 300, 100, 300), rect)! > 0.1);
  assert.ok(localTextureContrast(flatGray(), rect)! < 1e-9);
});

test("landmark-derived regions sit where they should on a neutral face", () => {
  const img = flatGray();
  const lm = NEUTRAL();
  const fh = foreheadRegion(lm, img)!;
  const gl = glabellarRegion(lm, img)!;
  const [rightLat, leftLat] = lateralEyeRegions(lm, img);
  assert.ok(fh.y1 <= 330 && fh.y0 >= 150, "forehead is above the brows");
  assert.ok(gl.x0 >= 450 && gl.x1 <= 550, "glabellar region is between the inner brows");
  assert.ok(rightLat!.x1 <= 320 && leftLat!.x0 >= 680, "lateral regions are outside the outer eye corners");
  const [right] = underEyeRegions(lm, img);
  assert.ok(right.underEye!.y0 > 415 && right.cheek!.y0 > right.underEye!.y1, "under-eye strip is below the lid, cheek reference below it");
});

test("regions return null (not a bad box) when the face is missing or too small", () => {
  const tiny = NEUTRAL().map((p) => ({ ...p, x: 0.5, y: 0.5 }));
  assert.equal(foreheadRegion(tiny, flatGray()), null);
});

test("under-eye: a darker strip below the lids gives a ratio below 1, per eye", () => {
  const img = flatGray(120);
  for (let y = 440; y < 476; y++) for (let x = 330; x < 440; x++) img.data[y * SIZE + x] = 90; // right eye strip
  const m = measureUnderEye(img, NEUTRAL());
  assert.ok(Math.abs(m.right!.luminanceRatio - 0.75) < 0.01);
  assert.ok(Math.abs(m.left!.luminanceRatio - 1) < 0.01);
});

test("under-eye: an image with no contrast gives a ratio of 1 (no darkness claimed)", () => {
  const m = measureUnderEye(flatGray(), NEUTRAL());
  assert.equal(m.right!.luminanceRatio, 1);
});

test("under-eye: unmeasurable regions give null per side, never a guess", () => {
  const m = measureUnderEye(flatGray(), NEUTRAL().map((p) => ({ ...p, x: 0.5, y: 0.5 })));
  assert.deepEqual(m, { right: null, left: null });
});
