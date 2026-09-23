import { test } from "node:test";
import assert from "node:assert/strict";
import { validateFront, validateThreeQuarter, validateProfile } from "../../lib/facial-analysis/multiPhoto/viewValidation.ts";
import { LANDMARK } from "../../lib/facial-analysis/landmarkMapping.ts";
import { buildSymmetricFace } from "../facial-analysis/fixtures.ts";
import type { LandmarkList } from "../../lib/facial-analysis/types.ts";

function collapseEye(landmarks: LandmarkList, side: "left" | "right"): LandmarkList {
  const copy = landmarks.map((p) => ({ ...p }));
  if (side === "left") {
    copy[LANDMARK.leftEyeOuter] = { ...copy[LANDMARK.leftEyeInner] };
  } else {
    copy[LANDMARK.rightEyeOuter] = { ...copy[LANDMARK.rightEyeInner] };
  }
  return copy;
}

test("validateFront is plausible when both eyes have normal width", () => {
  const result = validateFront(buildSymmetricFace());
  assert.equal(result.plausible, true);
  assert.deepEqual(result.warnings, []);
  assert.ok(result.notes.length > 0, "should always document its own limitation");
});

test("validateFront warns when an eye is collapsed (implausible for a front photo)", () => {
  const result = validateFront(collapseEye(buildSymmetricFace(), "right"));
  assert.equal(result.plausible, false);
  assert.ok(result.warnings.length > 0);
});

test("validateThreeQuarter is plausible when both eyes still have some width", () => {
  const result = validateThreeQuarter(buildSymmetricFace(), "left");
  assert.equal(result.plausible, true);
});

test("validateThreeQuarter warns when the far eye has collapsed entirely (looks like a profile)", () => {
  // side "left" means the LEFT eye is the "near" eye; collapse the right (far) eye.
  const result = validateThreeQuarter(collapseEye(buildSymmetricFace(), "right"), "left");
  assert.equal(result.plausible, false);
  assert.ok(result.warnings.some((w) => w.toLowerCase().includes("side-on")));
});

test("validateThreeQuarter warns when the near eye has collapsed", () => {
  const result = validateThreeQuarter(collapseEye(buildSymmetricFace(), "left"), "left");
  assert.equal(result.plausible, false);
});

test("validateProfile only requires that landmarks exist, never warns about eye visibility", () => {
  const bothEyesCollapsed = collapseEye(collapseEye(buildSymmetricFace(), "left"), "right");
  const result = validateProfile(bothEyesCollapsed);
  assert.equal(result.plausible, true);
  assert.deepEqual(result.warnings, []);
  assert.ok(result.notes.length > 0);
});

test("validateProfile is not plausible for an empty landmark list", () => {
  const result = validateProfile([]);
  assert.equal(result.plausible, false);
});
