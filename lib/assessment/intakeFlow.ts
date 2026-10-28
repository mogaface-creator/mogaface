/**
 * One screen per question. A follow-up appears only after the answer that needs it.
 * Core intake followed by grouped, optional report-personalisation screens.
 */

import { detailsOfConcern, isAppearanceConcernId } from "./appearanceConcerns.ts";
import { askVisible } from "./clinicIntake.ts";
import type { ClinicIntake } from "./clinicIntake.ts";
import { allAsks, type Ask } from "./intakeQuestions.ts";

export interface PreviewScreen {
  id: string;
  title?: string;
  askIds: string[];
  /** A tap of Yes/No or a single choice moves straight to the next screen. */
  auto?: boolean;
}

export const PREVIEW_SCREENS: PreviewScreen[] = [
  {
    "id": "age",
    "askIds": [
      "ageConfirmed"
    ],
    "auto": true
  },
  {
    "id": "goals",
    "title": "Your goals",
    "askIds": [
      "dislikes",
      "places"
    ]
  },
  {
    "id": "where",
    "askIds": [
      "placeDetails"
    ]
  },
  {
    "id": "protocolHair",
    "title": "Your hair and preferred style",
    "askIds": [
      "protocolHairTexture",
      "protocolHairGoal",
      "protocolHairRoutine",
      "protocolHairReference",
      "protocolStylingTime"
    ]
  },
  {
    "id": "protocolSkin",
    "title": "Your skin and current routine",
    "askIds": [
      "protocolSkinType",
      "protocolSensitivity",
      "protocolSkinRoutine",
      "protocolSkinConcerns"
    ]
  },
  {
    "id": "protocolGrooming",
    "title": "Grooming and eyewear",
    "askIds": [
      "protocolBeardGoal",
      "protocolGlasses"
    ]
  },
  {
    "id": "protocolLifestyle",
    "title": "Your lifestyle",
    "askIds": [
      "heightCm",
      "weightKg",
      "sleepHours",
      "protocolDiet",
      "protocolActivity",
      "protocolEquipment"
    ]
  },
  {
    "id": "protocolPreferences",
    "title": "Style and budget",
    "askIds": [
      "protocolStyle",
      "protocolBudget",
      "protocolClinicBudget"
    ]
  },
  {
    "id": "clinicalPreferences",
    "title": "Clinic preferences and history",
    "askIds": [
      "maxWilling",
      "downtime",
      "priorTreatments",
      "clinicFlags"
    ]
  },
  {
    "id": "visualPreferences",
    "title": "Your appearance preview",
    "askIds": [
      "protocolPreserve",
      "wantAfterPhoto"
    ]
  }
];

export function asksByIds(ids: string[]): Ask[] {
  const byId = new Map(allAsks().map((ask) => [ask.id, ask]));
  return ids.flatMap((id) => {
    const ask = byId.get(id);
    return ask ? [ask] : [];
  });
}

export function asksOn(screen: PreviewScreen): Ask[] {
  return asksByIds(screen.askIds);
}

/** Detail chips that can name a real spot. "Not sure" does not tell the photo where to change. */
export function whereGroups(intake: ClinicIntake) {
  return intake.places.flatMap((place) => {
    if (place === "HAIR" || !isAppearanceConcernId(place)) return [];
    const details = detailsOfConcern(place).filter((detail) => !detail.id.endsWith("NOT_SURE"));
    return details.length > 0 ? [{ place, details }] : [];
  });
}

export function screenApplies(screen: PreviewScreen, intake: ClinicIntake): boolean {
  if (screen.id === "where") return whereGroups(intake).length > 0;
  return asksOn(screen).some((ask) => askVisible(intake, ask));
}

export function visibleScreens(intake: ClinicIntake): PreviewScreen[] {
  return PREVIEW_SCREENS.filter((screen) => screenApplies(screen, intake));
}

export function previewCanContinue(screenId: string, intake: ClinicIntake): boolean {
  if (screenId === "age") return intake.ageConfirmed === "yes";
  if (screenId === "goals") return intake.places.length > 0;
  if (screenId === "protocolLifestyle") return intake.heightCm !== null && intake.heightCm >= 100 && intake.heightCm <= 250 && intake.weightKg !== null && intake.weightKg >= 30 && intake.weightKg <= 300;
  return true;
}
