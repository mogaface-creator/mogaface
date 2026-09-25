"use client";

import { withEvaluatorNote, withoutEvaluatorNote, validateCalibrationSample } from "@/lib/facial-analysis/calibration/sample.ts";
import { EVALUATOR_LABELS, type CalibrationSample, type EvaluatorLabel, type ThresholdDecision } from "@/lib/facial-analysis/calibration/types.ts";

/**
 * Shared, presentation-only pieces of the development calibration UI: number
 * formatting, and the per-sample card (raw metrics, threshold decisions,
 * generated observations, evaluator labels). DEVELOPMENT ONLY.
 */

export const fmt = (v: unknown): string => {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return Number.isFinite(v) ? String(Math.round(v * 10000) / 10000) : String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v);
};

export const RESULT_TONE: Record<string, string> = {
  OBSERVED: "text-accent",
  PASSED: "text-accent",
  NOT_OBSERVED: "text-muted",
  NOT_EVALUATED: "text-muted",
  BORDERLINE_INSUFFICIENT: "text-amber-600 dark:text-amber-400",
  FAILED: "text-red-600 dark:text-red-400",
};

function LabelSelect({ sample, target, onChange }: { sample: CalibrationSample; target: string; onChange: (s: CalibrationSample) => void }) {
  const current = sample.evaluatorNotes.find((n) => n.target === target);
  return (
    <span className="flex flex-wrap items-center gap-1">
      <select
        aria-label={`Evaluator label for ${target}`}
        value={current?.label ?? ""}
        onChange={(e) => {
          const label = e.target.value as EvaluatorLabel | "";
          onChange(label ? withEvaluatorNote(sample, { target, label, note: current?.note ?? "" }) : withoutEvaluatorNote(sample, target));
        }}
        className="rounded border border-border bg-background px-1 py-0.5 text-xs"
      >
        <option value="">unlabelled</option>
        {EVALUATOR_LABELS.map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
      </select>
      {current && (
        <input
          aria-label={`Evaluator note for ${target}`}
          value={current.note}
          placeholder="note"
          onChange={(e) => onChange(withEvaluatorNote(sample, { ...current, note: e.target.value }))}
          className="w-40 rounded border border-border bg-background px-1 py-0.5 text-xs"
        />
      )}
    </span>
  );
}

function DecisionRow({ d, sample, onChange }: { d: ThresholdDecision; sample: CalibrationSample; onChange: (s: CalibrationSample) => void }) {
  return (
    <tr className="border-t border-border align-top">
      <td className="py-1.5 pr-3">{d.metric}</td>
      <td className="py-1.5 pr-3 font-mono">{fmt(d.value)}</td>
      <td className="py-1.5 pr-3 font-mono">
        {d.comparator} {fmt(d.threshold)}
        {d.borderline && <span className="block text-muted">band {fmt(d.borderline.clear)} / {fmt(d.borderline.fail)}</span>}
      </td>
      <td className={`py-1.5 pr-3 font-medium ${RESULT_TONE[d.result] ?? ""}`}>{d.result}</td>
      <td className="py-1.5 pr-3 text-muted">{d.note}</td>
      <td className="py-1.5">{d.gates && <LabelSelect sample={sample} target={d.id} onChange={onChange} />}</td>
    </tr>
  );
}

export function SampleCard({ sample, onChange }: { sample: CalibrationSample; onChange: (s: CalibrationSample) => void }) {
  const problems = validateCalibrationSample(sample);
  const raw = sample.rawMetrics;
  return (
    <details open className="rounded-2xl border border-border bg-surface p-5">
      <summary className="cursor-pointer text-sm font-semibold">
        {sample.sourceType}
        {sample.photoRole ? ` · ${sample.photoRole}` : ""}
        {sample.videoState ? ` · intended ${sample.videoState}` : ""} — {sample.sourceDescription || "(no description)"}{" "}
        <span className="font-mono text-xs font-normal text-muted">{sample.sampleId.slice(0, 8)}</span>
      </summary>
      {problems.length > 0 && <p className="mt-2 text-xs text-red-600">Record problems: {problems.join("; ")}</p>}

      <h4 className="mt-4 text-xs font-medium uppercase tracking-wide text-muted">Raw metrics</h4>
      {raw.kind === "photo" ? (
        <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-3">
          {(
            [
              ["detection", raw.detectionStatus],
              ["face count", raw.faceCount],
              ["quality score", raw.qualityScore],
              ["roll (°)", raw.rollDegrees],
              ["yaw ratio", raw.yawRatio],
              ["near-side span ratio", raw.nearSideSpanRatio],
              ["mean brightness", raw.meanBrightness],
              ["image", raw.imageWidth ? `${raw.imageWidth}×${raw.imageHeight}` : null],
              ["landmarks", `${raw.landmarkCount} (required present: ${fmt(raw.requiredLandmarksPresent)})`],
              ["face box", raw.faceBoundingBox ? `x ${fmt(raw.faceBoundingBox.minX)}–${fmt(raw.faceBoundingBox.maxX)}, y ${fmt(raw.faceBoundingBox.minY)}–${fmt(raw.faceBoundingBox.maxY)}` : null],
            ] as [string, unknown][]
          ).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-2">
              <dt className="text-muted">{k}</dt>
              <dd className="font-mono">{fmt(v)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-2 text-xs">
          {raw.framesUsable} of {raw.framesSampled} frames usable · {raw.metadata.durationSec.toFixed(1)} s · {raw.metadata.width}×{raw.metadata.height} · neutral candidates:{" "}
          {raw.neutralFrameCandidates.join(", ") || "none"}
        </p>
      )}
      {raw.kind === "photo" && (raw.qualityErrors.length > 0 || raw.qualityWarnings.length > 0) && (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">{[...raw.qualityErrors, ...raw.qualityWarnings].join(" ")}</p>
      )}
      {raw.kind === "video" && raw.notes.length > 0 && <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">{raw.notes.join(" ")}</p>}

      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-muted">Full raw JSON (measurements, contour, under-eye, line contrast, frames…)</summary>
        <pre className="mt-2 max-h-96 overflow-auto rounded bg-background p-3 text-[11px]">{JSON.stringify(raw, (_k, v) => (typeof v === "number" && !Number.isFinite(v) ? String(v) : v), 2)}</pre>
      </details>

      {raw.kind === "video" && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <thead className="text-muted">
              <tr>
                <th className="pr-3">frame</th>
                <th className="pr-3">t (s)</th>
                <th className="pr-3">usable</th>
                <th className="pr-3">quality</th>
                <th className="pr-3">state</th>
                <th className="pr-3">brow</th>
                <th className="pr-3">frown</th>
                <th className="pr-3">smile</th>
                <th className="pr-3">squint</th>
                <th>why unusable</th>
              </tr>
            </thead>
            <tbody>
              {raw.frames.map((f) => (
                <tr key={f.index} className="border-t border-border">
                  <td className="pr-3 font-mono">{f.index}</td>
                  <td className="pr-3 font-mono">{fmt(f.timeSec)}</td>
                  <td className="pr-3">{f.usable ? "yes" : "no"}</td>
                  <td className="pr-3 font-mono">{fmt(f.qualityScore)}</td>
                  <td className="pr-3">{f.state ?? "—"}</td>
                  {(["BROW_RAISE", "FROWN", "SMILE", "SQUINT"] as const).map((s) => (
                    <td key={s} className="pr-3 font-mono">{fmt(f.movementPct?.[s])}</td>
                  ))}
                  <td className="text-muted">{f.reasons.join(" ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h4 className="mt-5 text-xs font-medium uppercase tracking-wide text-muted">Threshold decisions</h4>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-muted">
            <tr>
              <th className="pr-3">metric</th>
              <th className="pr-3">value</th>
              <th className="pr-3">threshold</th>
              <th className="pr-3">result</th>
              <th className="pr-3">why</th>
              <th>your label</th>
            </tr>
          </thead>
          <tbody>
            {sample.thresholdDecisions.map((d) => (
              <DecisionRow key={d.id} d={d} sample={sample} onChange={onChange} />
            ))}
          </tbody>
        </table>
      </div>

      <h4 className="mt-5 text-xs font-medium uppercase tracking-wide text-muted">Generated observations ({sample.generatedObservations.length})</h4>
      {sample.generatedObservations.length === 0 ? (
        <p className="mt-2 text-xs text-muted">None — the layer produced no observation for this sample (that is a valid outcome).</p>
      ) : (
        <ul className="mt-2 space-y-1 text-xs">
          {sample.generatedObservations.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center gap-2">
              <span className="font-mono">{o.id}</span> = <span className="font-mono">{fmt(o.value)}</span> <span className="text-muted">({o.source})</span>
              <LabelSelect sample={sample} target={o.id} onChange={onChange} />
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}

