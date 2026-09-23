import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeAssessment } from "../../lib/assessment/schema.ts";
import { createEmptyAssessment } from "../../lib/assessment/defaults.ts";
import { PHOTO_SLOTS } from "../../lib/assessment/types.ts";

test("PHOTO_SLOTS defines exactly the five required slots, each once", () => {
  assert.equal(PHOTO_SLOTS.length, 5);
  const uniqueSlots = new Set(PHOTO_SLOTS.map((p) => p.slot));
  assert.equal(uniqueSlots.size, 5);
});

test("sanitizeAssessment accepts valid photo metadata entries", () => {
  const assessment = createEmptyAssessment();
  const withPhoto: Record<string, unknown> = {
    ...assessment,
    photos: [{ slot: "front", fileName: "front.jpg", sizeBytes: 12345, uploadedAt: new Date().toISOString() }],
  };
  const sanitized = sanitizeAssessment(withPhoto);
  assert.notEqual(sanitized, null);
  assert.equal(sanitized?.photos.length, 1);
  assert.equal(sanitized?.photos[0].slot, "front");
});

test("sanitizeAssessment rejects a photo entry with an unknown slot", () => {
  const assessment = createEmptyAssessment();
  const badSlot: Record<string, unknown> = {
    ...assessment,
    photos: [{ slot: "bottomView", fileName: "x.jpg", sizeBytes: 1, uploadedAt: new Date().toISOString() }],
  };
  assert.equal(sanitizeAssessment(badSlot), null);
});

test("sanitizeAssessment rejects a photo entry missing required fields", () => {
  const assessment = createEmptyAssessment();
  const missingFileName: Record<string, unknown> = {
    ...assessment,
    photos: [{ slot: "front", sizeBytes: 1, uploadedAt: new Date().toISOString() }],
  };
  assert.equal(sanitizeAssessment(missingFileName), null);
});

test("sanitizeAssessment rejects photos that isn't an array", () => {
  const assessment = createEmptyAssessment();
  const badPhotos: Record<string, unknown> = { ...assessment, photos: "front.jpg" };
  assert.equal(sanitizeAssessment(badPhotos), null);
});
