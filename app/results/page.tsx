"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/Button";
import { AnalysisResults } from "@/components/facial-analysis/AnalysisResults";
import { loadAnalysisResult, type StoredAnalysis } from "@/lib/facial-analysis/resultStore.ts";

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

export default function ResultsPage() {
  const stored = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-6 py-16">
          {stored === null && (
            <div className="space-y-4 text-center">
              <h1 className="font-serif text-3xl tracking-tight">No analysis found</h1>
              <p className="text-sm text-muted">
                Your results aren&apos;t stored between visits. Start a new analysis to see them here.
              </p>
              <Link href="/analyze">
                <Button>Start Your Analysis</Button>
              </Link>
            </div>
          )}

          {stored && (
            <>
              <p className="text-sm font-medium tracking-wide text-muted uppercase">Analysis complete</p>
              <h1 className="mt-2 font-serif text-3xl tracking-tight">Your facial analysis</h1>
              <div className="mt-10">
                <AnalysisResults result={stored.result} imageUrl={stored.imageUrl} landmarks={stored.landmarks} />
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
