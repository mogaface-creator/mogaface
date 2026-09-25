"use client";

import { compareSession, potentialWording, type ComparisonRow } from "@/lib/facial-analysis/calibration/comparison.ts";
import {
  EXPRESSIONS, LINE_REGIONS, PRESENCE_LEVELS, PRESENCE_WORDING, QUALITY_LABELS,
  type EngineeringExpectations, type PresenceLevel, type QualityLabel, type QualityTarget,
} from "@/lib/facial-analysis/calibration/expectations.ts";
import { buildSessionReport, photoQualityReport, sessionMargins } from "@/lib/facial-analysis/calibration/report.ts";
import { AGE_BANDS, CAMERAS, LIGHTING, MAX_NOTES_LENGTH, PHOTO_VIEWS, YES_NO_UNKNOWN, withExpectations, withNotes, type CalibrationSession, type SessionMetadata } from "@/lib/facial-analysis/calibration/session.ts";
import type { RawVideoMetrics } from "@/lib/facial-analysis/calibration/types.ts";
import { SampleCard, fmt } from "./SampleCard";

/**
 * One calibration session: input quality, engineering expectations, the
 * actual-vs-expected table, borderline decisions, multi-view consistency,
 * video detail, and raw engine output. DEVELOPMENT ONLY — none of this is
 * ever shown on the consumer results page. Everything is derived from
 * metric-only samples; no media is held here.
 */

const RESULT_STYLE: Record<ComparisonRow["result"], string> = {
  MATCH: "text-accent",
  MISS: "text-red-600 dark:text-red-400",
  FALSE_POSITIVE: "text-red-600 dark:text-red-400",
  UNCLEAR: "text-muted",
  NOT_RECORDED: "text-muted/60",
};
const RESULT_LABEL: Record<ComparisonRow["result"], string> = { MATCH: "MATCH", MISS: "MISS", FALSE_POSITIVE: "FALSE POSITIVE", UNCLEAR: "UNCLEAR", NOT_RECORDED: "—" };
const ACTUAL_LABEL = { detected: "detected", not_detected: "not detected", withheld_borderline: "WITHHELD (borderline)", not_evaluated: "not evaluated" } as const;
const STATUS_STYLE: Record<QualityLabel, string> = { usable: "text-accent", borderline: "text-amber-600 dark:text-amber-400", unusable: "text-red-600 dark:text-red-400" };

const selectCls = "rounded border border-border bg-background px-1.5 py-1 text-xs";

function LevelSelect({ value, wording, onChange, label }: { value: PresenceLevel | null; wording: Record<PresenceLevel, string>; onChange: (v: PresenceLevel | null) => void; label: string }) {
  return (
    <label className="flex items-center justify-between gap-3 text-xs">
      <span>{label}</span>
      <select aria-label={`Expected: ${label}`} className={selectCls} value={value ?? ""} onChange={(e) => onChange((e.target.value || null) as PresenceLevel | null)}>
        <option value="">not recorded</option>
        {PRESENCE_LEVELS.map((l) => (
          <option key={l} value={l}>
            {wording[l]}
          </option>
        ))}
      </select>
    </label>
  );
}

function ExpectationsForm({ value, onChange, targets }: { value: EngineeringExpectations; onChange: (v: EngineeringExpectations) => void; targets: { target: QualityTarget; label: string }[] }) {
  return (
    <div className="grid gap-x-10 gap-y-5 sm:grid-cols-2">
      <fieldset className="space-y-2">
        <legend className="text-xs font-medium uppercase tracking-wide text-muted">Facial lines</legend>
        {LINE_REGIONS.map((r) => (
          <LevelSelect key={r} label={r === "lateralEye" ? "Lateral eye" : r[0].toUpperCase() + r.slice(1)} wording={PRESENCE_WORDING.lines} value={value.lines[r]} onChange={(v) => onChange({ ...value, lines: { ...value.lines, [r]: v } })} />
        ))}
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-xs font-medium uppercase tracking-wide text-muted">Facial contour · Under-eye</legend>
        <LevelSelect label="Contour" wording={PRESENCE_WORDING.contour} value={value.contour} onChange={(v) => onChange({ ...value, contour: v })} />
        <LevelSelect label="Under-eye" wording={PRESENCE_WORDING.underEye} value={value.underEye} onChange={(v) => onChange({ ...value, underEye: v })} />
        <p className="text-[11px] text-muted">Describe only what is visible. Do not label causes or conditions.</p>
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-xs font-medium uppercase tracking-wide text-muted">Expression movement (video)</legend>
        {EXPRESSIONS.map((x) => (
          <LevelSelect key={x} label={x === "BROW_RAISE" ? "Brow raise" : x[0] + x.slice(1).toLowerCase()} wording={PRESENCE_WORDING.expression} value={value.expression[x]} onChange={(v) => onChange({ ...value, expression: { ...value.expression, [x]: v } })} />
        ))}
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-xs font-medium uppercase tracking-wide text-muted">Input quality (does the input itself look usable?)</legend>
        {targets.length === 0 && <p className="text-[11px] text-muted">Run the analysis first.</p>}
        {targets.map(({ target, label }) => (
          <label key={target} className="flex items-center justify-between gap-3 text-xs">
            <span>{label}</span>
            <select
              aria-label={`Expected quality: ${label}`}
              className={selectCls}
              value={value.quality[target] ?? ""}
              onChange={(e) => {
                const q = { ...value.quality };
                if (e.target.value) q[target] = e.target.value as QualityLabel;
                else delete q[target];
                onChange({ ...value, quality: q });
              }}
            >
              <option value="">not recorded</option>
              {QUALITY_LABELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        ))}
      </fieldset>
    </div>
  );
}

function VideoDetail({ raw }: { raw: RawVideoMetrics }) {
  return (
    <div className="space-y-4 text-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="text-muted">
            <tr>
              <th className="pr-3">expression</th>
              <th className="pr-3">status</th>
              <th className="pr-3">evidence strength</th>
              <th className="pr-3">mean movement %</th>
              <th className="pr-3">best frame %</th>
              <th>frames</th>
            </tr>
          </thead>
          <tbody>
            {(raw.expressionEvidence ?? []).map((e) => (
              <tr key={e.expression} className="border-t border-border">
                <td className="pr-3">{e.expression}</td>
                <td className="pr-3">{e.status.replace("_", " ")}</td>
                <td className="pr-3">{e.strength ?? "—"}</td>
                <td className="pr-3 font-mono">{fmt(e.movementPct)}</td>
                <td className="pr-3 font-mono">{fmt(raw.stateCandidates[e.expression].bestMovementPct)}</td>
                <td className="text-muted">{e.expressionFrames.join(", ") || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="text-muted">
            <tr>
              <th className="pr-3">line region</th>
              <th className="pr-3">vs</th>
              <th className="pr-3">neutral contrast</th>
              <th className="pr-3">expression contrast</th>
              <th className="pr-3">ratio</th>
              <th>status</th>
            </tr>
          </thead>
          <tbody>
            {raw.linePatterns.map((p) => (
              <tr key={`${p.kind}-${p.expression}`} className="border-t border-border">
                <td className="pr-3">{p.kind}</td>
                <td className="pr-3">{p.expression}</td>
                <td className="pr-3 font-mono">{fmt(p.neutralContrast)}</td>
                <td className="pr-3 font-mono">{fmt(p.expressionContrast)}</td>
                <td className="pr-3 font-mono">{fmt(p.contrastRatio)}</td>
                <td>{p.status.replace("_", " ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const META_FIELDS: { key: keyof SessionMetadata; label: string; options: readonly string[] }[] = [
  { key: "ageBand", label: "Approx. age band", options: AGE_BANDS },
  { key: "lighting", label: "Lighting", options: LIGHTING },
  { key: "camera", label: "Camera", options: CAMERAS },
  { key: "glasses", label: "Glasses", options: YES_NO_UNKNOWN },
  { key: "makeup", label: "Makeup", options: YES_NO_UNKNOWN },
];

export function SessionView({ session, onChange }: { session: CalibrationSession; onChange: (s: CalibrationSession) => void }) {
  const report = buildSessionReport(session);
  const rows = compareSession(session);
  const margins = sessionMargins(session);
  const photos = PHOTO_VIEWS.filter((v) => session.photoSamples[v.slot]);
  const qualityTargets: { target: QualityTarget; label: string }[] = [...photos.map((v) => ({ target: v.slot as QualityTarget, label: v.label })), ...(session.videoSample ? [{ target: "video" as QualityTarget, label: "Video" }] : [])];
  const raw = session.videoSample?.rawMetrics.kind === "video" ? session.videoSample.rawMetrics : null;
  const c = report.consistency;

  return (
    <div className="space-y-10">
      {/* metadata */}
      <section>
        <h3 className="text-sm font-semibold">Engineering metadata</h3>
        <p className="mt-1 text-xs text-muted">Not identifying and not inferred from the image. Prefer &ldquo;not recorded&rdquo;.</p>
        <div className="mt-3 flex flex-wrap gap-4">
          {META_FIELDS.map((f) => (
            <label key={f.key} className="flex flex-col gap-1 text-xs">
              {f.label}
              <select aria-label={f.label} className={selectCls} value={session.metadata[f.key]} onChange={(e) => onChange({ ...session, metadata: { ...session.metadata, [f.key]: e.target.value } as SessionMetadata })}>
                {f.options.map((o) => (
                  <option key={o} value={o}>
                    {o.replace("_", " ")}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      </section>

      {/* input quality */}
      <section data-testid="quality-cards">
        <h3 className="text-sm font-semibold">Input quality</h3>
        {photos.length === 0 && !session.videoSample && <p className="mt-2 text-xs text-muted">No analysis yet — choose files above and run the analysis.</p>}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {photos.map((v) => {
            const q = photoQualityReport(session.photoSamples[v.slot]!);
            return (
              <div key={v.slot} className="rounded-xl border border-border p-4 text-xs" data-testid={`quality-${v.slot}`}>
                <p className="flex items-baseline justify-between">
                  <span className="text-sm font-medium">{v.label}</span>
                  <span className={`font-medium uppercase ${STATUS_STYLE[q.status]}`}>{q.status}</span>
                </p>
                <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5">
                  {(
                    [
                      ["face detected", q.faceDetected ? `yes (${q.faceCount})` : `no (${q.faceCount ?? "—"})`],
                      ["landmarks", q.landmarkStatus.replace("_", " ")],
                      ["quality score", q.qualityScore],
                      ["roll °", q.rollDegrees],
                      ["yaw ratio", q.yawRatio],
                      ["brightness", q.brightness],
                      ["face size", q.faceSize],
                    ] as [string, unknown][]
                  ).map(([k, val]) => (
                    <div key={k} className="flex justify-between gap-2">
                      <dt className="text-muted">{k}</dt>
                      <dd className="font-mono">{fmt(val)}</dd>
                    </div>
                  ))}
                </dl>
                {q.reasons.length > 0 && <ul className="mt-2 list-disc space-y-0.5 pl-4 text-red-600 dark:text-red-400">{q.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
                {q.warnings.length > 0 && <ul className="mt-2 list-disc space-y-0.5 pl-4 text-amber-700 dark:text-amber-400">{q.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
              </div>
            );
          })}
          {session.videoSample && report.video.frames && (
            <div className="rounded-xl border border-border p-4 text-xs" data-testid="quality-video">
              <p className="flex items-baseline justify-between">
                <span className="text-sm font-medium">Video</span>
                <span className={`font-medium uppercase ${STATUS_STYLE[report.video.quality!]}`}>{report.video.quality}</span>
              </p>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5">
                {(Object.entries(report.video.frames) as [string, number][]).map(([k, val]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <dt className="text-muted">frames {k}</dt>
                    <dd className="font-mono">{val}</dd>
                  </div>
                ))}
              </dl>
              {raw && raw.notes.length > 0 && <p className="mt-2 text-amber-700 dark:text-amber-400">{raw.notes.join(" ")}</p>}
            </div>
          )}
        </div>
      </section>

      {/* expectations */}
      <section>
        <h3 className="text-sm font-semibold">Engineering expectation</h3>
        <p className="mt-1 max-w-3xl text-xs text-muted">
          What you expect the layer to find, judged by eye. This is <strong>not ground truth</strong>: how something looks in a photo is not clinical truth, and this says nothing about any condition.
        </p>
        <div className="mt-4">
          <ExpectationsForm value={session.expectations} onChange={(e) => onChange(withExpectations(session, e))} targets={qualityTargets} />
        </div>
      </section>

      {/* comparison */}
      <section data-testid="comparison-table">
        <h3 className="text-sm font-semibold">Expected vs MogaFace</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-muted">
              <tr>
                <th className="pr-4 py-1">Domain</th>
                <th className="pr-4">Expected</th>
                <th className="pr-4">MogaFace</th>
                <th className="pr-4">Result</th>
                <th>Why</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const flag = potentialWording(r.result);
                const wording = r.domain.startsWith("lines.") ? PRESENCE_WORDING.lines : r.domain === "contour" ? PRESENCE_WORDING.contour : r.domain === "underEye" ? PRESENCE_WORDING.underEye : PRESENCE_WORDING.expression;
                return (
                  <tr key={r.domain} className={`border-t border-border align-top ${r.borderline ? "bg-amber-50 dark:bg-amber-950/20" : ""}`}>
                    <td className="py-1.5 pr-4">{r.label}</td>
                    <td className="pr-4">{r.expected ? (r.domain.startsWith("quality.") ? r.expected : wording[r.expected as PresenceLevel]) : <span className="text-muted">not recorded</span>}</td>
                    <td className="pr-4">
                      {r.actualQuality ?? ACTUAL_LABEL[r.actual.state]}
                      {r.borderline && <span className="ml-1 font-medium text-amber-700 dark:text-amber-400">BORDERLINE</span>}
                    </td>
                    <td className={`pr-4 font-medium ${RESULT_STYLE[r.result]}`}>
                      {RESULT_LABEL[r.result]}
                      {flag && <span className="block text-[11px] font-normal">{flag}</span>}
                    </td>
                    <td className="text-muted">{r.result === "NOT_RECORDED" ? "" : r.note}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* summary */}
      <section data-testid="session-summary">
        <h3 className="text-sm font-semibold">Session summary — {session.sessionId}</h3>
        <ul className="mt-2 space-y-1 text-xs">
          <li>Photos: {report.photos.submitted} submitted, {report.photos.processed} processed{report.photos.missingRequired.length > 0 && ` (baseline views missing: ${report.photos.missingRequired.join(", ")})`}</li>
          <li>Quality: {report.photoQuality.usable} usable, {report.photoQuality.borderline} borderline, {report.photoQuality.unusable} unusable</li>
          <li>
            Against your expectations: {report.totals.matches} match · {report.totals.potentialMisses} potential miss(es) · {report.totals.potentialFalsePositives} potential false positive(s) · {report.totals.unclear} unclear
          </li>
          {report.lines.map((l) => (
            <li key={l} className="text-muted">
              {l}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-muted">A handful of samples says nothing about accuracy. Potential misses and false positives are prompts to look closer, not measured error rates.</p>
      </section>

      {/* borderline */}
      <section data-testid="borderline-table">
        <h3 className="text-sm font-semibold">Threshold decisions and margins</h3>
        <p className="mt-1 text-xs text-muted">Borderline results are withheld as insufficient evidence — never a coin-flip observation. Nothing here changes a threshold.</p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-muted">
              <tr>
                <th className="pr-3 py-1">metric</th>
                <th className="pr-3">source</th>
                <th className="pr-3">value</th>
                <th className="pr-3">threshold</th>
                <th className="pr-3">margin</th>
                <th className="pr-3">borderline band</th>
                <th className="pr-3">decision</th>
                <th>reason</th>
              </tr>
            </thead>
            <tbody>
              {margins.map((m) => (
                <tr key={`${m.source}-${m.id}`} className={`border-t border-border align-top ${m.status === "BORDERLINE / WITHHELD" ? "bg-amber-50 dark:bg-amber-950/20" : ""}`}>
                  <td className="py-1.5 pr-3">{m.metric}</td>
                  <td className="pr-3">{m.source}</td>
                  <td className="pr-3 font-mono">{fmt(m.value)}</td>
                  <td className="pr-3 font-mono">{m.comparator} {fmt(m.threshold)}</td>
                  <td className="pr-3 font-mono">{m.margin === null ? "—" : `${m.margin > 0 ? "+" : ""}${fmt(m.margin)}${m.marginPct !== null ? ` (${fmt(m.marginPct)}%)` : ""}`}</td>
                  <td className="pr-3 font-mono">{m.band ? `${fmt(m.band.clear)} / ${fmt(m.band.fail)}` : "—"}</td>
                  <td className={`pr-3 font-medium ${m.status === "BORDERLINE / WITHHELD" ? "text-amber-700 dark:text-amber-400" : ""}`}>{m.status}</td>
                  <td className="text-muted">{m.reason}</td>
                </tr>
              ))}
              {margins.length === 0 && (
                <tr>
                  <td className="py-2 text-muted" colSpan={8}>No threshold-based decisions yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* multi-view consistency */}
      <section data-testid="consistency">
        <h3 className="text-sm font-semibold">Multi-view consistency</h3>
        <div className="mt-2 space-y-1 text-xs">
          {c.contour.map((g) => (
            <p key={g.metric}>
              <span className="font-medium">{g.metric}</span>: {g.values.map((v) => `${v.view} ${fmt(v.value)}°`).join(" · ")}
              {g.spread !== null && <span className="text-muted"> — spread {fmt(g.spread)}°</span>}
            </p>
          ))}
          <p>Left vs right 45° contour agree (guard {c.disagreementThresholdDeg}°): <span className="font-medium">{c.contourViewsDisagree ? "NO — engine would set this evidence aside" : "yes / not enough views to compare"}</span></p>
          <p>Brightness spread across photos: {fmt(c.brightnessSpread)} {c.brightnessFlagged && <span className="text-amber-700">(flagged)</span>} · Face-size ratio: {fmt(c.faceSizeRatio)} {c.faceSizeFlagged && <span className="text-amber-700">(flagged)</span>}</p>
          {c.notes.map((n) => (
            <p key={n} className="text-amber-700 dark:text-amber-400">{n}</p>
          ))}
        </div>
      </section>

      {/* video */}
      {raw && (
        <section data-testid="video-detail">
          <h3 className="text-sm font-semibold">Video calibration</h3>
          <div className="mt-3">
            <VideoDetail raw={raw} />
          </div>
        </section>
      )}

      {/* raw output */}
      <section data-testid="raw-output">
        <details>
          <summary className="cursor-pointer text-sm font-semibold">Raw output (measurements, observations, sources, decisions, reasons)</summary>
          <div className="mt-4 space-y-4">
            {photos.map((v) => (
              <SampleCard key={v.slot} sample={session.photoSamples[v.slot]!} onChange={(s) => onChange({ ...session, photoSamples: { ...session.photoSamples, [v.slot]: s } })} />
            ))}
            {session.videoSample && <SampleCard sample={session.videoSample} onChange={(s) => onChange({ ...session, videoSample: s })} />}
            {photos.length === 0 && !session.videoSample && <p className="text-xs text-muted">Nothing analysed yet.</p>}
          </div>
        </details>
      </section>

      <section>
        <label className="block text-sm font-semibold" htmlFor={`notes-${session.sessionId}`}>Notes</label>
        <textarea
          id={`notes-${session.sessionId}`}
          value={session.notes}
          maxLength={MAX_NOTES_LENGTH}
          onChange={(e) => onChange(withNotes(session, e.target.value))}
          placeholder="Engineering observations only. Do not enter names, contact details or anything identifying, and do not mention file names."
          className="mt-2 h-24 w-full rounded border border-border bg-background p-2 text-xs"
        />
      </section>
    </div>
  );
}
