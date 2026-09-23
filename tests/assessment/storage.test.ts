import { test } from "node:test";
import assert from "node:assert/strict";

// storage.ts guards every call on `typeof window === "undefined"`, so we
// give Node's test environment a minimal window/localStorage before the
// module is loaded — dynamic import() below runs after this setup, unlike
// a static top-level import which would be hoisted ahead of it.
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
}

const memoryStorage = new MemoryStorage();
Object.assign(globalThis, { window: globalThis, localStorage: memoryStorage });

const { saveAssessment, loadAssessment, clearAssessment } = await import("../../lib/assessment/storage.ts");
const { createEmptyAssessment } = await import("../../lib/assessment/defaults.ts");

test("round-trips a valid assessment through localStorage", () => {
  const assessment = createEmptyAssessment();
  assessment.profile.ageYears = 28;
  saveAssessment(assessment);
  const loaded = loadAssessment();
  assert.equal(loaded?.id, assessment.id);
  assert.equal(loaded?.profile.ageYears, 28);
});

test("malformed JSON in storage is treated as no assessment, not a crash", () => {
  memoryStorage.setItem("mogaface:assessment", "{not valid json");
  assert.equal(loadAssessment(), null);
});

test("stored data from an incompatible schema version is discarded", () => {
  const assessment = createEmptyAssessment();
  const badVersion: Record<string, unknown> = { ...assessment, assessmentVersion: "0.0.1" };
  memoryStorage.setItem("mogaface:assessment", JSON.stringify(badVersion));
  assert.equal(loadAssessment(), null);
});

test("clearAssessment (reset) removes the stored assessment", () => {
  saveAssessment(createEmptyAssessment());
  assert.notEqual(loadAssessment(), null);
  clearAssessment();
  assert.equal(loadAssessment(), null);
});

test("loadAssessment returns null when nothing has been saved yet", () => {
  clearAssessment();
  assert.equal(loadAssessment(), null);
});
