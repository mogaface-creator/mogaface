/**
 * Hands a completed analysis from /analyze to /results without a server.
 * sessionStorage keeps it local to this browser tab, in line with the
 * "processing stays in the browser" privacy commitment on the landing page
 * — nothing here is a database, and it clears when the tab closes.
 *
 * `imageUrl` is a blob: URL created from the uploaded File. It stays valid
 * across client-side (App Router) navigation within the same tab, but not
 * across a hard reload — callers must handle the image failing to load.
 */

import type { FacialAnalysisResult, Point2D } from "./types.ts";

const KEY = "mogaface:last-analysis";

export interface StoredAnalysis {
  result: FacialAnalysisResult;
  imageUrl: string;
  landmarks: Point2D[];
}

export function saveAnalysisResult(entry: StoredAnalysis): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(KEY, JSON.stringify(entry));
}

export function loadAnalysisResult(): StoredAnalysis | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredAnalysis;
  } catch {
    return null;
  }
}
