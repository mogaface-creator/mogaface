import { PHOTO_SLOTS } from "@/lib/assessment/types.ts";
import type { MultiPhotoFacialAnalysis, PhotoAnalysisRecord, PhotoSlot } from "@/lib/facial-analysis/multiPhoto/types.ts";
import type { MogaFaceAnalysis, Observation } from "@/lib/observation/types.ts";
import { formatRatio } from "./format";

function formatObservationValue(value: unknown): string {
  if (value === null || value === undefined) return "Not available";
  if (typeof value === "number") return formatRatio(value);
  if (Array.isArray(value)) return value.length > 0 ? value.join(", ") : "None";
  return String(value);
}

const SLOT_LABELS: Record<PhotoSlot, string> = Object.fromEntries(PHOTO_SLOTS.map((p) => [p.slot, p.label])) as Record<
  PhotoSlot,
  string
>;

function statusLine(record: PhotoAnalysisRecord | undefined): { icon: string; text: string; tone: "ok" | "warn" | "bad" | "muted" } {
  if (!record) return { icon: "—", text: "Not uploaded", tone: "muted" };
  switch (record.status) {
    case "complete":
      return { icon: "✓", text: "Complete", tone: "ok" };
    case "blocked":
      return { icon: "✕", text: `${SLOT_LABELS[record.slot]} photo needs to be replaced — ${record.errors[0] ?? "quality check failed."}`, tone: "bad" };
    case "error":
      return { icon: "✕", text: `${SLOT_LABELS[record.slot]} photo failed to analyze — ${record.errors[0] ?? "unknown error."}`, tone: "bad" };
    case "idle":
      return { icon: "…", text: "Queued", tone: "muted" };
    default:
      return { icon: "…", text: `Processing (${record.status})`, tone: "warn" };
  }
}

const TONE_CLASSES: Record<string, string> = {
  ok: "text-accent",
  warn: "text-amber-600 dark:text-amber-400",
  bad: "text-red-600 dark:text-red-400",
  muted: "text-muted",
};

interface MultiPhotoDevResultsProps {
  photos: PhotoAnalysisRecord[];
  analysis: MultiPhotoFacialAnalysis | null;
  mogaFaceAnalysis: MogaFaceAnalysis | null;
  isRunning: boolean;
  progress: { slot: PhotoSlot; index: number; total: number } | null;
}

export function MultiPhotoDevResults({ photos, analysis, mogaFaceAnalysis, isRunning, progress }: MultiPhotoDevResultsProps) {
  const bySlot = new Map(photos.map((p) => [p.slot, p]));
  const landmarksDone = photos.some((p) => p.landmarks !== null);
  const measurementsDone = photos.some((p) => p.measurements !== null);
  const consistencyDone = analysis !== null;
  const combinedDone = analysis !== null && analysis.combinedMeasurements.metrics.length > 0;

  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">
        Development view — multi-view facial analysis using standardized photographs (not 3D reconstruction)
      </p>

      {isRunning && progress && (
        <p role="status" aria-live="polite" className="mt-3 text-sm text-muted">
          Analyzing photo {progress.index + 1} of {progress.total} ({SLOT_LABELS[progress.slot]})…
        </p>
      )}

      <h3 className="mt-6 text-sm font-semibold">Photo status</h3>
      <ul className="mt-3 space-y-1.5 text-sm">
        {PHOTO_SLOTS.map(({ slot, label }) => {
          const { icon, text, tone } = statusLine(bySlot.get(slot));
          return (
            <li key={slot} className="flex gap-2">
              <span className={TONE_CLASSES[tone]}>{icon}</span>
              <span>
                <span className="font-medium">{label}</span> — <span className={TONE_CLASSES[tone]}>{text}</span>
              </span>
            </li>
          );
        })}
      </ul>

      <h3 className="mt-6 text-sm font-semibold">Analysis status</h3>
      <ul className="mt-3 space-y-1.5 text-sm">
        <li>{landmarksDone ? "✓" : "—"} Landmarks</li>
        <li>{measurementsDone ? "✓" : "—"} Measurements</li>
        <li>{consistencyDone ? "✓" : "—"} Consistency</li>
        <li>{combinedDone ? "✓" : "—"} Combined analysis</li>
      </ul>

      {analysis && (
        <>
          {analysis.consistency.warnings.length > 0 && (
            <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
              <p className="font-medium">Consistency warnings</p>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {analysis.consistency.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          <h3 className="mt-6 text-sm font-semibold">Combined measurements</h3>
          <dl className="mt-3 space-y-1.5 text-sm">
            {analysis.combinedMeasurements.metrics.map((m) => (
              <div key={m.metric} className="flex items-baseline justify-between gap-4" title={m.reason}>
                <dt className="text-muted">
                  {m.metric}
                  {m.sourceView && <span className="ml-1 text-xs">({SLOT_LABELS[m.sourceView]})</span>}
                </dt>
                <dd>{formatRatio(m.value)}</dd>
              </div>
            ))}
          </dl>

          {mogaFaceAnalysis && (
            <>
              <h3 className="mt-6 text-sm font-semibold">Analysis domains</h3>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <span className="font-medium">Facial structure</span> — {mogaFaceAnalysis.facialStructure.measured.length}{" "}
                  measured observation{mogaFaceAnalysis.facialStructure.measured.length === 1 ? "" : "s"}
                </li>
                <li>
                  <span className="font-medium">Eye area</span> — {mogaFaceAnalysis.eyeArea.measured.length} measured,{" "}
                  {mogaFaceAnalysis.eyeArea.userReported.length} user-reported
                </li>
                <li>
                  <span className="font-medium">Hair</span> — {mogaFaceAnalysis.hair.userReported.length} user-reported
                  observation{mogaFaceAnalysis.hair.userReported.length === 1 ? "" : "s"}
                </li>
                <li>
                  <span className="font-medium">Facial hair</span> — {mogaFaceAnalysis.facialHair.userReported.length}{" "}
                  user-reported observation{mogaFaceAnalysis.facialHair.userReported.length === 1 ? "" : "s"}
                </li>
                <li>
                  <span className="font-medium">Skin</span> — <span className="text-muted">Not implemented</span>
                </li>
                <li>
                  <span className="font-medium">Lifestyle</span> — {mogaFaceAnalysis.lifestyle.userReported.length}{" "}
                  user-reported observation{mogaFaceAnalysis.lifestyle.userReported.length === 1 ? "" : "s"}
                </li>
                <li>
                  <span className="font-medium">Style</span> — {mogaFaceAnalysis.style.userReported.length} user-reported
                  observation{mogaFaceAnalysis.style.userReported.length === 1 ? "" : "s"}
                </li>
              </ul>

              <div className="mt-6 rounded-xl border border-border px-4 py-3 text-xs text-muted">
                <p className="font-medium text-foreground">Limitations</p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {mogaFaceAnalysis.limitations.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </div>

              <details className="mt-6">
                <summary className="cursor-pointer text-sm font-semibold">
                  Observation details ({mogaFaceAnalysis.observations.length})
                </summary>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-muted">
                        <th className="pr-4 py-1 font-medium">Label</th>
                        <th className="pr-4 py-1 font-medium">Value</th>
                        <th className="pr-4 py-1 font-medium">Type</th>
                        <th className="pr-4 py-1 font-medium">Source</th>
                        <th className="pr-4 py-1 font-medium">Confidence</th>
                        <th className="py-1 font-medium">Methodology</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(mogaFaceAnalysis.observations as Observation<unknown>[]).map((obs) => (
                        <tr key={obs.id} className="border-t border-border">
                          <td className="pr-4 py-1.5">{obs.label}</td>
                          <td className="pr-4 py-1.5">{formatObservationValue(obs.value)}</td>
                          <td className="pr-4 py-1.5">{obs.type}</td>
                          <td className="pr-4 py-1.5">{obs.source}</td>
                          <td className="pr-4 py-1.5">{obs.confidence}</td>
                          <td className="py-1.5">{obs.methodologyVersion}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </>
          )}

          <details className="mt-6">
            <summary className="cursor-pointer text-sm font-semibold">Per-photo debug details</summary>
            <div className="mt-3 space-y-4">
              {analysis.photos.map((record) => (
                <div key={record.slot} className="rounded-xl border border-border p-4 text-xs">
                  <p className="font-medium text-sm">
                    {SLOT_LABELS[record.slot]} — <span className={TONE_CLASSES[statusLine(record).tone]}>{record.status}</span>
                  </p>
                  <p className="mt-1 text-muted">
                    {record.imageWidth}×{record.imageHeight}px · face count: {record.faceCount ?? "—"} · processed in{" "}
                    {record.processingTimeMs ?? "—"}ms
                  </p>
                  {record.measurements && (
                    <p className="mt-2">
                      face.widthHeightRatio: {formatRatio(record.measurements.face.widthHeightRatio)} · symmetry:{" "}
                      {record.symmetry ? formatRatio(record.symmetry.overallSymmetryIndex) : "—"}
                    </p>
                  )}
                  {record.viewValidation && record.viewValidation.notes.length > 0 && (
                    <p className="mt-2 italic text-muted">{record.viewValidation.notes.join(" ")}</p>
                  )}
                  {record.warnings.length > 0 && (
                    <ul className="mt-2 list-disc space-y-0.5 pl-4 text-amber-700 dark:text-amber-400">
                      {record.warnings.map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  )}
                  {record.errors.length > 0 && (
                    <ul className="mt-2 list-disc space-y-0.5 pl-4 text-red-600 dark:text-red-400">
                      {record.errors.map((e) => (
                        <li key={e}>{e}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </details>
        </>
      )}
    </div>
  );
}
