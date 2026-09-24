import { buildFilledAssessment, buildMultiPhotoAnalysisWithFront } from "../observation/fixtures.ts";
import { buildMogaFaceAnalysis } from "../../lib/observation/build.ts";
import { measuredObservation } from "../../lib/observation/helpers.ts";
import type { Assessment } from "../../lib/assessment/types.ts";
import type { MogaFaceAnalysis } from "../../lib/observation/types.ts";
import type { ConcernSignal, ConcernSignalKind, EvaluationContext, EvidenceItem } from "../../lib/treatment-opportunities/types.ts";

export function assessmentWithGoals(priorities: Assessment["goals"]["priorities"], areas: Assessment["goals"]["areas"] = []): Assessment {
  const a = buildFilledAssessment();
  a.goals = { areas, priorities };
  return a;
}

export function analysisWithFront(): MogaFaceAnalysis {
  return buildMogaFaceAnalysis(buildFilledAssessment(), buildMultiPhotoAnalysisWithFront());
}

/** A visual-feature observation of the kind a FUTURE skin/lines layer would emit. Not produced by the app today. */
export function visualFeature(id: string, source = "front") {
  return measuredObservation({ id, domain: "skin", label: id, value: true, source });
}

export function signal(kind: ConcernSignalKind, strength: ConcernSignal["strength"] = "explicit"): ConcernSignal {
  const evidence: EvidenceItem = { kind: "questionnaire", id: `test.${kind}`, label: `Test goal: ${kind}`, source: "user" };
  return { kind, strength, evidence: [evidence] };
}

export function context(overrides: Partial<EvaluationContext> = {}): EvaluationContext {
  return { photoAnalysisAvailable: true, videoAnalyzed: false, signals: [], observations: [], videoObservations: [], ...overrides };
}

/** A cheek-outline angle as the photo layer emits it: one per view, source = the photo slot. */
export function cheekContour(slot: string, side: "left" | "right" = "left", value = 140) {
  return measuredObservation({
    id: `facialStructure.contour.cheekContourAngle.${slot}.${side}`,
    domain: "facial-structure",
    label: `Cheek contour angle, ${side} side (${slot})`,
    value,
    source: slot,
  });
}

/** A video-derived observation as the expression domain emits it (source names sampled frames). */
export function videoObservation(id: string, value: number | boolean, frames = "video_frame_1+video_frame_5") {
  return measuredObservation({ id, domain: "expression", label: id, value, source: frames });
}
