"use client";

import { useRef, useState } from "react";
import { calibratePhotoFile, calibrateVideoFile } from "@/lib/facial-analysis/calibration/capture.ts";
import { serializeCalibrationSamples } from "@/lib/facial-analysis/calibration/sample.ts";
import { SampleCard } from "./SampleCard";
import { VISUAL_OBSERVATIONS_CALIBRATED } from "@/lib/facial-analysis/calibration/status.ts";
import { VISUAL_THRESHOLDS } from "@/lib/facial-analysis/calibration/thresholds.ts";
import type { CalibrationSample } from "@/lib/facial-analysis/calibration/types.ts";
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

interface PendingPhoto {
  file: File;
  role: PhotoSlot;
  description: string;
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
    <div className="space-y-8 text-sm">
      <header>
        <p className="text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">Development only — not part of the consumer product</p>
        <h2 className="text-xl font-semibold">Quick inspect — single files</h2>
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
    </div>
  );
}
