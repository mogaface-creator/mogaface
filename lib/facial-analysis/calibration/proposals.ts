/**
 * Threshold-change PROPOSALS — a developer-only paper trail.
 *
 * A proposal records "we think threshold X should move from A to B, because…,
 * based on samples S". It does not change anything. There is no code path from
 * this file to a threshold constant: `approve` marks a decision only, and a
 * developer must still edit the constant by hand, bump CALIBRATION_VERSION and
 * log it in docs/VISUAL_CALIBRATION.md. Automatic threshold tuning is
 * deliberately not implemented.
 */

import { validateSessionId } from "./session.ts";
import { CALIBRATION_VERSION } from "./status.ts";
import { VISUAL_THRESHOLDS } from "./thresholds.ts";
import type { ThresholdDefinition } from "./thresholds.ts";

export const PROPOSAL_STATUSES = ["PROPOSED", "APPROVED", "REJECTED"] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export const APPROVAL_NOTE =
  "Approving records a decision only. Nothing changes until a developer edits the threshold in code, bumps CALIBRATION_VERSION and adds a dated entry to the change log in docs/VISUAL_CALIBRATION.md.";

/** Fewer distinct samples than this triggers an overfitting warning on the proposal. */
export const MIN_EVIDENCE_SAMPLES = 3;
export const MIN_REASON_LENGTH = 10;

export interface ThresholdProposal {
  proposalId: string;
  thresholdId: string;
  /** Read from the registry when the proposal is created — never typed in. */
  currentValue: number;
  proposedValue: number;
  reason: string;
  /** Session ids (e.g. REAL-001) that motivated the proposal. */
  evidenceSampleIds: string[];
  status: ProposalStatus;
  createdAt: string;
  decidedAt: string | null;
  decisionNote: string | null;
  /** Cautions, e.g. too few samples. Always present. */
  warnings: string[];
  calibrationVersion: string;
}

export type ProposalResult = { ok: true; proposal: ThresholdProposal } | { ok: false; problems: string[] };

export interface ProposalInput {
  thresholdId: string;
  proposedValue: number;
  reason: string;
  evidenceSampleIds: string[];
}

function newId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? `proposal-${crypto.randomUUID().slice(0, 8)}` : `proposal-${Date.now().toString(36)}`;
}

export function createProposal(input: ProposalInput, options: { registry?: ThresholdDefinition[]; knownSessionIds?: string[]; now?: () => string } = {}): ProposalResult {
  const registry = options.registry ?? VISUAL_THRESHOLDS;
  const problems: string[] = [];
  const def = registry.find((t) => t.id === input.thresholdId);
  if (!def) problems.push(`"${input.thresholdId}" is not a registered threshold.`);
  if (typeof input.proposedValue !== "number" || !Number.isFinite(input.proposedValue) || input.proposedValue <= 0) problems.push("Proposed value must be a positive number.");
  else if (def && input.proposedValue === def.value) problems.push("Proposed value equals the current value.");
  if (typeof input.reason !== "string" || input.reason.trim().length < MIN_REASON_LENGTH) problems.push(`A reason of at least ${MIN_REASON_LENGTH} characters is required.`);

  const ids = [...new Set((input.evidenceSampleIds ?? []).map((s) => String(s).trim()).filter(Boolean))];
  if (ids.length === 0) problems.push("At least one evidence sample id is required.");
  for (const id of ids) {
    if (validateSessionId(id).length > 0) problems.push(`Evidence id "${id}" is not a valid anonymous sample id.`);
    else if (options.knownSessionIds && !options.knownSessionIds.includes(id)) problems.push(`Evidence sample "${id}" is not in this session.`);
  }
  if (problems.length > 0 || !def) return { ok: false, problems };

  const warnings = [
    ...(ids.length < MIN_EVIDENCE_SAMPLES ? [`Based on only ${ids.length} sample(s). A threshold should not be changed on a handful of samples — see the overfitting guidance in docs/VISUAL_CALIBRATION.md.`] : []),
    APPROVAL_NOTE,
  ];
  return {
    ok: true,
    proposal: {
      proposalId: newId(),
      thresholdId: def.id,
      currentValue: def.value,
      proposedValue: input.proposedValue,
      reason: input.reason.trim(),
      evidenceSampleIds: ids,
      status: "PROPOSED",
      createdAt: (options.now ?? (() => new Date().toISOString()))(),
      decidedAt: null,
      decisionNote: null,
      warnings,
      calibrationVersion: CALIBRATION_VERSION,
    },
  };
}

/** Decide a PROPOSED proposal. A note is required, and a decided proposal is final. Never touches a threshold. */
export function decideProposal(proposal: ThresholdProposal, status: "APPROVED" | "REJECTED", note: string, now: () => string = () => new Date().toISOString()): ProposalResult {
  if (proposal.status !== "PROPOSED") return { ok: false, problems: [`This proposal is already ${proposal.status}.`] };
  if (typeof note !== "string" || note.trim().length === 0) return { ok: false, problems: ["A decision note is required."] };
  return { ok: true, proposal: { ...proposal, status, decidedAt: now(), decisionNote: note.trim() } };
}

export function validateProposal(value: unknown): string[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return ["proposal must be an object"];
  const p = value as Record<string, unknown>;
  const problems: string[] = [];
  if (typeof p.proposalId !== "string" || !p.proposalId) problems.push("proposalId is required");
  if (!VISUAL_THRESHOLDS.some((t) => t.id === p.thresholdId)) problems.push("thresholdId is not a registered threshold");
  for (const k of ["currentValue", "proposedValue"] as const) if (typeof p[k] !== "number" || !Number.isFinite(p[k])) problems.push(`${k} must be a finite number`);
  if (typeof p.reason !== "string" || p.reason.trim().length < MIN_REASON_LENGTH) problems.push("reason is too short");
  if (!Array.isArray(p.evidenceSampleIds) || p.evidenceSampleIds.length === 0) problems.push("evidenceSampleIds must be a non-empty array");
  if (!(PROPOSAL_STATUSES as readonly unknown[]).includes(p.status)) problems.push("status is invalid");
  if (p.status !== "PROPOSED" && (typeof p.decisionNote !== "string" || !p.decisionNote)) problems.push("a decided proposal needs a decision note");
  return problems;
}
