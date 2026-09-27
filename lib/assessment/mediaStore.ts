/**
 * Client-side cache for the actual photo/video File objects the assessment
 * collects, keyed by slot. Never localStorage/sessionStorage (image bytes
 * would blow the quota and aren't meant to be there) — IndexedDB instead,
 * which stores Blobs natively and survives a page reload.
 *
 * This is a cache, not a source of truth: `lib/assessment/storage.ts` still
 * owns the persisted *metadata* (slot, filename, size, timestamp) that says
 * a photo was uploaded. A missing, corrupt, or unreadable entry here simply
 * means the actual file isn't available anymore — every function below
 * degrades to a no-op / `null` rather than throwing, so a restore failure
 * never crashes the app; the caller is expected to treat that slot as
 * unavailable (see mediaAvailability.ts).
 */

import type { PhotoSlot } from "./types.ts";

export type MediaKey = PhotoSlot | "video";

const DB_NAME = "mogaface-media";
const STORE_NAME = "media";
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("indexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const store = db.transaction(STORE_NAME, mode).objectStore(STORE_NAME);
      const req = run(store);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

/** Best-effort write — a failure (quota, disabled storage, private browsing) just means this slot won't survive a reload. */
export async function putMedia(key: MediaKey, blob: Blob): Promise<void> {
  try {
    await withStore("readwrite", (store) => store.put(blob, key));
  } catch {
    // Nothing to recover from here — the in-memory File still works for this session.
  }
}

/** Returns the stored Blob, or null if it's missing, corrupt, or unreadable. Never throws. */
export async function getMedia(key: MediaKey): Promise<Blob | null> {
  try {
    const result = await withStore<unknown>("readonly", (store) => store.get(key));
    return result instanceof Blob ? result : null;
  } catch {
    return null;
  }
}

export async function deleteMedia(key: MediaKey): Promise<void> {
  try {
    await withStore("readwrite", (store) => store.delete(key));
  } catch {
    // Already gone, or storage unavailable — either way there's nothing left to delete.
  }
}

/** Wipes every cached photo/video File — used by "Start over". */
export async function clearAllMedia(): Promise<void> {
  try {
    await withStore("readwrite", (store) => store.clear());
  } catch {
    // Storage unavailable — nothing was persisted to begin with.
  }
}
