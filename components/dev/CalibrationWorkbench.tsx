"use client";

import { useState } from "react";
import { RealSampleSessions } from "./RealSampleSessions";
import { VisualCalibrationPanel } from "./VisualCalibrationPanel";

/**
 * Entry point for /dev/calibration (development builds only). Two tools:
 *   Real sample sessions — the engineering calibration workflow for consenting people.
 *   Quick inspect        — the original single-file inspector, unchanged.
 * Both run entirely in this tab; neither stores or uploads any media.
 */

export function CalibrationWorkbench() {
  const [tab, setTab] = useState<"real" | "quick">("real");
  return (
    <main className="mx-auto max-w-6xl space-y-8 px-6 py-10 text-sm">
      <header>
        <p className="text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">Development only — not part of the consumer product</p>
        <h1 className="mt-1 font-serif text-3xl tracking-tight">Visual calibration</h1>
        <div role="tablist" className="mt-5 flex gap-2">
          {(
            [
              ["real", "Real sample sessions"],
              ["quick", "Quick inspect (single files)"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} type="button" onClick={() => setTab(id)} className={`rounded-full border px-4 py-1.5 text-xs ${tab === id ? "border-accent bg-accent text-accent-foreground" : "border-border"}`}>
              {label}
            </button>
          ))}
        </div>
      </header>
      {tab === "real" ? <RealSampleSessions /> : <VisualCalibrationPanel />}
    </main>
  );
}
