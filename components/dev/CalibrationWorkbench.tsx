"use client";

import { useState } from "react";
import { ExpressionCalibrationWorkbench } from "./ExpressionCalibrationWorkbench";
import { RealSampleSessions } from "./RealSampleSessions";
import { VisualCalibrationPanel } from "./VisualCalibrationPanel";

/**
 * Entry point for /dev/calibration (development builds only). Three tools:
 *   Real sample sessions — the general engineering calibration workflow for consenting people.
 *   Expression calibration — preparation infrastructure for the FIRST real-data milestone
 *                            (expression only — see docs/VISUAL_CALIBRATION.md). Never sets
 *                            any calibration flag; only reports whether real evidence recorded
 *                            here would satisfy the documented sign-off criteria.
 *   Quick inspect         — the original single-file inspector, unchanged.
 * All three run entirely in this tab; none stores or uploads any media.
 */

export function CalibrationWorkbench() {
  const [tab, setTab] = useState<"real" | "expression" | "quick">("real");
  return (
    <main className="mx-auto max-w-6xl space-y-8 px-6 py-10 text-sm">
      <header>
        <p className="text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">Development only — not part of the consumer product</p>
        <h1 className="mt-1 font-serif text-3xl tracking-tight">Visual calibration</h1>
        <div role="tablist" className="mt-5 flex gap-2">
          {(
            [
              ["real", "Real sample sessions"],
              ["expression", "Expression calibration"],
              ["quick", "Quick inspect (single files)"],
            ] as const
          ).map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} type="button" onClick={() => setTab(id)} className={`rounded-full border px-4 py-1.5 text-xs ${tab === id ? "border-accent bg-accent text-accent-foreground" : "border-border"}`}>
              {label}
            </button>
          ))}
        </div>
      </header>
      {tab === "real" ? <RealSampleSessions /> : tab === "expression" ? <ExpressionCalibrationWorkbench /> : <VisualCalibrationPanel />}
    </main>
  );
}
