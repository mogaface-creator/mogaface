/**
 * A FIXED, hardcoded treatment-opportunity fixture for the development-only
 * supervised illustration test (see devTestHandler.ts). It exists so a
 * developer can exercise the real pipeline — their real front photo, the real
 * consent gate, one real image-editing call — without marking any real
 * observation "consumer ready" and without touching
 * VISUAL_OBSERVATIONS_CALIBRATED (lib/facial-analysis/calibration/status.ts),
 * which stays false everywhere else.
 *
 * Only NEUROMODULATOR → expression_lines is approved by ILLUSTRATION_POLICY
 * (see eligibility.ts); that gate is independent of the calibration override
 * this fixture relies on, so this fixture can never produce a filler,
 * lifting, skin, under-eye or contour visualization even if someone edited
 * its category — the policy check would still block it.
 *
 * This fixture is never accepted from a request: devTestHandler.ts ignores
 * whatever "opportunities" a caller sends and always uses this one instead.
 */

import { buildChangeFromOpportunity } from "../visualization/build.ts";
import { visualizedAreaFor } from "../visualization/present.ts";
import type { VisualizedArea } from "../visualization/present.ts";
import { PRESERVATION_RULES, VISUALIZATION_CATEGORIES, VISUALIZATION_DISCLAIMER } from "../visualization/types.ts";
import type { VisualizationCategory, VisualizationPlan } from "../visualization/types.ts";
import { VISUALIZATION_PLAN_VERSION } from "../visualization/versions.ts";
import type { TreatmentOpportunity } from "../treatment-opportunities/types.ts";

/** Only the fields lib/visualization/build.ts and eligibility.ts read — see sanitizeOpportunities in handler.ts for the same minimal shape. */
export const DEV_ILLUSTRATION_FIXTURE_OPPORTUNITY = {
  id: "dev-fixture.expression-lines",
  category: "NEUROMODULATOR",
  status: "potential_opportunity",
  consumerReady: true,
  evidenceObservationIds: ["expression.dev-fixture-line-pattern"],
  evidenceQuestionIds: [],
} as unknown as TreatmentOpportunity;

export interface DevIllustrationTestEnv {
  NODE_ENV?: string;
  DEV_ILLUSTRATION_TEST?: string;
}

/** Both must hold. Either false → the caller gets a plain 404, as if the route did not exist. */
export function isDevIllustrationTestEnabled(env: DevIllustrationTestEnv): boolean {
  return env.NODE_ENV === "development" && env.DEV_ILLUSTRATION_TEST === "1";
}

// =====================================================================================
// Dev-only COMPOSITE (multi-area) fixture — previews the target reference-style
// experience (Before → Illustrative After + a card per visualized area) without
// claiming any real user has evidence for all five areas at once.
//
// Three of these five categories (jawline_definition, under_eye, skin_appearance)
// have no production derivation path at all — see the comments on
// APPROVED_VISUAL_CHANGES in lib/visualization/types.ts and build.ts's APPROVED
// map. This module is the ONLY place that ever constructs a change for them; a
// real user's plan (buildVisualizationPlan) can never produce one, no matter
// what policy or calibration state is in effect.
// =====================================================================================

/** One synthetic, clearly-labelled opportunity per visualization category — never a real user's evidence. */
export const DEV_MULTI_AREA_FIXTURE_OPPORTUNITIES: Record<VisualizationCategory, TreatmentOpportunity> = {
  expression_lines: DEV_ILLUSTRATION_FIXTURE_OPPORTUNITY,
  facial_contour: {
    id: "dev-fixture.facial-contour",
    category: "FACIAL_CONTOURING",
    status: "potential_opportunity",
    consumerReady: true,
    evidenceObservationIds: ["facialStructure.contour.dev-fixture-midface"],
    evidenceQuestionIds: [],
  } as unknown as TreatmentOpportunity,
  jawline_definition: {
    id: "dev-fixture.jawline-definition",
    category: "FACIAL_CONTOURING",
    status: "potential_opportunity",
    consumerReady: true,
    evidenceObservationIds: ["facialStructure.contour.dev-fixture-jawline"],
    evidenceQuestionIds: [],
  } as unknown as TreatmentOpportunity,
  under_eye: {
    id: "dev-fixture.under-eye",
    category: "DERMAL_FILLER",
    status: "potential_opportunity",
    consumerReady: true,
    evidenceObservationIds: ["eyeArea.underEye.dev-fixture"],
    evidenceQuestionIds: [],
  } as unknown as TreatmentOpportunity,
  skin_appearance: {
    id: "dev-fixture.skin-appearance",
    category: "SKIN_TREATMENT",
    status: "potential_opportunity",
    consumerReady: true,
    evidenceObservationIds: ["skin.dev-fixture-texture"],
    evidenceQuestionIds: [],
  } as unknown as TreatmentOpportunity,
};

export const DEV_MULTI_AREA_FIXTURE_OPPORTUNITIES_LIST: TreatmentOpportunity[] = VISUALIZATION_CATEGORIES.map(
  (category) => DEV_MULTI_AREA_FIXTURE_OPPORTUNITIES[category],
);

/** Opens every category for this dev-only path ONLY — the real ILLUSTRATION_POLICY (eligibility.ts) is never touched. */
export const DEV_FULL_ILLUSTRATION_POLICY: Record<VisualizationCategory, boolean> = Object.fromEntries(
  VISUALIZATION_CATEGORIES.map((category) => [category, true]),
) as Record<VisualizationCategory, boolean>;

/**
 * Builds a "planned" VisualizationPlan with one change per category, using the
 * exact same fixed wording and change shape a real plan would use
 * (buildChangeFromOpportunity) — just from synthetic opportunities instead of
 * real evidence. Every change still individually passes the same structural
 * and safety validators as a production plan.
 */
export function buildDevMultiAreaPlan(frontPhotoRef: string): VisualizationPlan {
  const changes = VISUALIZATION_CATEGORIES.map((category) => buildChangeFromOpportunity(category, DEV_MULTI_AREA_FIXTURE_OPPORTUNITIES[category]));
  return {
    version: VISUALIZATION_PLAN_VERSION,
    status: "planned",
    sourcePhoto: { slot: "front", ref: frontPhotoRef },
    changes,
    excludedChanges: [],
    disclaimer: VISUALIZATION_DISCLAIMER,
    preserve: PRESERVATION_RULES,
    ineligibleReason: null,
    evidence: changes.map((c) => ({ sourceType: "treatment_opportunity" as const, sourceId: c.sourceOpportunityId })),
  };
}

/** The five area cards this fixture would show, computed once so the dev UI can render them without a network round trip. */
export const DEV_MULTI_AREA_PREVIEW: VisualizedArea[] = buildDevMultiAreaPlan("preview").changes.map(visualizedAreaFor);

/** The one area card the single-fixture dev test would show — same rendering path, for a consistent preview. */
export const DEV_SINGLE_AREA_PREVIEW: VisualizedArea[] = [visualizedAreaFor(buildChangeFromOpportunity("expression_lines", DEV_ILLUSTRATION_FIXTURE_OPPORTUNITY))];
