import { test } from "node:test";
import assert from "node:assert/strict";
import { viewCategoryForSlot } from "../../lib/facial-analysis/multiPhoto/types.ts";
import { VIEW_CAPABILITIES } from "../../lib/facial-analysis/multiPhoto/viewCapabilities.ts";
import { PHOTO_SLOTS } from "../../lib/assessment/types.ts";

test("viewCategoryForSlot maps every assessment photo slot to a category", () => {
  assert.equal(viewCategoryForSlot("front"), "front");
  assert.equal(viewCategoryForSlot("leftFortyFive"), "threeQuarter");
  assert.equal(viewCategoryForSlot("rightFortyFive"), "threeQuarter");
  assert.equal(viewCategoryForSlot("leftProfile"), "profile");
  assert.equal(viewCategoryForSlot("rightProfile"), "profile");
});

test("every PHOTO_SLOTS entry resolves to a defined view category", () => {
  for (const { slot } of PHOTO_SLOTS) {
    const category = viewCategoryForSlot(slot);
    assert.ok(["front", "threeQuarter", "profile"].includes(category));
  }
});

test("view capability's combinable metrics are always a subset of its computable metrics", () => {
  for (const capability of Object.values(VIEW_CAPABILITIES)) {
    for (const metric of capability.combinable) {
      assert.ok(capability.computable.includes(metric), `${metric} is combinable but not listed as computable`);
    }
  }
});

test("profile has no combinable metrics (Step 7: never calculate frontal measurements from profile photos)", () => {
  assert.deepEqual(VIEW_CAPABILITIES.profile.combinable, []);
  assert.deepEqual(VIEW_CAPABILITIES.profile.computable, []);
});

test("threeQuarter computes the same metrics as front but combines none of them", () => {
  assert.deepEqual(VIEW_CAPABILITIES.threeQuarter.computable, VIEW_CAPABILITIES.front.computable);
  assert.deepEqual(VIEW_CAPABILITIES.threeQuarter.combinable, []);
});

test("front is the only view whose computable metrics are all combinable", () => {
  assert.deepEqual(VIEW_CAPABILITIES.front.combinable, VIEW_CAPABILITIES.front.computable);
});
