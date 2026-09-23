/**
 * Hair, facial hair, skin, lifestyle, and style — domains built entirely
 * from questionnaire answers today. Every observation here is
 * user_reported; none of it is computer-vision analysis (see
 * ANALYSIS_LIMITATIONS). An unanswered question produces no observation —
 * "user_reported: null" would misrepresent silence as an answer.
 */

import { userReportedObservation } from "./helpers.ts";
import type { Assessment } from "../assessment/types.ts";
import type {
  FacialHairAnalysis,
  HairAnalysis,
  LifestyleAnalysis,
  Observation,
  SkinAnalysis,
  StyleAnalysis,
} from "./types.ts";

function scalar<T extends string>(
  list: Observation<string | string[]>[],
  domain: "hair" | "facial-hair" | "lifestyle" | "style",
  id: string,
  label: string,
  value: T | null,
) {
  if (value === null) return;
  list.push(userReportedObservation({ id, domain, label, value }));
}

function list<T extends string>(
  collection: Observation<string | string[]>[],
  domain: "hair" | "facial-hair" | "lifestyle" | "style",
  id: string,
  label: string,
  values: T[],
) {
  if (values.length === 0) return;
  collection.push(userReportedObservation({ id, domain, label, value: values }));
}

export function buildHairAnalysis(assessment: Assessment): HairAnalysis {
  const userReported: Observation<string | string[]>[] = [];
  const { hair } = assessment;
  scalar(userReported, "hair", "hair.length", "Hair length", hair.length);
  scalar(userReported, "hair", "hair.texture", "Hair texture", hair.texture);
  scalar(userReported, "hair", "hair.density", "Hair density", hair.density);
  list(userReported, "hair", "hair.concerns", "Hair concerns", hair.concerns);
  scalar(userReported, "hair", "hair.currentStyle", "Current hairstyle", hair.currentStyle.trim() || null);
  scalar(userReported, "hair", "hair.haircutFrequency", "Haircut frequency", hair.haircutFrequency);

  return { userReported, inferences: [] };
}

export function buildFacialHairAnalysis(assessment: Assessment): FacialHairAnalysis {
  const userReported: Observation<string | string[]>[] = [];
  const { facialHair } = assessment;
  scalar(userReported, "facial-hair", "facialHair.currentStyle", "Current facial hair style", facialHair.currentStyle);
  list(userReported, "facial-hair", "facialHair.improvements", "Desired improvements", facialHair.improvements);

  return { userReported, inferences: [] };
}

export function buildSkinAnalysis(): SkinAnalysis {
  // The assessment does not currently collect any skin questions, and no
  // image-based skin analysis exists — see ANALYSIS_LIMITATIONS. Nothing
  // is fabricated here; this is the honest, empty starting state.
  return {
    status: "not_implemented",
    userReported: [],
    visualObservations: null,
    imageAnalysisResults: null,
    inferences: [],
  };
}

export function buildLifestyleAnalysis(assessment: Assessment): LifestyleAnalysis {
  const userReported: Observation<string | string[]>[] = [];
  const { lifestyle } = assessment;
  scalar(userReported, "lifestyle", "lifestyle.sleepHours", "Sleep", lifestyle.sleepHours);
  scalar(userReported, "lifestyle", "lifestyle.exerciseFrequency", "Exercise frequency", lifestyle.exerciseFrequency);
  list(userReported, "lifestyle", "lifestyle.trainingTypes", "Training types", lifestyle.trainingTypes);
  scalar(userReported, "lifestyle", "lifestyle.dailyActivity", "Daily activity", lifestyle.dailyActivity);
  scalar(userReported, "lifestyle", "lifestyle.waterIntake", "Water intake", lifestyle.waterIntake);

  return { userReported };
}

export function buildStyleAnalysis(assessment: Assessment): StyleAnalysis {
  const userReported: Observation<string | string[]>[] = [];
  const { style } = assessment;
  scalar(userReported, "style", "style.currentStyle", "Current style", style.currentStyle);
  list(userReported, "style", "style.styleGoals", "Style communication goals", style.styleGoals);
  scalar(userReported, "style", "style.monthlySpend", "Monthly appearance budget", style.monthlySpend);

  return { userReported };
}
