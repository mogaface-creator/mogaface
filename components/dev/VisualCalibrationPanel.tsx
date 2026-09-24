"use client";

import { useRef, useState } from "react";
import { calibratePhotoFile, calibrateVideoFile } from "@/lib/facial-analysis/calibration/capture.ts";
import { serializeCalibrationSamples, validateCalibrationSample, withEvaluatorNote, withoutEvaluatorNote } from "@/lib/facial-analysis/calibration/sample.ts";
import { VISUAL_OBSERVATIONS_CALIBRATED } from "@/lib/facial-analysis/calibration/status.ts";
import { VISUAL_THRESHOLDS } from "@/lib/facial-analysis/calibration/thresholds.ts";
import { EVALUATOR_LABELS, type CalibrationSample, type EvaluatorLabel, type ThresholdDecision } from "@/lib/facial-analysis/calibration/types.ts";
import type { PhotoSlot } from "@/lib/facial-analysis/multiPhoto/types.ts";
import { EXPRESSION_STATES, type ExpressionState } from "@/lib/facial-analysis/video/types.ts";

/**
 * DEVELOPMENT ONLY. Runs the real photo/video pipeline on files a developer
 * supplies and shows every raw number, every threshold decision, and every
 * observation it produced, with a place to record an engineering label
 * (true/false positive/negative) against your own visual inspection.
 *
 * Nothing is uploaded or persisted. Samples live in this component's state
 * until you export them; closing the tab discards them.
 */

const ROLES: { value: PhotoSlot; label: string }[] = [
  { value: "front", label: "Front" },
  { value: "leftFortyFive", label: "Left 45°" },
  { value: "rightFortyFive", label: "Right 45°" },
  { value: "leftProfile", label: "Left profile" },
  { value: "rightProfile", label: "Right profile" },
];

const fmt = (v: unknown): string => {
  if (v === null || v === undefined) return "—";
  if (typeof v === "number") return Number.isFinite(v) ? String(Math.round(v * 10000) / 10000) : String(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  return String(v);
};

const RESULT_TONE: Record<string, string> = {
  OBSERVED: "text-accent",
  PASSED: "text-accent",
  NOT_OBSERVED: "text-muted",
  NOT_EVALUATED: "text-muted",
  BORDERLINE_INSUFFICIENT: "text-amber-600 dark:text-amber-400",
  FAILED: "text-red-600 dark:text-red-400",
};

interface PendingPhoto {
  file: File;
  role: PhotoSlot;
  description: string;
}

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

function SampleCard({ sample, onChange }: { sample: CalibrationSample; onChange: (s: CalibrationSample) => void }) {
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

export function VisualCalibrationPanel() {
  const [samples, setSamples] = useState<CalibrationSample[]>([]);
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [video, setVideo] = useState<{ file: File; state: ExpressionState | ""; description: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);

  const run = async () => {
    setError(null);
    try {
      for (const [i, p] of photos.entries()) {
        setBusy(`Photo ${i + 1} of ${photos.length}…`);
        const sample = await calibratePhotoFile(p.file, p.role, p.description);
        setSamples((prev) => [...prev, sample]);
      }
      setPhotos([]);
      if (photoInput.current) photoInput.current.value = "";
      if (video) {
        setBusy("Reading video…");
        const sample = await calibrateVideoFile(video.file, video.description, video.state || null, (d, t) => setBusy(`Video frame ${d} of ${t}…`));
        setSamples((prev) => [...prev, sample]);
        setVideo(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Calibration run failed.");
    } finally {
      setBusy(null);
    }
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([serializeCalibrationSamples(samples)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `mogaface-calibration-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-6 py-10 text-sm">
      <header>
        <p className="text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">Development only — not part of the consumer product</p>
        <h1 className="mt-1 font-serif text-3xl tracking-tight">Visual calibration harness</h1>
        <p className="mt-2 max-w-3xl text-muted">
          Run real photos and a real video through the actual pipeline and inspect every raw number and threshold decision. Files are processed in this tab only —
          nothing is uploaded or stored, and samples vanish when you close the tab unless you export them. Labels you record are engineering labels against your own
          visual inspection, not clinical truth. See docs/VISUAL_CALIBRATION.md.
        </p>
        <p className="mt-2 text-xs">
          Gate: <code>VISUAL_OBSERVATIONS_CALIBRATED = {String(VISUAL_OBSERVATIONS_CALIBRATED)}</code> — treatment opportunities that cite these observations are not consumer-ready
          while this is false.
        </p>
      </header>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold">Photos</h2>
        <input
          ref={photoInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          aria-label="Calibration photos"
          disabled={!!busy}
          onChange={(e) => setPhotos([...(e.target.files ?? [])].map((file) => ({ file, role: "front", description: "" })))}
          className="mt-3 block text-xs"
        />
        {photos.map((p, i) => (
          <div key={i} className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="w-40 truncate">{p.file.name}</span>
            <select aria-label={`Role for ${p.file.name}`} value={p.role} onChange={(e) => setPhotos(photos.map((x, j) => (j === i ? { ...x, role: e.target.value as PhotoSlot } : x)))} className="rounded border border-border bg-background px-1 py-0.5">
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <input
              aria-label={`Description for ${p.file.name}`}
              value={p.description}
              placeholder="what is this? e.g. matrix C — no obvious forehead lines"
              onChange={(e) => setPhotos(photos.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))}
              className="min-w-64 flex-1 rounded border border-border bg-background px-2 py-0.5"
            />
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold">Video</h2>
        <input
          type="file"
          accept="video/*"
          aria-label="Calibration video"
          disabled={!!busy}
          onChange={(e) => setVideo(e.target.files?.[0] ? { file: e.target.files[0], state: "", description: "" } : null)}
          className="mt-3 block text-xs"
        />
        {video && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <select aria-label="Intended expression" value={video.state} onChange={(e) => setVideo({ ...video, state: e.target.value as ExpressionState | "" })} className="rounded border border-border bg-background px-1 py-0.5">
              <option value="">whole clip (no single state)</option>
              {EXPRESSION_STATES.map((s) => (
                <option key={s} value={s}>
                  intended: {s}
                </option>
              ))}
            </select>
            <input aria-label="Video description" value={video.description} placeholder="what is this clip?" onChange={(e) => setVideo({ ...video, description: e.target.value })} className="min-w-64 flex-1 rounded border border-border bg-background px-2 py-0.5" />
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={run} disabled={!!busy || (photos.length === 0 && !video)} className="rounded-full bg-accent px-5 py-2 text-xs font-medium text-accent-foreground disabled:opacity-40">
          Run selected
        </button>
        <button type="button" onClick={download} disabled={samples.length === 0} className="rounded-full border border-border px-5 py-2 text-xs disabled:opacity-40">
          Download samples (JSON)
        </button>
        <button type="button" onClick={() => setSamples([])} disabled={samples.length === 0} className="rounded-full border border-border px-5 py-2 text-xs disabled:opacity-40">
          Clear samples
        </button>
        {busy && <span role="status" className="text-muted">{busy}</span>}
        {error && <span role="alert" className="text-red-600">{error}</span>}
      </div>

      <div className="space-y-4" data-testid="samples">
        {samples.map((s) => (
          <SampleCard key={s.sampleId} sample={s} onChange={(next) => setSamples((prev) => prev.map((x) => (x.sampleId === next.sampleId ? next : x)))} />
        ))}
      </div>

      <details className="rounded-2xl border border-border p-5">
        <summary className="cursor-pointer text-sm font-semibold">Current thresholds ({VISUAL_THRESHOLDS.length}) — all engineering heuristics, none clinically validated</summary>
        <table className="mt-3 w-full text-left text-xs">
          <tbody>
            {VISUAL_THRESHOLDS.map((t) => (
              <tr key={t.id} className="border-t border-border align-top">
                <td className="py-1 pr-3 font-mono">{t.id}</td>
                <td className="py-1 pr-3 font-mono">{t.value} {t.unit}</td>
                <td className="py-1 pr-3">{t.kind}</td>
                <td className="py-1 text-muted">{t.meaning}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </main>
  );
}
