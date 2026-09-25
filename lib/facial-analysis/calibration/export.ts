/**
 * Privacy-safe export of calibration sessions.
 *
 * The export contains structured calibration METADATA only: sample ids,
 * engineering metadata, expectations, the actual observations, comparison
 * results, threshold decisions, notes, proposals and version ids. It never
 * contains a photo or video, never base64, never a blob/object URL, and
 * nothing is uploaded — the browser hands the JSON to the developer to save.
 *
 * `serializeSessionsExport` scans its own output and REFUSES to produce text
 * if anything media-like is found, so a bug elsewhere cannot leak an image
 * through this path.
 */

import { ANALYSIS_VERSION } from "../analysis.ts";
import { MULTI_PHOTO_ANALYSIS_VERSION } from "../multiPhoto/types.ts";
import { VIDEO_ANALYSIS_VERSION } from "../video/types.ts";
import { OBSERVATION_ENGINE_VERSION } from "../../observation/versions.ts";
import type { Observation } from "../../observation/types.ts";
import { compareSession } from "./comparison.ts";
import type { ComparisonRow } from "./comparison.ts";
import type { ThresholdProposal } from "./proposals.ts";
import { aggregateSessions, buildSessionReport, photoQualityReport, STATISTIC_DISCLAIMER } from "./report.ts";
import type { AggregateReport, PhotoQualityReport, SessionReport } from "./report.ts";
import { validateSession } from "./session.ts";
import type { CalibrationSession, SessionMetadata } from "./session.ts";
import { CALIBRATION_VERSION } from "./status.ts";
import type { EngineeringExpectations } from "./expectations.ts";
import type { CalibrationSample, ThresholdDecision } from "./types.ts";

export const EXPORT_KIND = "mogaface-calibration-sessions";

interface ExportedSample {
  quality: PhotoQualityReport | null;
  observations: Pick<Observation<unknown>, "id" | "label" | "type" | "value" | "source" | "confidence" | "methodologyVersion">[];
  thresholdDecisions: ThresholdDecision[];
  /** Numeric metrics only (no media). Present only when raw output was explicitly included. */
  rawMetrics?: CalibrationSample["rawMetrics"];
}

export interface ExportedSession {
  sessionId: string;
  metadata: SessionMetadata;
  expectations: EngineeringExpectations;
  notes: string;
  comparison: ComparisonRow[];
  report: Omit<SessionReport, "rows">;
  photos: Record<string, ExportedSample>;
  videoSample: ExportedSample | null;
}

export interface SessionsExport {
  exportKind: typeof EXPORT_KIND;
  calibrationVersion: string;
  exportedAt: string;
  versions: { analysisVersion: string; observationEngineVersion: string; videoAnalysisVersion: string; multiPhotoAnalysisVersion: string };
  notice: string;
  aggregate: AggregateReport;
  sessions: ExportedSession[];
  proposals: ThresholdProposal[];
}

const EXPORT_NOTICE =
  "Engineering calibration data only. Contains no photos or videos. Expectations are a developer's visual opinion, not ground truth. " + STATISTIC_DISCLAIMER;

function exportSample(sample: CalibrationSample, includeRaw: boolean): ExportedSample {
  return {
    quality: sample.rawMetrics.kind === "photo" ? photoQualityReport(sample) : null,
    observations: sample.generatedObservations.map((o) => ({ id: o.id, label: o.label, type: o.type, value: o.value, source: o.source, confidence: o.confidence, methodologyVersion: o.methodologyVersion })),
    thresholdDecisions: sample.thresholdDecisions,
    ...(includeRaw ? { rawMetrics: sample.rawMetrics } : {}),
  };
}

export function buildSessionsExport(input: { sessions: CalibrationSession[]; proposals?: ThresholdProposal[]; includeRaw?: boolean; now?: () => string }): SessionsExport {
  const includeRaw = input.includeRaw === true;
  return {
    exportKind: EXPORT_KIND,
    calibrationVersion: CALIBRATION_VERSION,
    exportedAt: (input.now ?? (() => new Date().toISOString()))(),
    versions: {
      analysisVersion: ANALYSIS_VERSION,
      observationEngineVersion: OBSERVATION_ENGINE_VERSION,
      videoAnalysisVersion: VIDEO_ANALYSIS_VERSION,
      multiPhotoAnalysisVersion: MULTI_PHOTO_ANALYSIS_VERSION,
    },
    notice: EXPORT_NOTICE,
    aggregate: aggregateSessions(input.sessions),
    sessions: input.sessions.map((s) => {
      const { rows, ...report } = buildSessionReport(s);
      void rows;
      return {
        sessionId: s.sessionId,
        metadata: s.metadata,
        expectations: s.expectations,
        notes: s.notes,
        comparison: compareSession(s),
        report,
        photos: Object.fromEntries(Object.entries(s.photoSamples).map(([slot, sample]) => [slot, exportSample(sample!, includeRaw)])),
        videoSample: s.videoSample ? exportSample(s.videoSample, includeRaw) : null,
      };
    }),
    proposals: input.proposals ?? [],
  };
}

// ---------------------------------------------------------------------------
// The media guard
// ---------------------------------------------------------------------------

const FORBIDDEN_KEYS = /^(file|filename|blob|objecturl|previewurl|dataurl|imagedata|image|pixels?|bytes|base64|frames?data)$/i;

/** Returns what looks like media in `text` (parsed JSON keys and string values). Empty = clean. */
export function findMediaBytes(text: string): string[] {
  const found: string[] = [];
  if (/data:[a-z]+\/[a-z0-9.+-]+[;,]/i.test(text)) found.push("a data: URL");
  if (/\bblob:/i.test(text)) found.push("a blob: URL");
  if (/[A-Za-z0-9+/]{300,}={0,2}/.test(text)) found.push("a long base64-like run");
  if (/\.(jpe?g|png|webp|heic|gif|mp4|mov|webm)\b/i.test(text)) found.push("a media file name");
  try {
    const walk = (v: unknown) => {
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === "object") {
        for (const [k, x] of Object.entries(v)) {
          if (FORBIDDEN_KEYS.test(k)) found.push(`a "${k}" field`);
          walk(x);
        }
      }
    };
    walk(JSON.parse(text));
  } catch {
    found.push("text that is not valid JSON");
  }
  return [...new Set(found)];
}

export type SerializeResult = { ok: true; text: string } | { ok: false; problems: string[] };

/** Validates every session, builds the export, scans it for media, and only then returns text. Never throws. */
export function serializeSessionsExport(input: { sessions: CalibrationSession[]; proposals?: ThresholdProposal[]; includeRaw?: boolean; now?: () => string }): SerializeResult {
  const problems = input.sessions.flatMap((s) => validateSession(s).map((p) => `${s.sessionId}: ${p}`));
  if (problems.length > 0) return { ok: false, problems };
  const text = JSON.stringify(buildSessionsExport(input), (_k, v) => (typeof v === "number" && !Number.isFinite(v) ? null : v), 2);
  const media = findMediaBytes(text);
  return media.length > 0 ? { ok: false, problems: media.map((m) => `Refusing to export: found ${m}.`) } : { ok: true, text };
}
