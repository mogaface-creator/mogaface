/**
 * A calibration SESSION: one real, consenting person's sample, analysed with
 * the existing pipeline and held in browser memory only.
 *
 * Privacy by construction: a session stores an anonymous id, a handful of
 * engineering metadata fields, expectations, and the existing metric-only
 * CalibrationSamples. It has NO field for a name, contact detail, date of
 * birth or any media — and no File, Blob, URL or pixel data can be attached
 * to it. The media itself lives only in a component's state while it is being
 * analysed and is discarded straight afterwards.
 */

import { emptyExpectations, validateExpectations } from "./expectations.ts";
import type { EngineeringExpectations } from "./expectations.ts";
import type { PhotoSlot } from "../multiPhoto/types.ts";
import { CALIBRATION_CATEGORIES, CALIBRATION_VERSION } from "./status.ts";
import type { CalibrationCategory } from "./status.ts";
import { validateCalibrationSample } from "./sample.ts";
import type { CalibrationSample } from "./types.ts";

export const AGE_BANDS = ["not_recorded", "18-29", "30-39", "40-49", "50+"] as const;
export const LIGHTING = ["indoor", "outdoor", "mixed", "unknown"] as const;
export const CAMERAS = ["front", "rear", "unknown"] as const;
export const YES_NO_UNKNOWN = ["yes", "no", "unknown"] as const;

/**
 * Engineering metadata ONLY. Nothing is inferred from the image, and nothing
 * here can identify a person. `ageBand` defaults to "not_recorded" — prefer it.
 */
export interface SessionMetadata {
  ageBand: (typeof AGE_BANDS)[number];
  lighting: (typeof LIGHTING)[number];
  camera: (typeof CAMERAS)[number];
  glasses: (typeof YES_NO_UNKNOWN)[number];
  makeup: (typeof YES_NO_UNKNOWN)[number];
}

export function defaultMetadata(): SessionMetadata {
  return { ageBand: "not_recorded", lighting: "unknown", camera: "unknown", glasses: "unknown", makeup: "unknown" };
}

export const PHOTO_VIEWS: { slot: PhotoSlot; label: string; required: boolean }[] = [
  { slot: "front", label: "Front", required: true },
  { slot: "leftFortyFive", label: "Left 45°", required: true },
  { slot: "rightFortyFive", label: "Right 45°", required: true },
  { slot: "leftProfile", label: "Left profile", required: false },
  { slot: "rightProfile", label: "Right profile", required: false },
];

export const MAX_NOTES_LENGTH = 1000;

/**
 * Which side of the tuning/held-out split this session belongs to. Thresholds
 * may only be tuned against `tuning` evidence (see proposals.ts); `held_out`
 * evidence exists to validate a proposal, never to produce one. A session has
 * exactly one value here (or none yet) — there is no way to represent "both",
 * so the "never simultaneously tuning and held-out" rule holds by construction,
 * not by a runtime check. See docs/VISUAL_CALIBRATION.md §9.
 */
export const DATASET_SPLITS = ["tuning", "held_out"] as const;
export type DatasetSplit = (typeof DATASET_SPLITS)[number];

/**
 * Independent-review state for a session, distinct from whoever ran the
 * analysis and recorded expectations. Nothing in this file advances this
 * automatically: entering expectations, running the pipeline, or adding notes
 * never changes it. Only `withReviewerStatus` does, and only along the
 * transitions in REVIEWER_TRANSITIONS below — a session cannot jump straight
 * from `not_reviewed` to `approved`, so a genuine second look is required.
 */
export const REVIEWER_STATUSES = ["not_reviewed", "reviewed", "approved", "rejected"] as const;
export type ReviewerStatus = (typeof REVIEWER_STATUSES)[number];

const REVIEWER_TRANSITIONS: Record<ReviewerStatus, readonly ReviewerStatus[]> = {
  not_reviewed: ["reviewed"],
  reviewed: ["approved", "rejected"],
  approved: [],
  rejected: [],
};

export function canTransitionReviewerStatus(from: ReviewerStatus, to: ReviewerStatus): boolean {
  return REVIEWER_TRANSITIONS[from].includes(to);
}

export interface CalibrationSession {
  /** Anonymous engineering id, e.g. "REAL-001". */
  sessionId: string;
  metadata: SessionMetadata;
  photoSamples: Partial<Record<PhotoSlot, CalibrationSample>>;
  videoSample: CalibrationSample | null;
  expectations: EngineeringExpectations;
  /** Free text. Do not enter names or anything identifying. */
  notes: string;
  calibrationVersion: string;
  createdAt: string;
  /**
   * Which calibration category this session's evidence targets, e.g.
   * "expression" for the first real-data milestone. Null until a developer
   * assigns it — never guessed or defaulted, since a session's evidence
   * should only ever count toward the category it was actually collected for.
   */
  calibrationCategory: CalibrationCategory | null;
  /** Null until a developer explicitly assigns it — see DatasetSplit above. */
  datasetSplit: DatasetSplit | null;
  /** Defaults to "not_reviewed": see REVIEWER_STATUSES above. */
  reviewerStatus: ReviewerStatus;
  reviewerNote: string | null;
}

/**
 * Ids are anonymous labels like REAL-001. Anything that could be a name,
 * email, phone number or date is refused, so an identifying value cannot be
 * used as the id by accident.
 */
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/;

export function validateSessionId(id: unknown): string[] {
  if (typeof id !== "string" || id.trim().length === 0) return ["Sample ID is required (e.g. REAL-001)."];
  const problems: string[] = [];
  if (!ID_PATTERN.test(id)) problems.push("Sample ID may contain only letters, digits, '-' and '_' (max 32 characters).");
  if (/@/.test(id)) problems.push("Sample ID looks like an email address. Use an anonymous id such as REAL-001.");
  if (/\d{7,}/.test(id.replace(/[-_\s]/g, ""))) problems.push("Sample ID contains a long number (looks like a phone number or date). Use an anonymous id such as REAL-001.");
  return problems;
}

export function createSession(sessionId: string, metadata: SessionMetadata = defaultMetadata()): CalibrationSession {
  const problems = validateSessionId(sessionId);
  if (problems.length > 0) throw new Error(problems[0]);
  return {
    sessionId,
    metadata,
    photoSamples: {},
    videoSample: null,
    expectations: emptyExpectations(),
    notes: "",
    calibrationVersion: CALIBRATION_VERSION,
    createdAt: new Date().toISOString(),
    calibrationCategory: null,
    datasetSplit: null,
    reviewerStatus: "not_reviewed",
    reviewerNote: null,
  };
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const oneOf = (list: readonly string[], v: unknown) => typeof v === "string" && list.includes(v);

export function validateMetadata(value: unknown): string[] {
  if (!isObject(value)) return ["metadata must be an object"];
  const problems: string[] = [];
  if (!oneOf(AGE_BANDS, value.ageBand)) problems.push("ageBand is invalid");
  if (!oneOf(LIGHTING, value.lighting)) problems.push("lighting is invalid");
  if (!oneOf(CAMERAS, value.camera)) problems.push("camera is invalid");
  if (!oneOf(YES_NO_UNKNOWN, value.glasses)) problems.push("glasses is invalid");
  if (!oneOf(YES_NO_UNKNOWN, value.makeup)) problems.push("makeup is invalid");
  // Only the five engineering fields are allowed: nothing identifying can ride along.
  for (const key of Object.keys(value)) if (!["ageBand", "lighting", "camera", "glasses", "makeup"].includes(key)) problems.push(`metadata field "${key}" is not allowed`);
  return problems;
}

/** Never throws. Empty = well-formed. */
export function validateSession(value: unknown): string[] {
  if (!isObject(value)) return ["session must be an object"];
  const problems: string[] = [...validateSessionId(value.sessionId), ...validateMetadata(value.metadata), ...validateExpectations(value.expectations)];

  if (!isObject(value.photoSamples)) problems.push("photoSamples must be an object");
  else {
    for (const [slot, sample] of Object.entries(value.photoSamples)) {
      if (!PHOTO_VIEWS.some((v) => v.slot === slot)) problems.push(`photoSamples.${slot}: not a photo view`);
      for (const p of validateCalibrationSample(sample)) problems.push(`photoSamples.${slot}: ${p}`);
      if (isObject(sample) && sample.photoRole !== slot) problems.push(`photoSamples.${slot}: sample role does not match its slot`);
    }
  }
  if (value.videoSample !== null) {
    for (const p of validateCalibrationSample(value.videoSample)) problems.push(`videoSample: ${p}`);
    if (isObject(value.videoSample) && value.videoSample.sourceType !== "video") problems.push("videoSample must be a video sample");
  }
  if (typeof value.notes !== "string") problems.push("notes must be a string");
  else if (value.notes.length > MAX_NOTES_LENGTH) problems.push(`notes are limited to ${MAX_NOTES_LENGTH} characters`);
  if (value.calibrationCategory !== null && !(CALIBRATION_CATEGORIES as readonly unknown[]).includes(value.calibrationCategory)) problems.push("calibrationCategory must be a registered calibration category, or null");
  if (value.datasetSplit !== null && !(DATASET_SPLITS as readonly unknown[]).includes(value.datasetSplit)) problems.push("datasetSplit must be 'tuning', 'held_out', or null");
  if (!(REVIEWER_STATUSES as readonly unknown[]).includes(value.reviewerStatus)) problems.push("reviewerStatus is invalid");
  if (value.reviewerNote !== null && typeof value.reviewerNote !== "string") problems.push("reviewerNote must be a string or null");
  // A session may hold ONLY these fields — nothing that could carry media or identity.
  for (const key of Object.keys(value)) {
    if (
      ![
        "sessionId", "metadata", "photoSamples", "videoSample", "expectations", "notes", "calibrationVersion", "createdAt",
        "calibrationCategory", "datasetSplit", "reviewerStatus", "reviewerNote",
      ].includes(key)
    )
      problems.push(`session field "${key}" is not allowed`);
  }
  if (typeof value.calibrationVersion !== "string" || value.calibrationVersion.length === 0) problems.push("calibrationVersion must be a non-empty string");
  if (typeof value.createdAt !== "string" || Number.isNaN(Date.parse(value.createdAt))) problems.push("createdAt must be a valid ISO date string");
  return problems;
}

export const withPhotoSample = (s: CalibrationSession, slot: PhotoSlot, sample: CalibrationSample): CalibrationSession => ({ ...s, photoSamples: { ...s.photoSamples, [slot]: sample } });
export const withVideoSample = (s: CalibrationSession, sample: CalibrationSample | null): CalibrationSession => ({ ...s, videoSample: sample });
export const withExpectations = (s: CalibrationSession, expectations: EngineeringExpectations): CalibrationSession => ({ ...s, expectations });
export const withNotes = (s: CalibrationSession, notes: string): CalibrationSession => ({ ...s, notes: notes.slice(0, MAX_NOTES_LENGTH) });
export const withCalibrationCategory = (s: CalibrationSession, category: CalibrationCategory | null): CalibrationSession => ({ ...s, calibrationCategory: category });
/** Reassigning a session's split is a deliberate developer action, never a default. */
export const withDatasetSplit = (s: CalibrationSession, split: DatasetSplit | null): CalibrationSession => ({ ...s, datasetSplit: split });

/**
 * Advances reviewer status. Throws on an invalid transition (e.g. straight
 * from not_reviewed to approved) rather than silently no-op-ing, matching
 * createSession's existing style for rejected input.
 */
export function withReviewerStatus(s: CalibrationSession, status: ReviewerStatus, note: string | null = null): CalibrationSession {
  if (!canTransitionReviewerStatus(s.reviewerStatus, status)) {
    throw new Error(`Cannot move reviewer status from "${s.reviewerStatus}" to "${status}".`);
  }
  return { ...s, reviewerStatus: status, reviewerNote: note };
}

/** Which of the baseline-required views are present. */
export function baselineCoverage(s: CalibrationSession): { present: PhotoSlot[]; missingRequired: PhotoSlot[]; submitted: number } {
  const present = PHOTO_VIEWS.filter((v) => s.photoSamples[v.slot]).map((v) => v.slot);
  return { present, missingRequired: PHOTO_VIEWS.filter((v) => v.required && !s.photoSamples[v.slot]).map((v) => v.slot), submitted: present.length };
}
