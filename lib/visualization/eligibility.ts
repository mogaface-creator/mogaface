/**
 * The GENERATION eligibility decision — separate from, and stricter than, the
 * visualization plan. A plan says what could be illustrated from the approved
 * opportunities; this decides whether an image model may be called at all.
 * It never adds anything to the plan: it can only approve or block changes
 * the plan already contains.
 *
 * A change is approved for generation only when ALL hold:
 *   1. the plan is valid and "planned",
 *   2. the category's evidence policy is approved (ILLUSTRATION_POLICY),
 *   3. its source opportunity exists, is a potential opportunity of the
 *      matching category, and is consumer-ready — re-checked here against the
 *      calibration gate, not just trusted from a stored flag.
 *
 * Today only expression-line illustrations are approved, and only when their
 * (uncalibrated) video evidence becomes consumer-ready. Facial-contour
 * illustrations are BLOCKED: front-photo geometry can make a contouring
 * opportunity consumer-ready, but that does not by itself authorise rendering
 * an image; the evidence policy for it has not been approved. Filler, lifting,
 * skin and under-eye have no approved visual change at all.
 */

import { isConsumerReady } from "../facial-analysis/calibration/status.ts";
import type { TreatmentOpportunity } from "../treatment-opportunities/types.ts";
import { VISUALIZATION_CATEGORY_TREATMENT_CATEGORY } from "./types.ts";
import type { VisualizationCategory, VisualizationChange, VisualizationPlan } from "./types.ts";
import { validateVisualizationPlan } from "./validate.ts";

/**
 * The product decision, in one place. Change a value here only after the
 * evidence policy for that area is explicitly approved. jawline_definition
 * and under_eye have no real evidence path at all (see types.ts's
 * APPROVED_VISUAL_CHANGES comments) and skin_appearance is deliberately
 * excluded even earlier, in build.ts — their `false` here is defense in
 * depth, not the only thing blocking them.
 */
export const ILLUSTRATION_POLICY: Record<VisualizationCategory, boolean> = {
  expression_lines: true,
  facial_contour: false, // pending an explicit evidence-policy decision — see the module comment
  jawline_definition: false,
  under_eye: false,
  skin_appearance: false,
};

export const ILLUSTRATION_UNAVAILABLE_MESSAGE = "An illustrative visualization isn't available from the current analysis.";
export const ILLUSTRATION_FAILED_MESSAGE = "An illustrative visualization isn't available for this analysis.";

export type IllustrationIneligibleReason = "plan_not_eligible" | "invalid_plan" | "policy_not_approved" | "evidence_not_consumer_ready";

export interface IllustrationDecision {
  eligible: boolean;
  reason: IllustrationIneligibleReason | null;
  /** The plan's ineligibility reason, when that is why (e.g. "no_front_photo"). */
  planReason: VisualizationPlan["ineligibleReason"];
  /** Only these may be rendered. */
  approvedChanges: VisualizationChange[];
  blocked: { category: string; reason: string }[];
}

export interface EligibilityOptions {
  policy?: Record<VisualizationCategory, boolean>;
  /** Overrides the calibration flag. ONLY the development demo passes this. */
  calibrated?: boolean;
}

const no = (reason: IllustrationIneligibleReason, plan: VisualizationPlan | null, blocked: IllustrationDecision["blocked"] = []): IllustrationDecision => ({
  eligible: false,
  reason,
  planReason: plan?.ineligibleReason ?? null,
  approvedChanges: [],
  blocked,
});

export function decideIllustrationEligibility(plan: VisualizationPlan | null | undefined, opportunities: TreatmentOpportunity[], options: EligibilityOptions = {}): IllustrationDecision {
  if (!plan) return no("invalid_plan", null);
  if (validateVisualizationPlan(plan, opportunities).length > 0) return no("invalid_plan", plan);
  if (plan.status !== "planned") return no("plan_not_eligible", plan, plan.excludedChanges.map((e) => ({ category: e.category, reason: e.reason })));

  const policy = options.policy ?? ILLUSTRATION_POLICY;
  const approvedChanges: VisualizationChange[] = [];
  const blocked: IllustrationDecision["blocked"] = [];
  let policyBlocked = false;

  for (const change of plan.changes) {
    if (policy[change.category] !== true) {
      policyBlocked = true;
      blocked.push({ category: change.category, reason: "Illustrations for this area are not enabled yet." });
      continue;
    }
    const opp = opportunities.find((o) => o.id === change.sourceOpportunityId);
    const ready =
      !!opp &&
      opp.status === "potential_opportunity" &&
      opp.category === VISUALIZATION_CATEGORY_TREATMENT_CATEGORY[change.category] &&
      opp.consumerReady === true &&
      isConsumerReady(opp.evidenceObservationIds, options.calibrated) &&
      opp.evidenceObservationIds.length > 0;
    if (!ready) {
      blocked.push({ category: change.category, reason: "The visual evidence for this area is not yet at a standard that allows it to be illustrated." });
      continue;
    }
    approvedChanges.push(change);
  }

  if (approvedChanges.length === 0) return { ...no(policyBlocked ? "policy_not_approved" : "evidence_not_consumer_ready", plan, blocked), planReason: null };
  return { eligible: true, reason: null, planReason: null, approvedChanges, blocked };
}
