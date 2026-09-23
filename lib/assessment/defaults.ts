import { ASSESSMENT_VERSION, type Assessment } from "./types.ts";

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `assessment-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createEmptyAssessment(): Assessment {
  const now = new Date().toISOString();
  return {
    id: generateId(),
    createdAt: now,
    updatedAt: now,
    assessmentVersion: ASSESSMENT_VERSION,
    profile: { ageYears: null, genderPresentation: null, heightCm: null, weightKg: null },
    goals: { areas: [], priorities: [] },
    hair: { length: null, texture: null, density: null, concerns: [], currentStyle: "", haircutFrequency: null },
    facialHair: { currentStyle: null, improvements: [] },
    lifestyle: {
      sleepHours: null,
      exerciseFrequency: null,
      trainingTypes: [],
      dailyActivity: null,
      waterIntake: null,
    },
    style: { currentStyle: null, styleGoals: [], monthlySpend: null },
    photos: [],
  };
}
