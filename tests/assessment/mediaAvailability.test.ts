import { test } from "node:test";
import assert from "node:assert/strict";
import { canStartAnalysis, hasRequiredPhotoFiles, slotsMissingActualFile } from "../../lib/assessment/mediaAvailability.ts";
import { createEmptyAssessment } from "../../lib/assessment/defaults.ts";
import type { Assessment, PhotoSlot } from "../../lib/assessment/types.ts";

function stamp(slot: PhotoSlot) {
  return { slot, fileName: `${slot}.jpg`, sizeBytes: 1, uploadedAt: new Date().toISOString() };
}

function assessmentWithPhotos(slots: PhotoSlot[]): Assessment {
  return { ...createEmptyAssessment(), photos: slots.map(stamp) };
}

test("the exact reported bug: metadata says 5/5, only 3 files actually survived the reload", () => {
  const assessment = assessmentWithPhotos(["front", "leftFortyFive", "rightFortyFive", "leftProfile", "rightProfile"]);
  const available = new Set<PhotoSlot>(["front", "leftFortyFive", "rightFortyFive"]);

  const missing = slotsMissingActualFile(assessment, available);
  assert.deepEqual(
    missing.map((m) => m.slot),
    ["leftProfile", "rightProfile"],
  );
  assert.equal(available.size, 3); // the accurate "3 / 5", not the stale "5 / 5"
});

test("nothing is reported missing when every uploaded slot actually has a file", () => {
  const assessment = assessmentWithPhotos(["front", "leftFortyFive", "rightFortyFive"]);
  const available = new Set<PhotoSlot>(["front", "leftFortyFive", "rightFortyFive"]);
  assert.deepEqual(slotsMissingActualFile(assessment, available), []);
});

test("a slot that was never uploaded is not reported as missing (only ones with stale metadata are)", () => {
  const assessment = assessmentWithPhotos(["front"]);
  const available = new Set<PhotoSlot>();
  const missing = slotsMissingActualFile(assessment, available);
  assert.deepEqual(
    missing.map((m) => m.slot),
    ["front"],
  );
  assert.ok(!missing.some((m) => m.slot === "leftFortyFive"));
});

test("hasRequiredPhotoFiles requires all three required slots, ignores profile slots", () => {
  assert.equal(hasRequiredPhotoFiles(new Set<PhotoSlot>(["front", "leftFortyFive", "rightFortyFive"])), true);
  assert.equal(hasRequiredPhotoFiles(new Set<PhotoSlot>(["front", "leftFortyFive"])), false);
  assert.equal(
    hasRequiredPhotoFiles(new Set<PhotoSlot>(["front", "leftFortyFive", "rightFortyFive", "leftProfile", "rightProfile"])),
    true,
  );
  assert.equal(hasRequiredPhotoFiles(new Set<PhotoSlot>(["leftProfile", "rightProfile"])), false);
});

test("canStartAnalysis is false until media has been hydrated, even with all required files present", () => {
  const available = new Set<PhotoSlot>(["front", "leftFortyFive", "rightFortyFive"]);
  assert.equal(canStartAnalysis(available, false), false);
  assert.equal(canStartAnalysis(available, true), true);
});

test("canStartAnalysis is false when a required photo's file isn't available", () => {
  const available = new Set<PhotoSlot>(["front", "leftFortyFive"]);
  assert.equal(canStartAnalysis(available, true), false);
});

test("canStartAnalysis stays true when only an optional profile photo is unavailable — profiles never block analysis", () => {
  const available = new Set<PhotoSlot>(["front", "leftFortyFive", "rightFortyFive"]);
  // leftProfile/rightProfile have stale metadata but no file — irrelevant to the gate.
  assert.equal(canStartAnalysis(available, true), true);
});
