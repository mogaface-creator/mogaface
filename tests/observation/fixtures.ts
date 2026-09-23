import { calculateMeasurements } from "../../lib/facial-analysis/measurements.ts";
import { calculateSymmetry } from "../../lib/facial-analysis/symmetry.ts";
import { calculateProportions } from "../../lib/facial-analysis/proportions.ts";
import { buildSymmetricFace } from "../facial-analysis/fixtures.ts";
import { createEmptyAssessment } from "../../lib/assessment/defaults.ts";
import type { PhotoAnalysisRecord } from "../../lib/facial-analysis/multiPhoto/types.ts";
import type { MultiPhotoFacialAnalysis } from "../../lib/facial-analysis/multiPhoto/types.ts";
import type { Assessment } from "../../lib/assessment/types.ts";

export function buildCompleteFrontRecord(): PhotoAnalysisRecord {
  const landmarks = buildSymmetricFace();
  const measurements = calculateMeasurements(landmarks);
  const symmetry = calculateSymmetry(landmarks, measurements);
  const proportions = calculateProportions(measurements);
  return {
    slot: "front",
    status: "complete",
    fileName: "front.jpg",
    sizeBytes: 1000,
    imageWidth: 1200,
    imageHeight: 1600,
    faceCount: 1,
    faceFrameCoverage: { width: 0.4, height: 0.5 },
    meanBrightness: 120,
    quality: { valid: true, errors: [], warnings: [], qualityScore: 100 },
    viewValidation: { plausible: true, warnings: [], notes: [] },
    landmarks,
    measurements,
    symmetry,
    proportions,
    errors: [],
    warnings: [],
    processingTimeMs: 50,
  };
}

export function buildMultiPhotoAnalysisWithFront(): MultiPhotoFacialAnalysis {
  return {
    multiPhotoAnalysisVersion: "0.1.0",
    assessmentId: "assessment-test",
    createdAt: new Date().toISOString(),
    photos: [buildCompleteFrontRecord()],
    consistency: { consistent: true, warnings: [], metrics: [] },
    combinedMeasurements: { metrics: [] },
  };
}

export function buildFilledAssessment(): Assessment {
  const assessment = createEmptyAssessment();
  assessment.profile = { ageYears: 28, heightCm: 178, weightKg: 74, genderPresentation: "male" };
  assessment.goals = { areas: ["face", "hair"], priorities: ["lookMoreDefined"] };
  assessment.hair = {
    length: "short",
    texture: "straight",
    density: "medium",
    concerns: ["hairline", "styling"],
    currentStyle: "textured crop",
    haircutFrequency: "every1to2Months",
  };
  assessment.facialHair = { currentStyle: "stubble", improvements: ["shape", "neckline"] };
  assessment.lifestyle = {
    sleepHours: "6to7",
    exerciseFrequency: "3to4PerWeek",
    trainingTypes: ["strength", "cardio"],
    dailyActivity: "moderatelyActive",
    waterIntake: "2to3L",
  };
  assessment.style = { currentStyle: "smartCasual", styleGoals: ["clean", "sharp"], monthlySpend: "3000to10000" };
  return assessment;
}
