"use client";

import { useState } from "react";
import { calibratePhotoFile, calibrateVideoFile } from "@/lib/facial-analysis/calibration/capture.ts";
import type { ThresholdProposal } from "@/lib/facial-analysis/calibration/proposals.ts";
import { PHOTO_VIEWS, baselineCoverage, createSession, defaultMetadata, validateSessionId, withPhotoSample, withVideoSample, type CalibrationSession } from "@/lib/facial-analysis/calibration/session.ts";
import type { PhotoSlot } from "@/lib/facial-analysis/multiPhoto/types.ts";
import { AggregatePanel } from "./AggregatePanel";
import { SessionView } from "./SessionView";

/**
 * REAL SAMPLE sessions. A developer creates an anonymous session (e.g.
 * REAL-001), chooses photos and an optional video from a consenting person,
 * and runs the EXISTING analysis pipeline on them.
 *
 * Privacy: the chosen files exist only in this component's state. As soon as
 * the analysis finishes they are dropped (and the file inputs reset), leaving
 * only metric-only results. Nothing is written to localStorage, sessionStorage
 * or IndexedDB, nothing is uploaded, and a page refresh discards everything.
 */

export function RealSampleSessions() {
  const [sessions, setSessions] = useState<CalibrationSession[]>([]);
  const [proposals, setProposals] = useState<ThresholdProposal[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newId, setNewId] = useState("");
  const [idProblems, setIdProblems] = useState<string[]>([]);
  const [files, setFiles] = useState<Partial<Record<PhotoSlot, File>>>({});
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [inputKey, setInputKey] = useState(0); // remounting the inputs is how their selected files are cleared
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = sessions.find((s) => s.sessionId === selectedId) ?? null;
  const update = (next: CalibrationSession) => setSessions((prev) => prev.map((s) => (s.sessionId === next.sessionId ? next : s)));
  const hasFiles = Object.keys(files).length > 0 || videoFile !== null;

  const discardMedia = () => {
    setFiles({});
    setVideoFile(null);
    setInputKey((k) => k + 1);
  };

  const create = () => {
    const problems = validateSessionId(newId);
    if (problems.length === 0 && sessions.some((s) => s.sessionId === newId)) problems.push(`${newId} already exists in this session.`);
    setIdProblems(problems);
    if (problems.length > 0) return;
    const s = createSession(newId, defaultMetadata());
    setSessions((prev) => [...prev, s]);
    setSelectedId(s.sessionId);
    setNewId("");
    discardMedia();
  };

  const select = (id: string) => {
    setSelectedId(id);
    discardMedia();
    setError(null);
  };

  const run = async () => {
    if (!selected) return;
    setError(null);
    let s = selected;
    try {
      const slots = PHOTO_VIEWS.map((v) => v.slot).filter((slot) => files[slot]);
      for (const [i, slot] of slots.entries()) {
        setBusy(`Analysing photo ${i + 1} of ${slots.length}…`);
        s = withPhotoSample(s, slot, await calibratePhotoFile(files[slot]!, slot, `${s.sessionId} ${slot}`));
      }
      if (videoFile) {
        setBusy("Reading video…");
        s = withVideoSample(s, await calibrateVideoFile(videoFile, `${s.sessionId} video`, null, (d, t) => setBusy(`Video frame ${d} of ${t}…`)));
      }
      update(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The analysis failed.");
    } finally {
      setBusy(null);
      discardMedia(); // the media is no longer needed: only the metrics are kept
    }
  };

  const cov = selected ? baselineCoverage(selected) : null;

  return (
    <div className="space-y-12">
      <section className="rounded-2xl border border-border bg-surface p-5" data-testid="privacy-note">
        <h2 className="text-sm font-semibold">Real sample sessions — temporary, in memory only</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted">
          <li>Use only people who have consented. Do not record names, contact details, dates of birth or any identifying information — the session id is an anonymous label like REAL-001.</li>
          <li>Photos and video are analysed in this tab and <strong>discarded as soon as the analysis finishes</strong>. Only numbers and your labels are kept, in memory.</li>
          <li>Nothing is stored in localStorage, sessionStorage or IndexedDB, and nothing is uploaded. Refreshing or closing the page removes everything, including the results.</li>
          <li>This is an <strong>engineering calibration</strong> workflow. It is not clinical validation, and your labels are not ground truth.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-semibold">1 · Create a session</h2>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs">
            Sample ID
            <input aria-label="Sample ID" value={newId} onChange={(e) => setNewId(e.target.value)} placeholder="REAL-001" className="w-40 rounded border border-border bg-background px-2 py-1.5 font-mono" />
          </label>
          <button type="button" onClick={create} className="rounded-full bg-accent px-5 py-2 text-xs font-medium text-accent-foreground">Create session</button>
        </div>
        {idProblems.length > 0 && <ul role="alert" className="mt-2 list-disc pl-4 text-xs text-red-600">{idProblems.map((p) => <li key={p}>{p}</li>)}</ul>}
        {sessions.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2" data-testid="session-list">
            {sessions.map((s) => (
              <button key={s.sessionId} type="button" onClick={() => select(s.sessionId)} aria-pressed={s.sessionId === selectedId} className={`rounded-full border px-4 py-1.5 font-mono text-xs ${s.sessionId === selectedId ? "border-accent bg-accent text-accent-foreground" : "border-border"}`}>
                {s.sessionId}
              </button>
            ))}
          </div>
        )}
      </section>

      {selected && cov && (
        <>
          <section>
            <h2 className="text-sm font-semibold">2 · Choose inputs for {selected.sessionId}</h2>
            <p className="mt-1 text-xs text-muted">Required for a baseline: Front, Left 45°, Right 45°. Optional: profiles and video. You do not need every view.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2" key={inputKey}>
              {PHOTO_VIEWS.map((v) => (
                <label key={v.slot} className="flex flex-col gap-1 rounded-xl border border-border p-3 text-xs">
                  <span className="flex items-baseline justify-between">
                    <span className="font-medium">{v.label}</span>
                    <span className={v.required ? "text-amber-700 dark:text-amber-400" : "text-muted"}>{v.required ? "Required for baseline" : "Optional"}{cov.present.includes(v.slot) ? " · analysed ✓" : ""}</span>
                  </span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" aria-label={`Real sample: ${v.label}`} disabled={!!busy} onChange={(e) => setFiles((f) => ({ ...f, [v.slot]: e.target.files?.[0] }))} />
                </label>
              ))}
              <label className="flex flex-col gap-1 rounded-xl border border-border p-3 text-xs">
                <span className="flex items-baseline justify-between">
                  <span className="font-medium">Video</span>
                  <span className="text-muted">Optional{selected.videoSample ? " · analysed ✓" : ""}</span>
                </span>
                <input type="file" accept="video/*" aria-label="Real sample: Video" disabled={!!busy} onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)} />
                <span className="text-[11px] text-muted">Start with a still, relaxed face, then raise the eyebrows, frown, smile and squint. About 10–20 s, front-facing, steady.</span>
              </label>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button type="button" onClick={run} disabled={!!busy || !hasFiles} className="rounded-full bg-accent px-5 py-2 text-xs font-medium text-accent-foreground disabled:opacity-40">Run analysis</button>
              <button type="button" onClick={discardMedia} disabled={!!busy || !hasFiles} className="rounded-full border border-border px-5 py-2 text-xs disabled:opacity-40">Discard chosen files</button>
              {busy && <span role="status" className="text-xs text-muted">{busy}</span>}
              {error && <span role="alert" className="text-xs text-red-600">{error}</span>}
            </div>
            <p className="mt-2 text-[11px] text-muted" data-testid="media-status">
              {hasFiles ? `${Object.keys(files).length} photo(s)${videoFile ? " and a video" : ""} chosen and held in memory only.` : "No media held. Files are discarded automatically after each analysis — re-select to run again."}
            </p>
            {cov.missingRequired.length > 0 && cov.submitted > 0 && <p className="mt-1 text-[11px] text-amber-700">Baseline views still missing: {cov.missingRequired.join(", ")}</p>}
          </section>

          <SessionView session={selected} onChange={update} />
        </>
      )}

      {sessions.length > 0 && (
        <>
          <AggregatePanel sessions={sessions} proposals={proposals} onProposals={setProposals} />
          <button type="button" onClick={() => { setSessions([]); setProposals([]); setSelectedId(null); discardMedia(); }} className="rounded-full border border-border px-5 py-2 text-xs">
            Discard all sessions
          </button>
        </>
      )}
    </div>
  );
}
