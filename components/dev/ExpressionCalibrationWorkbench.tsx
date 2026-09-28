"use client";

import { useState } from "react";
import { calibrateVideoFile } from "@/lib/facial-analysis/calibration/capture.ts";
import { compareSession } from "@/lib/facial-analysis/calibration/comparison.ts";
import { EXPRESSIONS, LINE_REGIONS, PRESENCE_LEVELS, PRESENCE_WORDING, type EngineeringExpectations, type PresenceLevel } from "@/lib/facial-analysis/calibration/expectations.ts";
import { confusionCountsByDomain, EXPRESSION_DOMAINS } from "@/lib/facial-analysis/calibration/expressionValidation.ts";
import { evaluateExpressionReadiness, MIN_REAL_PEOPLE } from "@/lib/facial-analysis/calibration/expressionReadiness.ts";
import type { ThresholdProposal } from "@/lib/facial-analysis/calibration/proposals.ts";
import {
  canTransitionReviewerStatus,
  createSession,
  DATASET_SPLITS,
  REVIEWER_STATUSES,
  validateSessionId,
  withCalibrationCategory,
  withDatasetSplit,
  withExpectations,
  withReviewerStatus,
  withVideoSample,
  type CalibrationSession,
  type DatasetSplit,
  type ReviewerStatus,
} from "@/lib/facial-analysis/calibration/session.ts";
import type { ExpressionState } from "@/lib/facial-analysis/video/types.ts";
import { AggregatePanel } from "./AggregatePanel";

/**
 * Developer-only "Expression Calibration" workflow — preparation
 * infrastructure for the FIRST real-data calibration milestone (`expression`:
 * movement + line-pattern observations only, see docs/VISUAL_CALIBRATION.md).
 *
 * This tool does not calibrate anything: it never sets CALIBRATION_STATE, and
 * the readiness panel below can only ever report what real evidence
 * (recorded in THIS tab, in memory, discarded on refresh) actually supports.
 * With zero sessions it always reports "not ready".
 *
 * Reuses the existing real-sample machinery (session, capture, comparison,
 * proposals, aggregate/export) — this is a scoped, additional creation flow
 * and readiness view on top of it, not a parallel system.
 */

const EXPRESSION_CONDITIONS: { value: ExpressionState; label: string }[] = [
  { value: "NEUTRAL", label: "Neutral / relaxed" },
  { value: "BROW_RAISE", label: "Brow raise" },
  { value: "FROWN", label: "Frown" },
  { value: "SMILE", label: "Smile" },
  { value: "SQUINT", label: "Squint" },
];

const SPLIT_LABEL: Record<DatasetSplit, string> = { tuning: "Tuning", held_out: "Held-out" };
const REVIEW_LABEL: Record<ReviewerStatus, string> = { not_reviewed: "Not reviewed", reviewed: "Reviewed", approved: "Approved", rejected: "Rejected" };

function ExpressionExpectationsForm({ value, onChange }: { value: EngineeringExpectations; onChange: (v: EngineeringExpectations) => void }) {
  return (
    <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
      <fieldset className="space-y-2">
        <legend className="text-xs font-medium uppercase tracking-wide text-muted">Expression movement</legend>
        {EXPRESSIONS.map((e) => (
          <label key={e} className="flex items-center justify-between gap-3 text-xs">
            <span>{e.replace("_", " ")}</span>
            <select
              aria-label={`Expected: ${e}`}
              className="rounded border border-border bg-background px-1.5 py-1 text-xs"
              value={value.expression[e] ?? ""}
              onChange={(ev) => onChange({ ...value, expression: { ...value.expression, [e]: (ev.target.value || null) as PresenceLevel | null } })}
            >
              <option value="">not recorded</option>
              {PRESENCE_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {PRESENCE_WORDING.expression[l]}
                </option>
              ))}
            </select>
          </label>
        ))}
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-xs font-medium uppercase tracking-wide text-muted">Facial line pattern</legend>
        {LINE_REGIONS.map((r) => (
          <label key={r} className="flex items-center justify-between gap-3 text-xs">
            <span>{r === "lateralEye" ? "Lateral eye" : r[0].toUpperCase() + r.slice(1)}</span>
            <select
              aria-label={`Expected: ${r}`}
              className="rounded border border-border bg-background px-1.5 py-1 text-xs"
              value={value.lines[r] ?? ""}
              onChange={(ev) => onChange({ ...value, lines: { ...value.lines, [r]: (ev.target.value || null) as PresenceLevel | null } })}
            >
              <option value="">not recorded</option>
              {PRESENCE_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {PRESENCE_WORDING.lines[l]}
                </option>
              ))}
            </select>
          </label>
        ))}
      </fieldset>
    </div>
  );
}

function ReadinessPanel({ sessions, proposals, wordingReviewed }: { sessions: CalibrationSession[]; proposals: ThresholdProposal[]; wordingReviewed: boolean }) {
  const r = evaluateExpressionReadiness(sessions, { thresholdProposals: proposals, consumerWordingReviewed: wordingReviewed });
  return (
    <section className="rounded-2xl border border-border bg-surface p-5" data-testid="expression-readiness">
      <h2 className="text-sm font-semibold">Expression calibration sign-off readiness</h2>
      <p className={`mt-2 text-sm font-medium ${r.ready ? "text-accent" : "text-amber-700 dark:text-amber-400"}`}>{r.ready ? "READY (all requirements met)" : "NOT READY"}</p>
      <p className="mt-1 text-xs text-muted">
        {r.sampleCounts.total} / {MIN_REAL_PEOPLE} expression-category sessions · {r.sampleCounts.tuning} tuning · {r.sampleCounts.heldOut} held-out · {r.sampleCounts.unassignedSplit} unassigned · {r.sampleCounts.independentlyApproved} independently
        approved.
      </p>
      <ul className="mt-4 space-y-1.5 text-xs">
        {r.requirements.map((req) => (
          <li key={req.id} className="flex items-start gap-2">
            <span aria-hidden className={req.met ? "text-accent" : "text-amber-700 dark:text-amber-400"}>
              {req.met ? "✓" : "✗"}
            </span>
            <span className={req.met ? "" : "text-muted"}>{req.detail}</span>
          </li>
        ))}
      </ul>
      <details className="mt-4 text-xs">
        <summary className="cursor-pointer text-muted">Held-out confusion counts by condition</summary>
        <ul className="mt-2 space-y-1">
          {EXPRESSION_DOMAINS.map((d) => {
            const c = confusionCountsByDomain(sessions.filter((s) => s.datasetSplit === "held_out"))[d];
            return (
              <li key={d} className="font-mono">
                {d}: TP {c.truePositives} · FP {c.falsePositives} · TN {c.trueNegatives} · FN {c.falseNegatives} · agreement {c.agreementRate === null ? "withheld" : `${Math.round(c.agreementRate * 100)}%`}
              </li>
            );
          })}
        </ul>
      </details>
    </section>
  );
}

export function ExpressionCalibrationWorkbench() {
  const [sessions, setSessions] = useState<CalibrationSession[]>([]);
  const [proposals, setProposals] = useState<ThresholdProposal[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newId, setNewId] = useState("");
  const [split, setSplit] = useState<DatasetSplit | "">("");
  const [idProblems, setIdProblems] = useState<string[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [condition, setCondition] = useState<ExpressionState>("NEUTRAL");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wordingReviewed, setWordingReviewed] = useState(false);
  const [reviewNote, setReviewNote] = useState("");

  const selected = sessions.find((s) => s.sessionId === selectedId) ?? null;
  const update = (next: CalibrationSession) => setSessions((prev) => prev.map((s) => (s.sessionId === next.sessionId ? next : s)));

  const create = () => {
    const problems = validateSessionId(newId);
    if (problems.length === 0 && sessions.some((s) => s.sessionId === newId)) problems.push(`${newId} already exists.`);
    if (!split) problems.push("Choose tuning or held-out before creating the session — there is no default.");
    setIdProblems(problems);
    if (problems.length > 0) return;
    const s = withDatasetSplit(withCalibrationCategory(createSession(newId), "expression"), split as DatasetSplit);
    setSessions((prev) => [...prev, s]);
    setSelectedId(s.sessionId);
    setNewId("");
    setSplit("");
    setVideoFile(null);
    setError(null);
  };

  const run = async () => {
    if (!selected || !videoFile) return;
    setError(null);
    setBusy("Analysing video…");
    try {
      const sample = await calibrateVideoFile(videoFile, `${selected.sessionId} ${condition}`, condition === "NEUTRAL" ? null : condition, (d, t) => setBusy(`Video frame ${d} of ${t}…`));
      update(withVideoSample(selected, sample));
    } catch (e) {
      setError(e instanceof Error ? e.message : "The analysis failed.");
    } finally {
      setBusy(null);
      setVideoFile(null);
    }
  };

  const rows = selected ? compareSession(selected).filter((r) => (EXPRESSION_DOMAINS as readonly string[]).includes(r.domain)) : [];

  return (
    <div className="space-y-10">
      <section className="rounded-2xl border border-border bg-surface p-5" data-testid="expression-privacy-note">
        <h2 className="text-sm font-semibold">Expression calibration — preparation infrastructure only</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted">
          <li>This is NOT calibration. It never sets any calibration flag; it only organises and reports on real evidence you record here.</li>
          <li>Scope: expression only (movement + line-pattern observations). Contour and under-eye are handled by the general &ldquo;Real sample sessions&rdquo; tab and are unaffected by anything here.</li>
          <li>Use only consenting people. The video is analysed in this tab and discarded as soon as analysis finishes; nothing is stored or uploaded.</li>
          <li>Assign every session to tuning or held-out — there is no default. Held-out evidence can validate a proposal but is refused as evidence for creating one.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-semibold">1 · Create a session</h2>
        <div className="mt-3 flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-xs">
            Sample ID
            <input aria-label="Sample ID" value={newId} onChange={(e) => setNewId(e.target.value)} placeholder="REAL-001" className="w-40 rounded border border-border bg-background px-2 py-1.5 font-mono" />
          </label>
          <fieldset className="flex flex-col gap-1 text-xs">
            <legend>Dataset split</legend>
            <div className="flex gap-2" role="radiogroup" aria-label="Dataset split">
              {DATASET_SPLITS.map((d) => (
                <button key={d} type="button" role="radio" aria-checked={split === d} onClick={() => setSplit(d)} className={`rounded-full border px-3 py-1.5 ${split === d ? "border-accent bg-accent text-accent-foreground" : "border-border"}`}>
                  {SPLIT_LABEL[d]}
                </button>
              ))}
            </div>
          </fieldset>
          <button type="button" onClick={create} className="rounded-full bg-accent px-5 py-2 text-xs font-medium text-accent-foreground">
            Create session
          </button>
        </div>
        {idProblems.length > 0 && (
          <ul role="alert" className="mt-2 list-disc pl-4 text-xs text-red-600">
            {idProblems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
        {sessions.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {sessions.map((s) => (
              <button
                key={s.sessionId}
                type="button"
                onClick={() => setSelectedId(s.sessionId)}
                aria-pressed={s.sessionId === selectedId}
                className={`rounded-full border px-4 py-1.5 font-mono text-xs ${s.sessionId === selectedId ? "border-accent bg-accent text-accent-foreground" : "border-border"}`}
              >
                {s.sessionId} · {s.datasetSplit ? SPLIT_LABEL[s.datasetSplit] : "unassigned"} · {REVIEW_LABEL[s.reviewerStatus]}
              </button>
            ))}
          </div>
        )}
      </section>

      {selected && (
        <>
          <section>
            <h2 className="text-sm font-semibold">2 · Condition and video for {selected.sessionId}</h2>
            <div className="mt-3 flex flex-wrap items-end gap-4">
              <label className="flex flex-col gap-1 text-xs">
                Expression condition
                <select aria-label="Expression condition" value={condition} onChange={(e) => setCondition(e.target.value as ExpressionState)} className="rounded border border-border bg-background px-2 py-1.5 text-xs">
                  {EXPRESSION_CONDITIONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs">
                Video
                <input type="file" accept="video/*" aria-label="Expression calibration video" disabled={!!busy} onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)} />
              </label>
              <button type="button" onClick={run} disabled={!!busy || !videoFile} className="rounded-full bg-accent px-5 py-2 text-xs font-medium text-accent-foreground disabled:opacity-40">
                Run analysis
              </button>
              {busy && <span role="status" className="text-xs text-muted">{busy}</span>}
              {error && <span role="alert" className="text-xs text-red-600">{error}</span>}
            </div>
            <p className="mt-2 text-[11px] text-muted">Start with a still, relaxed face, then perform the selected condition. About 10–20 s, front-facing, steady. The file is discarded once analysis finishes.</p>
          </section>

          <section>
            <h2 className="text-sm font-semibold">3 · Record the human expectation, BEFORE reading the result below</h2>
            <div className="mt-3">
              <ExpressionExpectationsForm value={selected.expectations} onChange={(expectations) => update(withExpectations(selected, expectations))} />
            </div>
          </section>

          {selected.videoSample && (
            <section>
              <h2 className="text-sm font-semibold">4 · Expected vs MogaFace (expression domains only)</h2>
              <table className="mt-3 w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-border text-muted">
                    <th className="py-1.5 pr-3 font-medium">Domain</th>
                    <th className="py-1.5 pr-3 font-medium">Expected</th>
                    <th className="py-1.5 pr-3 font-medium">MogaFace</th>
                    <th className="py-1.5 pr-3 font-medium">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.domain} className="border-b border-border/50">
                      <td className="py-1.5 pr-3">{r.label}</td>
                      <td className="py-1.5 pr-3">{r.expected ?? "not recorded"}</td>
                      <td className="py-1.5 pr-3">{r.actual.state.replace("_", " ")}</td>
                      <td className="py-1.5 pr-3 font-medium">{r.result}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <section>
            <h2 className="text-sm font-semibold">5 · Independent review</h2>
            <p className="mt-1 text-xs text-muted">Current status: {REVIEW_LABEL[selected.reviewerStatus]}. This should be done by someone other than whoever entered the result above.</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input aria-label="Review note" value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} placeholder="Review note" className="w-56 rounded border border-border bg-background px-2 py-1.5 text-xs" />
              {REVIEWER_STATUSES.filter((s) => canTransitionReviewerStatus(selected.reviewerStatus, s)).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    update(withReviewerStatus(selected, s, reviewNote || null));
                    setReviewNote("");
                  }}
                  className="rounded-full border border-border px-4 py-1.5 text-xs"
                >
                  Mark {REVIEW_LABEL[s].toLowerCase()}
                </button>
              ))}
              {REVIEWER_STATUSES.filter((s) => canTransitionReviewerStatus(selected.reviewerStatus, s)).length === 0 && <span className="text-xs text-muted">Terminal state — no further transition.</span>}
            </div>
          </section>
        </>
      )}

      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={wordingReviewed} onChange={(e) => setWordingReviewed(e.target.checked)} />
        Consumer-facing wording for the expression_lines opportunity has been reviewed (sign-off criterion 5 — confirm manually, this cannot be computed).
      </label>

      <ReadinessPanel sessions={sessions} proposals={proposals} wordingReviewed={wordingReviewed} />

      {sessions.length > 0 && (
        <>
          <p className="text-[11px] text-muted">Held-out sessions: {sessions.filter((s) => s.datasetSplit === "held_out").map((s) => s.sessionId).join(", ") || "none yet"} — do not cite these as evidence when proposing a threshold change below.</p>
          <AggregatePanel sessions={sessions} proposals={proposals} onProposals={setProposals} />
        </>
      )}
    </div>
  );
}
