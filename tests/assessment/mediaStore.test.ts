import { test } from "node:test";
import assert from "node:assert/strict";

// mediaStore.ts guards every call on `typeof indexedDB === "undefined"`, so we
// give Node's test environment a minimal fake IndexedDB before the module is
// loaded — dynamic import() below runs after this setup, unlike a static
// top-level import which would be hoisted ahead of it. Only the subset of the
// IndexedDB API mediaStore.ts actually uses is implemented.
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
  private failKeys: Set<string>;
  constructor(map: Map<string, unknown>, failKeys: Set<string>) {
    this.map = map;
    this.failKeys = failKeys;
  }
  get(key: string) {
    return asyncRequest((req) => {
      if (this.failKeys.has(key)) {
        req.error = new Error("simulated read failure");
        req.onerror?.();
        return;
      }
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
  delete(key: string) {
    return asyncRequest((req) => {
      this.map.delete(key);
      req.onsuccess?.();
    });
  }
  clear() {
    return asyncRequest((req) => {
      this.map.clear();
      req.onsuccess?.();
    });
  }
}

class FakeDatabase {
  stores = new Map<string, Map<string, unknown>>();
  failKeys = new Set<string>();
  objectStoreNames = { contains: (name: string) => this.stores.has(name) };
  createObjectStore(name: string) {
    this.stores.set(name, new Map());
  }
  transaction(name: string) {
    return { objectStore: () => new FakeStore(this.stores.get(name)!, this.failKeys) };
  }
  close() {}
}

const fakeDb = new FakeDatabase();
const fakeIndexedDB = {
  open() {
    return asyncRequest((req) => {
      if (!fakeDb.objectStoreNames.contains("media")) fakeDb.createObjectStore("media");
      req.result = fakeDb;
      req.onsuccess?.();
    });
  },
};
Object.assign(globalThis, { indexedDB: fakeIndexedDB });

const { putMedia, getMedia, deleteMedia, clearAllMedia } = await import("../../lib/assessment/mediaStore.ts");

test("a stored Blob round-trips through IndexedDB", async () => {
  const blob = new Blob(["hello"], { type: "image/jpeg" });
  await putMedia("front", blob);
  const restored = await getMedia("front");
  assert.ok(restored instanceof Blob);
  assert.equal(restored?.type, "image/jpeg");
  assert.equal(await restored?.text(), "hello");
});

test("a missing key returns null, not an error", async () => {
  assert.equal(await getMedia("rightProfile"), null);
});

test("a corrupted/unreadable record is treated as unavailable, not thrown", async () => {
  await putMedia("leftFortyFive", new Blob(["ok"]));
  // Simulate a record IndexedDB can't read back (I/O error, corruption, etc).
  fakeDb.failKeys.add("leftFortyFive");
  assert.equal(await getMedia("leftFortyFive"), null);
  fakeDb.failKeys.delete("leftFortyFive");
});

test("a stored value that isn't a Blob is treated as unavailable, not returned as-is", async () => {
  await putMedia("rightFortyFive", new Blob(["ok"]));
  fakeDb.stores.get("media")!.set("rightFortyFive", "not a blob");
  assert.equal(await getMedia("rightFortyFive"), null);
});

test("deleteMedia removes a single record", async () => {
  await putMedia("leftProfile", new Blob(["x"]));
  assert.notEqual(await getMedia("leftProfile"), null);
  await deleteMedia("leftProfile");
  assert.equal(await getMedia("leftProfile"), null);
});

test("clearAllMedia (Start over) wipes every cached photo and the video", async () => {
  await putMedia("front", new Blob(["a"]));
  await putMedia("leftFortyFive", new Blob(["b"]));
  await putMedia("video", new Blob(["c"]));
  await clearAllMedia();
  assert.equal(await getMedia("front"), null);
  assert.equal(await getMedia("leftFortyFive"), null);
  assert.equal(await getMedia("video"), null);
});

test("the expression video persists under its own key alongside photos", async () => {
  await putMedia("front", new Blob(["photo"]));
  await putMedia("video", new Blob(["clip"], { type: "video/webm" }));
  const video = await getMedia("video");
  assert.ok(video instanceof Blob);
  assert.equal(video?.type, "video/webm");
  assert.notEqual(await getMedia("front"), null);
});

test("putMedia/getMedia never throw when indexedDB is unavailable", async () => {
  const saved = (globalThis as { indexedDB?: unknown }).indexedDB;
  // @ts-expect-error -- deliberately simulating an environment without IndexedDB
  delete globalThis.indexedDB;
  try {
    await assert.doesNotReject(putMedia("front", new Blob(["x"])));
    assert.equal(await getMedia("front"), null);
  } finally {
    Object.assign(globalThis, { indexedDB: saved });
  }
});
