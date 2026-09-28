/**
 * Regression coverage for the mobile "Before photo disappears after a
 * reload" fix: a blob: URL is only ever valid in the document that created
 * it, so the snapshot must persist a stable IndexedDB media key (see
 * lib/results/store.ts's StoredFrontPhotoRef), never a URL — and
 * ResultsExperience must resolve that key into a FRESH object URL every time
 * it loads, never trust a persisted one.
 *
 * End-to-end "the report still renders with no photo at all" is already
 * covered by real-data.test.ts's "the persisted path is lossless" test
 * (there is no real IndexedDB in this Node test environment, so that test's
 * own resolution naturally exercises the missing-media path against the
 * real pipeline). This file exercises resolveStoredFrontPhoto itself, and
 * source-scans the two components this fix touches for the properties a
 * render-less test suite can otherwise verify.
 *
 * mediaStore.ts guards every call on `typeof indexedDB === "undefined"`, so
 * this gives Node's test environment a minimal fake IndexedDB — the same
 * technique tests/assessment/mediaStore.test.ts already uses, only the
 * subset of the API mediaStore.ts actually calls.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

class FakeRequest {
  onsuccess: (() => void) | null = null;
  onerror: (() => void) | null = null;
  result: unknown;
  error: unknown;
}
function asyncRequest(run: (req: FakeRequest) => void): FakeRequest {
  const req = new FakeRequest();
  queueMicrotask(() => run(req));
  return req;
}
class FakeStore {
  private map: Map<string, unknown>;
  constructor(map: Map<string, unknown>) {
    this.map = map;
  }
  get(key: string) {
    return asyncRequest((req) => {
      req.result = this.map.get(key);
      req.onsuccess?.();
    });
  }
  put(value: unknown, key: string) {
    return asyncRequest((req) => {
      this.map.set(key, value);
      req.onsuccess?.();
    });
  }
}
class FakeDatabase {
  stores = new Map<string, Map<string, unknown>>();
  objectStoreNames = { contains: (name: string) => this.stores.has(name) };
  createObjectStore(name: string) {
    this.stores.set(name, new Map());
  }
  transaction(name: string) {
    return { objectStore: () => new FakeStore(this.stores.get(name)!) };
  }
  close() {}
}
const fakeDb = new FakeDatabase();
Object.assign(globalThis, {
  indexedDB: {
    open() {
      return asyncRequest((req) => {
        if (!fakeDb.objectStoreNames.contains("media")) fakeDb.createObjectStore("media");
        req.result = fakeDb;
        req.onsuccess?.();
      });
    },
  },
});

const { putMedia } = await import("../../lib/assessment/mediaStore.ts");
const { resolveStoredFrontPhoto } = await import("../../lib/results/store.ts");

const ROOT = new URL("../../", import.meta.url).pathname;
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

// Ordered deliberately: the missing-media case runs before anything is ever
// putMedia'd into the shared fake IndexedDB below.

test("resolveStoredFrontPhoto(null) is null — no assessment ever had a front photo", async () => {
  assert.equal(await resolveStoredFrontPhoto(null), null);
});

test("resolveStoredFrontPhoto degrades to null when the media is missing — no broken image, no throw", async () => {
  const resolved = await resolveStoredFrontPhoto({ mediaKey: "front", qualityValid: true });
  assert.equal(resolved, null);
});

test("resolveStoredFrontPhoto resolves a stored media key to a fresh, usable object URL", async () => {
  await putMedia("front", new Blob(["photo bytes"], { type: "image/jpeg" }));
  const resolved = await resolveStoredFrontPhoto({ mediaKey: "front", qualityValid: true });
  assert.ok(resolved);
  assert.match(resolved!.ref, /^blob:/);
  assert.equal(resolved!.qualityValid, true);
});

test("resolveStoredFrontPhoto creates a NEW object URL every time — never a cached or reused reference", async () => {
  const first = await resolveStoredFrontPhoto({ mediaKey: "front", qualityValid: true });
  const second = await resolveStoredFrontPhoto({ mediaKey: "front", qualityValid: true });
  assert.notEqual(first!.ref, second!.ref, "each resolution must mint its own object URL in the current document");
});

test("AssessmentReview no longer mints a blob: URL for the snapshot — it stores the stable IndexedDB key", () => {
  const src = read("components/assessment/AssessmentReview.tsx");
  assert.match(src, /frontPhoto: frontFile \? \{ mediaKey: "front", qualityValid:/);
  assert.doesNotMatch(src, /URL\.createObjectURL\(frontFile\)/, "the snapshot must never be built from a blob URL of the front file");
});

test("ResultsExperience resolves the stored key into a fresh object URL and revokes it on cleanup", () => {
  const src = read("components/results/ResultsExperience.tsx");
  assert.match(src, /resolveStoredFrontPhoto\(stored!\.frontPhoto\)/);
  assert.match(src, /frontPhotoUrlRef\.current = frontPhoto\.ref/);
  assert.match(src, /URL\.revokeObjectURL\(frontPhotoUrlRef\.current\)/);
  // cancellation mid-resolution revokes immediately instead of leaking
  assert.match(src, /if \(cancelled\) \{\s*if \(frontPhoto\) URL\.revokeObjectURL\(frontPhoto\.ref\);/);
});

test("the front-photo snapshot type can no longer carry a ref/blob URL at all", () => {
  const src = read("lib/results/types.ts");
  assert.match(src, /export interface StoredFrontPhotoRef \{\s*mediaKey: "front";\s*qualityValid: boolean;\s*\}/);
});
