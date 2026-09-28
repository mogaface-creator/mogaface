/**
 * Readiness evaluator for the FIRST real-data calibration milestone:
 * `expression` only (see the calibration gap audit and
 * docs/VISUAL_CALIBRATION.md). It reports whether the prerequisites for
 * setting `CALIBRATION_STATE.expression = true`
 * (lib/facial-analysis/calibration/status.ts) are satisfied — it NEVER sets
 * that flag, and `ready` cannot become `true` without real evidence: with
 * zero sessions every requirement below is unmet by construction.
 *
 * This composes the EXISTING session / comparison / report / proposal
 * machinery; it invents no new measurement of what the visual layer
 * detected. The source of truth for what "ready" requires is
 * docs/VISUAL_CALIBRATION.md's sign-off criteria — this function does not
 * weaken it.
 */

import { confusionCountsByDomain, EXPRESSION_DOMAINS } from "./expressionValidation.ts";
import type { ConfusionCounts, ExpressionComparisonDomain } from "./expressionValidation.ts";
import { aggregateSessions, MIN_LABELLED_FOR_RATE } from "./report.ts";
import type { AggregateReport } from "./report.ts";
import type { CalibrationSession } from "./session.ts";
import { CALIBRATION_VERSION } from "./status.ts";
import type { ThresholdProposal } from "./proposals.ts";

/** Per docs/VISUAL_CALIBRATION.md §9 — a working minimum for engineering confidence, not a statistical guarantee. */
export const MIN_REAL_PEOPLE = 30;

export interface RequirementCheck {
  id:
    | "sample_count"
    | "split_assigned"
    | "tuning_present"
    | "held_out_present"
    | "human_expectations_recorded"
    | "held_out_validated"
    | "independent_review"
    | "threshold_changes_reviewed"
    | "calibration_version_tracked"
    | "consumer_wording_reviewed";
  met: boolean;
  detail: string;
}

export interface ExpressionReadinessReport {
  category: "expression";
  /** True only when every requirement below is met. Never inferred, never a default. */
  ready: boolean;
  requirements: RequirementCheck[];
  sampleCounts: {
    total: number;
    tuning: number;
    heldOut: number;
    /** Sessions recorded for this category but not yet assigned a split — these count toward nothing until assigned. */
    unassignedSplit: number;
    independentlyApproved: number;
  };
  /** Aggregate engineering statistic over TUNING sessions only — same shape and same withheld-rate rule as report.ts's aggregateSessions. */
  tuningAggregate: AggregateReport;
  /** Aggregate engineering statistic over HELD-OUT sessions only — this is what validates a proposal; it must never be the set a threshold was tuned on. */
  heldOutAggregate: AggregateReport;
  /** True positive/false positive/true negative/false negative counts and agreement rate, per condition, held-out sessions only. */
  heldOutConfusionByDomain: Record<ExpressionComparisonDomain, ConfusionCounts>;
  calibrationVersion: string;
}

export interface ExpressionReadinessOptions {
  /**
   * A developer must explicitly confirm this was done elsewhere (sign-off
   * criterion 5 in docs/VISUAL_CALIBRATION.md) — there is no way to compute
   * "the wording was reviewed" from data, so it is never inferred or
   * defaulted to true.
   */
  consumerWordingReviewed?: boolean;
  thresholdProposals?: ThresholdProposal[];
}

const EXPRESSION_DOMAIN_SET = new Set<string>(EXPRESSION_DOMAINS);
const filterToExpressionDomains = (report: AggregateReport): AggregateReport => ({
  ...report,
  domains: report.domains.filter((d) => EXPRESSION_DOMAIN_SET.has(d.domain)),
});

function hasExpectationCoverage(sessions: CalibrationSession[]): boolean {
  return sessions.some((s) =>
    EXPRESSION_DOMAINS.some((d) =>
      d.startsWith("expression.") ? s.expectations.expression[d.slice("expression.".length) as keyof typeof s.expectations.expression] !== null : s.expectations.lines[d.slice("lines.".length) as keyof typeof s.expectations.lines] !== null,
    ),
  );
}

/**
 * Evaluates readiness for the `expression` category from real sessions only.
 * Sessions whose `calibrationCategory` is not "expression" are ignored, so
 * evidence collected for a different category can never count here.
 */
export function evaluateExpressionReadiness(allSessions: CalibrationSession[], options: ExpressionReadinessOptions = {}): ExpressionReadinessReport {
  const sessions = allSessions.filter((s) => s.calibrationCategory === "expression");
  const tuning = sessions.filter((s) => s.datasetSplit === "tuning");
  const heldOut = sessions.filter((s) => s.datasetSplit === "held_out");
  const unassigned = sessions.filter((s) => s.datasetSplit === null);
  const approved = sessions.filter((s) => s.reviewerStatus === "approved");

  const tuningAggregate = filterToExpressionDomains(aggregateSessions(tuning));
  const heldOutAggregate = filterToExpressionDomains(aggregateSessions(heldOut));
  const heldOutConfusionByDomain = confusionCountsByDomain(heldOut);

  const heldOutHasRates = heldOutAggregate.domains.some((d) => d.detectionRate !== null || d.falsePositiveRate !== null);
  const pendingProposals = (options.thresholdProposals ?? []).filter((p) => p.status === "PROPOSED");
  const versionMismatches = sessions.filter((s) => s.calibrationVersion !== CALIBRATION_VERSION);

  const requirements: RequirementCheck[] = [
    {
      id: "sample_count",
      met: sessions.length >= MIN_REAL_PEOPLE,
      detail: `${sessions.length} / ${MIN_REAL_PEOPLE} real, consenting people recorded for the expression category.`,
    },
    {
      id: "split_assigned",
      met: sessions.length > 0 && unassigned.length === 0,
      detail: sessions.length === 0 ? "No expression-category sessions recorded yet." : unassigned.length > 0 ? `${unassigned.length} session(s) have not been assigned tuning or held-out.` : "Every session is assigned to tuning or held-out.",
    },
    { id: "tuning_present", met: tuning.length > 0, detail: `${tuning.length} tuning session(s).` },
    { id: "held_out_present", met: heldOut.length > 0, detail: `${heldOut.length} held-out session(s).` },
    {
      id: "human_expectations_recorded",
      met: hasExpectationCoverage(tuning) && hasExpectationCoverage(heldOut),
      detail: "Human expectations for at least one expression/line-pattern domain recorded in both the tuning and held-out splits, before results were read.",
    },
    {
      id: "held_out_validated",
      met: heldOutHasRates,
      detail: heldOutHasRates
        ? "Held-out detection/false-positive rates are available for at least one domain."
        : `Held-out rates are withheld until >= ${MIN_LABELLED_FOR_RATE} clearly labelled, evaluable held-out samples exist for a domain (see report.ts's MIN_LABELLED_FOR_RATE).`,
    },
    {
      id: "independent_review",
      met: approved.length >= MIN_REAL_PEOPLE,
      detail: `${approved.length} / ${MIN_REAL_PEOPLE} sessions independently reviewed and approved (someone other than whoever entered the result).`,
    },
    {
      id: "threshold_changes_reviewed",
      met: pendingProposals.length === 0,
      detail: pendingProposals.length > 0 ? `${pendingProposals.length} threshold proposal(s) are still PROPOSED — every proposal must be APPROVED or REJECTED before sign-off.` : "No threshold proposal is left undecided.",
    },
    {
      id: "calibration_version_tracked",
      met: sessions.length > 0 && versionMismatches.length === 0,
      detail: sessions.length === 0 ? "No sessions yet." : versionMismatches.length > 0 ? `${versionMismatches.length} session(s) were recorded under a different calibration version than the current ${CALIBRATION_VERSION}.` : `All sessions match calibration version ${CALIBRATION_VERSION}.`,
    },
    {
      id: "consumer_wording_reviewed",
      met: options.consumerWordingReviewed === true,
      detail: options.consumerWordingReviewed === true ? "Consumer-facing wording for the expression_lines opportunity has been reviewed." : "Consumer-facing wording review has not been confirmed (sign-off criterion 5).",
    },
  ];

  return {
    category: "expression",
    ready: requirements.every((r) => r.met),
    requirements,
    sampleCounts: { total: sessions.length, tuning: tuning.length, heldOut: heldOut.length, unassignedSplit: unassigned.length, independentlyApproved: approved.length },
    tuningAggregate,
    heldOutAggregate,
    heldOutConfusionByDomain,
    calibrationVersion: CALIBRATION_VERSION,
  };
}
