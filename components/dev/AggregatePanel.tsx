"use client";

import { useState } from "react";
import { serializeSessionsExport } from "@/lib/facial-analysis/calibration/export.ts";
import { APPROVAL_NOTE, createProposal, decideProposal, type ThresholdProposal } from "@/lib/facial-analysis/calibration/proposals.ts";
import { aggregateSessions } from "@/lib/facial-analysis/calibration/report.ts";
import type { CalibrationSession } from "@/lib/facial-analysis/calibration/session.ts";
import { VISUAL_OBSERVATIONS_CALIBRATED } from "@/lib/facial-analysis/calibration/status.ts";
import { VISUAL_THRESHOLDS } from "@/lib/facial-analysis/calibration/thresholds.ts";
import { fmt } from "./SampleCard";

/**
 * Cross-session summary, threshold-change proposals, and the privacy-safe
 * export. DEVELOPMENT ONLY. A proposal is a record — nothing here can change a
 * threshold — and the export contains metrics and labels, never media.
 */

const pct = (v: number | null) => (v === null ? "withheld" : `${Math.round(v * 100)}%`);

export function AggregatePanel({ sessions, proposals, onProposals }: { sessions: CalibrationSession[]; proposals: ThresholdProposal[]; onProposals: (p: ThresholdProposal[]) => void }) {
  const agg = aggregateSessions(sessions);
  const [includeRaw, setIncludeRaw] = useState(false);
  const [exportText, setExportText] = useState<string | null>(null);
  const [exportProblems, setExportProblems] = useState<string[]>([]);

  const [thresholdId, setThresholdId] = useState(VISUAL_THRESHOLDS[0].id);
  const [proposed, setProposed] = useState("");
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState<string[]>([]);
  const [formProblems, setFormProblems] = useState<string[]>([]);
  const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>({});
  const current = VISUAL_THRESHOLDS.find((t) => t.id === thresholdId)!;

  const doExport = () => {
    const result = serializeSessionsExport({ sessions, proposals, includeRaw });
    if (!result.ok) {
      setExportProblems(result.problems);
      setExportText(null);
      return;
    }
    setExportProblems([]);
    setExportText(result.text);
    const url = URL.createObjectURL(new Blob([result.text], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `mogaface-calibration-sessions-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const addProposal = () => {
    const r = createProposal({ thresholdId, proposedValue: Number(proposed), reason, evidenceSampleIds: evidence }, { knownSessionIds: sessions.map((s) => s.sessionId) });
    if (!r.ok) return setFormProblems(r.problems);
    setFormProblems([]);
    onProposals([...proposals, r.proposal]);
    setProposed("");
    setReason("");
    setEvidence([]);
  };

  const decide = (p: ThresholdProposal, status: "APPROVED" | "REJECTED") => {
    const r = decideProposal(p, status, decisionNotes[p.proposalId] ?? "");
    if (!r.ok) return setFormProblems(r.problems);
    setFormProblems([]);
    onProposals(proposals.map((x) => (x.proposalId === p.proposalId ? r.proposal : x)));
  };

  return (
    <div className="space-y-12">
      <section data-testid="aggregate">
        <h2 className="text-lg font-semibold">Calibration summary — {agg.samplesEvaluated} sample(s) evaluated</h2>
        <p className="mt-1 inline-block rounded bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900">{agg.label}</p>
        <p className="mt-2 max-w-3xl text-xs text-muted">{agg.disclaimer}</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-muted">
              <tr>
                <th className="pr-4 py-1">Observation type</th>
                <th className="pr-4">Expected positive</th>
                <th className="pr-4">Detected positive</th>
                <th className="pr-4">Potential misses</th>
                <th className="pr-4">Expected absent</th>
                <th className="pr-4">Potential false positives</th>
                <th className="pr-4">Unclear</th>
                <th className="pr-4">Detection rate</th>
                <th>False-positive rate</th>
              </tr>
            </thead>
            <tbody>
              {agg.domains.map((d) => (
                <tr key={d.domain} className="border-t border-border">
                  <td className="py-1.5 pr-4">{d.label}</td>
                  <td className="pr-4 font-mono">{d.expectedPositive}</td>
                  <td className="pr-4 font-mono">{d.detectedPositive}</td>
                  <td className="pr-4 font-mono">{d.potentialMisses}</td>
                  <td className="pr-4 font-mono">{d.expectedAbsent}</td>
                  <td className="pr-4 font-mono">{d.potentialFalsePositives}</td>
                  <td className="pr-4 font-mono">{d.unclear}</td>
                  <td className="pr-4 font-mono">{pct(d.detectionRate)}</td>
                  <td className="font-mono">{pct(d.falsePositiveRate)}</td>
                </tr>
              ))}
              {agg.domains.length === 0 && (
                <tr>
                  <td className="py-2 text-muted" colSpan={9}>Record engineering expectations on at least one session to see counts.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] text-muted">Rates appear only after {agg.minLabelledForRate} clearly labelled, evaluable samples in a category; until then only counts are shown.</p>
      </section>

      <section data-testid="proposals">
        <h2 className="text-lg font-semibold">Threshold change proposals</h2>
        <p className="mt-1 max-w-3xl text-xs text-muted">
          Record a proposed change and the evidence for it. <strong>This never changes a threshold.</strong> {APPROVAL_NOTE}
        </p>

        <div className="mt-4 grid gap-3 rounded-2xl border border-border p-4 text-xs sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            Threshold
            <select aria-label="Threshold to propose changing" className="rounded border border-border bg-background px-1.5 py-1" value={thresholdId} onChange={(e) => setThresholdId(e.target.value)}>
              {VISUAL_THRESHOLDS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.id}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-4">
            <p>CURRENT: <span className="font-mono">{current.value}</span> {current.unit}</p>
            <label className="flex flex-col gap-1">
              PROPOSED
              <input aria-label="Proposed value" value={proposed} onChange={(e) => setProposed(e.target.value)} inputMode="decimal" className="w-24 rounded border border-border bg-background px-1.5 py-1 font-mono" />
            </label>
          </div>
          <label className="flex flex-col gap-1 sm:col-span-2">
            Reason
            <input aria-label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Repeated false positives across real samples." className="rounded border border-border bg-background px-2 py-1" />
          </label>
          <fieldset className="sm:col-span-2">
            <legend>Evidence (sessions)</legend>
            <div className="mt-1 flex flex-wrap gap-3">
              {sessions.map((s) => (
                <label key={s.sessionId} className="flex items-center gap-1">
                  <input type="checkbox" checked={evidence.includes(s.sessionId)} onChange={(e) => setEvidence(e.target.checked ? [...evidence, s.sessionId] : evidence.filter((x) => x !== s.sessionId))} />
                  {s.sessionId}
                </label>
              ))}
              {sessions.length === 0 && <span className="text-muted">No sessions yet.</span>}
            </div>
          </fieldset>
          <div className="sm:col-span-2">
            <button type="button" onClick={addProposal} className="rounded-full border border-border px-4 py-1.5 font-medium">Record proposal (status: PROPOSED)</button>
            {formProblems.length > 0 && <ul role="alert" className="mt-2 list-disc pl-4 text-red-600">{formProblems.map((p) => <li key={p}>{p}</li>)}</ul>}
          </div>
        </div>

        <ul className="mt-4 space-y-3 text-xs">
          {proposals.map((p) => (
            <li key={p.proposalId} className="rounded-xl border border-border p-4">
              <p>
                <span className="font-mono">{p.thresholdId}</span>: CURRENT <span className="font-mono">{p.currentValue}</span> → PROPOSED <span className="font-mono">{p.proposedValue}</span> · Status: <span className="font-medium">{p.status}</span>
              </p>
              <p className="mt-1">Reason: {p.reason}</p>
              <p className="text-muted">Evidence: {p.evidenceSampleIds.join(", ")}</p>
              {p.warnings.filter((w) => w !== APPROVAL_NOTE).map((w) => (
                <p key={w} className="text-amber-700 dark:text-amber-400">{w}</p>
              ))}
              {p.status === "PROPOSED" ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input aria-label={`Decision note for ${p.proposalId}`} placeholder="decision note (required)" value={decisionNotes[p.proposalId] ?? ""} onChange={(e) => setDecisionNotes({ ...decisionNotes, [p.proposalId]: e.target.value })} className="w-64 rounded border border-border bg-background px-2 py-1" />
                  <button type="button" onClick={() => decide(p, "APPROVED")} className="rounded-full border border-border px-3 py-1">Mark approved</button>
                  <button type="button" onClick={() => decide(p, "REJECTED")} className="rounded-full border border-border px-3 py-1">Mark rejected</button>
                </div>
              ) : (
                <p className="mt-1 text-muted">Decision: {p.decisionNote}</p>
              )}
            </li>
          ))}
          {proposals.length === 0 && <li className="text-muted">No proposals recorded.</li>}
        </ul>
        <p className="mt-2 text-[11px] text-muted">VISUAL_OBSERVATIONS_CALIBRATED = {String(VISUAL_OBSERVATIONS_CALIBRATED)}. Approving a proposal does not change this or any threshold.</p>
      </section>

      <section data-testid="export">
        <h2 className="text-lg font-semibold">Export</h2>
        <p className="mt-1 max-w-3xl text-xs text-muted">
          Exports structured calibration metadata only — sample ids, engineering metadata, expectations, observations, comparison results, threshold decisions, notes, proposals and version ids. It <strong>never</strong> contains photos or videos (not even as base64), and nothing is uploaded: the file is handed to you to save.
        </p>
        <label className="mt-3 flex items-center gap-2 text-xs">
          <input type="checkbox" checked={includeRaw} onChange={(e) => setIncludeRaw(e.target.checked)} /> Also include raw numeric metrics (measurements, no media)
        </label>
        <button type="button" onClick={doExport} disabled={sessions.length === 0} className="mt-3 rounded-full bg-accent px-5 py-2 text-xs font-medium text-accent-foreground disabled:opacity-40">
          Export calibration JSON
        </button>
        {exportProblems.length > 0 && <ul role="alert" className="mt-2 list-disc pl-4 text-xs text-red-600">{exportProblems.map((p) => <li key={p}>{p}</li>)}</ul>}
        {exportText && (
          <details className="mt-3" open>
            <summary className="cursor-pointer text-xs">Last export ({fmt(exportText.length / 1024)} KB) — contains no image or video data</summary>
            <pre data-testid="export-preview" className="mt-2 max-h-72 overflow-auto rounded bg-background p-3 text-[11px]">{exportText}</pre>
          </details>
        )}
      </section>
    </div>
  );
}
