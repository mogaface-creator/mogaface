/**
 * CalibrationSample construction, validation and (de)serialization.
 *
 * Development-only. Samples hold numbers and short text — never image or
 * video bytes — and exist only in memory until a developer explicitly
 * exports them.
 */

import { buildEyeAreaAnalysis, buildFacialStructureAnalysis } from "../../observation/photoDomains.ts";
import { buildExpressionAnalysis } from "../../observation/videoDomains.ts";
import { validateObservation } from "../../observation/validate.ts";
import { MULTI_PHOTO_ANALYSIS_VERSION } from "../multiPhoto/types.ts";
import type { MultiPhotoFacialAnalysis, PhotoAnalysisRecord, PhotoSlot } from "../multiPhoto/types.ts";
import type { GrayImage } from "../regions.ts";
import { EXPRESSION_STATES } from "../video/types.ts";
import type { ExpressionState, VideoExpressionAnalysis } from "../video/types.ts";
import { photoThresholdDecisions, videoThresholdDecisions } from "./decisions.ts";
import { collectRawPhotoMetrics, collectRawVideoMetrics } from "./raw.ts";
import { CALIBRATION_VERSION } from "./status.ts";
import { CALIBRATION_SOURCE_TYPES, DECISION_RESULTS, EVALUATOR_LABELS } from "./types.ts";
import type { CalibrationSample, EvaluatorNote } from "./types.ts";

const PHOTO_ROLES: PhotoSlot[] = ["front", "leftFortyFive", "rightFortyFive", "leftProfile", "rightProfile"];

function newId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `sample-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createPhotoCalibrationSample(input: {
  record: PhotoAnalysisRecord;
  gray: GrayImage | null;
  sourceDescription: string;
  role: PhotoSlot;
}): CalibrationSample {
  const rawMetrics = collectRawPhotoMetrics(input.record, input.gray);
  const wrapped: MultiPhotoFacialAnalysis = {
    multiPhotoAnalysisVersion: MULTI_PHOTO_ANALYSIS_VERSION,
    assessmentId: "calibration",
    createdAt: new Date().toISOString(),
    photos: [input.record],
    consistency: { consistent: true, warnings: [], metrics: [] },
    combinedMeasurements: { metrics: [] },
  };
  const eye = buildEyeAreaAnalysis(wrapped);
  return {
    sampleId: newId(),
    sourceType: "photo",
    sourceDescription: input.sourceDescription,
    photoRole: input.role,
    videoState: null,
    rawMetrics,
    thresholdDecisions: photoThresholdDecisions(rawMetrics, input.role),
    generatedObservations: [...buildFacialStructureAnalysis(wrapped).measured, ...eye.measured, ...eye.visual],
    evaluatorNotes: [],
    calibrationVersion: CALIBRATION_VERSION,
    createdAt: new Date().toISOString(),
  };
}

export function createVideoCalibrationSample(input: {
  analysis: VideoExpressionAnalysis;
  sourceDescription: string;
  videoState: ExpressionState | null;
}): CalibrationSample {
  const rawMetrics = collectRawVideoMetrics(input.analysis);
  return {
    sampleId: newId(),
    sourceType: "video",
    sourceDescription: input.sourceDescription,
    photoRole: null,
    videoState: input.videoState,
    rawMetrics,
    thresholdDecisions: videoThresholdDecisions(rawMetrics),
    generatedObservations: buildExpressionAnalysis(input.analysis).measured,
    evaluatorNotes: [],
    calibrationVersion: CALIBRATION_VERSION,
    createdAt: new Date().toISOString(),
  };
}

/** Adds or replaces the note for one target. Returns a new sample; does not validate (validateCalibrationSample does). */
export function withEvaluatorNote(sample: CalibrationSample, note: EvaluatorNote): CalibrationSample {
  return { ...sample, evaluatorNotes: [...sample.evaluatorNotes.filter((n) => n.target !== note.target), note] };
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isNonEmptyString = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const isFiniteOrNull = (v: unknown) => v === null || (typeof v === "number" && Number.isFinite(v));

const REQUIRED_RAW_KEYS: Record<string, string[]> = {
  photo: ["detectionStatus", "faceCount", "qualityScore", "rollDegrees", "yawRatio", "faceBoundingBox", "landmarkCount", "requiredLandmarksPresent", "measurements", "contour", "underEye", "staticLineContrast"],
  video: ["metadata", "framesSampled", "framesUsable", "frames", "baseline", "neutralFrameCandidates", "stateCandidates", "linePatterns"],
};

/** Returns a list of problems (empty = well-formed). Never throws. */
export function validateCalibrationSample(value: unknown): string[] {
  if (!isObject(value)) return ["sample must be an object"];
  const problems: string[] = [];
  const s = value;

  if (!isNonEmptyString(s.sampleId)) problems.push("sampleId must be a non-empty string");
  if (!(CALIBRATION_SOURCE_TYPES as readonly unknown[]).includes(s.sourceType)) problems.push(`sourceType "${String(s.sourceType)}" is not photo or video`);
  if (typeof s.sourceDescription !== "string") problems.push("sourceDescription must be a string");

  if (s.sourceType === "photo" && !PHOTO_ROLES.includes(s.photoRole as PhotoSlot)) problems.push("a photo sample needs a valid photoRole");
  if (s.sourceType === "video" && s.photoRole !== null) problems.push("a video sample must have photoRole null");
  if (s.videoState !== null && !(EXPRESSION_STATES as readonly unknown[]).includes(s.videoState)) problems.push(`videoState "${String(s.videoState)}" is not a valid expression state`);
  if (s.sourceType === "photo" && s.videoState !== null) problems.push("a photo sample must have videoState null");

  // Raw metrics: present, of the right kind, and not missing required keys.
  if (!isObject(s.rawMetrics)) problems.push("rawMetrics is missing");
  else {
    const kind = s.rawMetrics.kind;
    if (kind !== s.sourceType) problems.push(`rawMetrics.kind "${String(kind)}" does not match sourceType`);
    for (const key of REQUIRED_RAW_KEYS[String(s.sourceType)] ?? []) {
      if (!(key in s.rawMetrics)) problems.push(`rawMetrics is missing "${key}"`);
    }
  }

  const decisionIds = new Set<string>();
  if (!Array.isArray(s.thresholdDecisions)) problems.push("thresholdDecisions must be an array");
  else {
    s.thresholdDecisions.forEach((d: unknown, i: number) => {
      if (!isObject(d)) return problems.push(`thresholdDecisions[${i}] must be an object`);
      if (!isNonEmptyString(d.id)) problems.push(`thresholdDecisions[${i}].id must be a non-empty string`);
      else decisionIds.add(d.id);
      if (!(DECISION_RESULTS as readonly unknown[]).includes(d.result)) problems.push(`thresholdDecisions[${i}].result is invalid`);
      if (!isFiniteOrNull(d.value) || !isFiniteOrNull(d.threshold)) problems.push(`thresholdDecisions[${i}] value/threshold must be a finite number or null`);
      if (!isNonEmptyString(d.metric)) problems.push(`thresholdDecisions[${i}].metric must be a non-empty string`);
    });
  }

  const observationIds = new Set<string>();
  if (!Array.isArray(s.generatedObservations)) problems.push("generatedObservations must be an array");
  else {
    s.generatedObservations.forEach((o: unknown, i: number) => {
      if (!isObject(o) || !isNonEmptyString(o.id)) return problems.push(`generatedObservations[${i}] is malformed`);
      observationIds.add(o.id);
      for (const p of validateObservation(o as never)) problems.push(`generatedObservations[${i}]: ${p}`);
    });
  }

  if (!Array.isArray(s.evaluatorNotes)) problems.push("evaluatorNotes must be an array");
  else {
    s.evaluatorNotes.forEach((n: unknown, i: number) => {
      if (!isObject(n)) return problems.push(`evaluatorNotes[${i}] must be an object`);
      if (!(EVALUATOR_LABELS as readonly unknown[]).includes(n.label)) problems.push(`evaluatorNotes[${i}].label "${String(n.label)}" is not a valid evaluator label`);
      if (typeof n.note !== "string") problems.push(`evaluatorNotes[${i}].note must be a string`);
      if (!isNonEmptyString(n.target)) problems.push(`evaluatorNotes[${i}].target must be a non-empty string`);
      else if (!decisionIds.has(n.target) && !observationIds.has(n.target)) problems.push(`evaluatorNotes[${i}].target "${n.target}" matches no decision or observation`);
    });
  }

  if (!isNonEmptyString(s.calibrationVersion)) problems.push("calibrationVersion must be a non-empty string");
  if (!isNonEmptyString(s.createdAt) || Number.isNaN(Date.parse(s.createdAt))) problems.push("createdAt must be a valid ISO date string");
  return problems;
}

export interface CalibrationExport {
  calibrationVersion: string;
  exportedAt: string;
  samples: CalibrationSample[];
}

/** Pretty JSON of the samples, for a developer to save deliberately. Contains no media bytes. */
export function serializeCalibrationSamples(samples: CalibrationSample[]): string {
  const envelope: CalibrationExport = { calibrationVersion: CALIBRATION_VERSION, exportedAt: new Date().toISOString(), samples };
  return JSON.stringify(envelope, (_k, v) => (typeof v === "number" && !Number.isFinite(v) ? null : v), 2);
}

/** Never throws. Invalid samples are dropped and reported. Non-finite numbers were exported as null, so a round trip is lossless for valid data. */
export function parseCalibrationExport(text: string): { samples: CalibrationSample[]; problems: string[] } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { samples: [], problems: ["not valid JSON"] };
  }
  if (!isObject(raw) || !Array.isArray(raw.samples)) return { samples: [], problems: ["missing samples array"] };
  const problems: string[] = [];
  if (raw.calibrationVersion !== CALIBRATION_VERSION) problems.push(`export is calibrationVersion "${String(raw.calibrationVersion)}", expected "${CALIBRATION_VERSION}"`);
  const samples: CalibrationSample[] = [];
  raw.samples.forEach((s: unknown, i: number) => {
    const p = validateCalibrationSample(s);
    if (p.length === 0) samples.push(s as CalibrationSample);
    else problems.push(`sample ${i}: ${p.join("; ")}`);
  });
  return { samples, problems };
}

/** Removes any evaluator note for `target` (a developer un-labelling a row). */
export function withoutEvaluatorNote(sample: CalibrationSample, target: string): CalibrationSample {
  return { ...sample, evaluatorNotes: sample.evaluatorNotes.filter((n) => n.target !== target) };
}
