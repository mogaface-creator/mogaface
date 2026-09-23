import { buildFacialStructureAnalysis, buildEyeAreaAnalysis } from "./photoDomains.ts";
import {
  buildHairAnalysis,
  buildFacialHairAnalysis,
  buildSkinAnalysis,
  buildLifestyleAnalysis,
  buildStyleAnalysis,
} from "./questionnaireDomains.ts";
import { ANALYSIS_LIMITATIONS } from "./limitations.ts";
import { FACIAL_ANALYSIS_METHODOLOGY_VERSION, OBSERVATION_ENGINE_VERSION } from "./versions.ts";
import { ANALYSIS_VERSION } from "../facial-analysis/analysis.ts";
import type { Assessment } from "../assessment/types.ts";
import type { MultiPhotoFacialAnalysis } from "../facial-analysis/multiPhoto/types.ts";
import type { MogaFaceAnalysis, Observation } from "./types.ts";

/**
 * Builds the full observation layer for one assessment. Pure — no I/O, no
 * recalculation of anything measurements.ts/symmetry.ts/proportions.ts/
 * combine.ts already computed. `multiPhoto` is optional because a user can
 * reach the review step before running photo analysis; in that case every
 * photo-derived domain is simply empty rather than fabricated.
 */
export function buildMogaFaceAnalysis(assessment: Assessment, multiPhoto: MultiPhotoFacialAnalysis | null): MogaFaceAnalysis {
  const facialStructure = buildFacialStructureAnalysis(multiPhoto);
  const eyeArea = buildEyeAreaAnalysis(multiPhoto);
  const hair = buildHairAnalysis(assessment);
  const facialHair = buildFacialHairAnalysis(assessment);
  const skin = buildSkinAnalysis();
  const lifestyle = buildLifestyleAnalysis(assessment);
  const style = buildStyleAnalysis(assessment);

  const observations: Observation<unknown>[] = [
    ...facialStructure.measured,
    ...eyeArea.measured,
    ...eyeArea.userReported,
    ...hair.userReported,
    ...facialHair.userReported,
    ...skin.userReported,
    ...lifestyle.userReported,
    ...style.userReported,
  ];

  return {
    assessmentId: assessment.id,
    assessmentCreatedAt: assessment.createdAt,
    createdAt: new Date().toISOString(),
    facialStructure,
    eyeArea,
    hair,
    facialHair,
    skin,
    lifestyle,
    style,
    observations,
    limitations: ANALYSIS_LIMITATIONS,
    versions: {
      facialAnalysisMethodologyVersion: FACIAL_ANALYSIS_METHODOLOGY_VERSION,
      observationEngineVersion: OBSERVATION_ENGINE_VERSION,
      analysisVersion: ANALYSIS_VERSION,
      multiPhotoAnalysisVersion: multiPhoto?.multiPhotoAnalysisVersion ?? null,
      assessmentVersion: assessment.assessmentVersion,
    },
  };
}
