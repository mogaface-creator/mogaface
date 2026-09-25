import { calculateContourGeometry } from "../../lib/facial-analysis/contour.ts";
import { LANDMARK } from "../../lib/facial-analysis/landmarkMapping.ts";
import { createEmptyAppearanceConcerns, type AppearanceConcerns } from "../../lib/assessment/appearanceConcerns.ts";
import { buildInterpretationInput } from "../../lib/interpretation/build.ts";
import { buildMogaFaceAnalysis } from "../../lib/observation/build.ts";
import { measuredObservation, userReportedObservation } from "../../lib/observation/helpers.ts";
import { evaluateTreatmentOpportunities } from "../../lib/treatment-opportunities/evaluate.ts";
import { SNAPSHOT_VERSION, type AssessmentSnapshot } from "../../lib/results/types.ts";
import { buildCompleteFrontRecord, buildFilledAssessment, buildMultiPhotoAnalysisWithFront } from "../observation/fixtures.ts";
import { contourFace } from "../visual/fixtures.ts";
import type { Assessment } from "../../lib/assessment/types.ts";
import type { MogaFaceAnalysis } from "../../lib/observation/types.ts";
import type { TreatmentOpportunity } from "../../lib/treatment-opportunities/types.ts";

export function assessmentWith(partial: Partial<AppearanceConcerns>): Assessment {
  const a = buildFilledAssessment();
  a.goals = { areas: [], priorities: [] };
  a.appearanceConcerns = { ...createEmptyAppearanceConcerns(), ...partial };
  return a;
}

/** A front photo (with contour + dark under-eye) and a left-45° photo, as the real pipeline produces. */
export function analysisFor(assessment: Assessment, opts: { withVideoLines?: boolean } = {}): MogaFaceAnalysis {
  const front = buildCompleteFrontRecord();
  front.landmarks = contourFace();
  front.contour = calculateContourGeometry(contourFace(), 1200, 1600, "front");
  front.underEye = {
    right: { underEyeLuminance: 70, cheekLuminance: 100, luminanceRatio: 0.7 },
    left: { underEyeLuminance: 70, cheekLuminance: 100, luminanceRatio: 0.7 },
  };
  const turned = contourFace();
  turned[LANDMARK.noseTip] = { x: 0.35, y: 0.55, z: 0 };
  const left = { ...buildCompleteFrontRecord(), slot: "leftFortyFive" as const, contour: calculateContourGeometry(turned, 1200, 1600, "threeQuarter") };
  const a = buildMogaFaceAnalysis(assessment, { ...buildMultiPhotoAnalysisWithFront(), photos: [front, left] });
  if (opts.withVideoLines) {
    a.observations.push(
      measuredObservation({ id: "expression.visibleForeheadLinePattern", domain: "expression", label: "Visible forehead line pattern", value: true, source: "video_frame_0+video_frame_3" }),
      measuredObservation({ id: "expression.browRaise.foreheadRegionMovementPct", domain: "expression", label: "Brow raise", value: 22, source: "video_frame_0+video_frame_3" }),
    );
  }
  return a;
}

/** The real engine's opportunities for an assessment + analysis. */
export function opportunitiesFor(assessment: Assessment, analysis: MogaFaceAnalysis): TreatmentOpportunity[] {
  return evaluateTreatmentOpportunities({ assessment, analysis });
}

/** Same opportunities, with the consumer gate opened — what a calibrated system would return. Tests only. */
export const opened = (opps: TreatmentOpportunity[]): TreatmentOpportunity[] => opps.map((o) => ({ ...o, consumerReady: true }));

export function inputFor(assessment: Assessment, opts: { withVideoLines?: boolean; open?: boolean } = {}) {
  const analysis = analysisFor(assessment, opts);
  const opps = opportunitiesFor(assessment, analysis);
  return { analysis, opportunities: opts.open ? opened(opps) : opps, input: buildInterpretationInput(assessment, analysis, opts.open ? opened(opps) : opps) };
}

export function snapshotFor(assessment: Assessment, opts: { withVideoLines?: boolean; open?: boolean; frontPhoto?: AssessmentSnapshot["frontPhoto"] } = {}): AssessmentSnapshot {
  const { analysis, opportunities } = inputFor(assessment, opts);
  return {
    version: SNAPSHOT_VERSION,
    createdAt: new Date().toISOString(),
    assessment,
    analysis,
    opportunities,
    frontPhoto: opts.frontPhoto === undefined ? { ref: "blob:http://localhost/front", qualityValid: true } : opts.frontPhoto,
  };
}

export const userReported = (id: string, value: string | string[], domain: "hair" | "facial-hair" | "lifestyle" | "style" = "hair") =>
  userReportedObservation({ id, domain, label: id, value });
