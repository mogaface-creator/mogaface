"use client";

import { useSyncExternalStore } from "react";
import { AnalysisResults } from "@/components/facial-analysis/AnalysisResults";
import { loadAnalysisResult, type StoredAnalysis } from "@/lib/facial-analysis/resultStore.ts";

/**
 * The original single-photo measurement view — the developer/debug output of
 * /analyze. It is NOT the consumer result. It is shown only to someone who
 * arrived from /analyze and has no assessment result to show.
 */

// sessionStorage never changes for the lifetime of this page, so there is
// nothing to subscribe to — this cache just lets useSyncExternalStore return
// a stable snapshot reference instead of re-parsing JSON on every render.
let cachedSnapshot: StoredAnalysis | null | undefined;
function getSnapshot(): StoredAnalysis | null {
  if (cachedSnapshot === undefined) cachedSnapshot = loadAnalysisResult();
  return cachedSnapshot;
}
function getServerSnapshot(): StoredAnalysis | null {
  return null;
}
function subscribe() {
  return () => {};
}

export function LegacyResults() {
  const stored = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (!stored) return null;
  return (
    <>
      <p className="text-sm font-medium tracking-wide text-muted uppercase">Analysis complete — developer view</p>
      <h1 className="mt-2 font-serif text-3xl tracking-tight">Your facial analysis</h1>
      <div className="mt-10">
        <AnalysisResults result={stored.result} imageUrl={stored.imageUrl} landmarks={stored.landmarks} />
      </div>
    </>
  );
}
