/**
 * One screen per question. A follow-up appears only after the answer that needs it.
 * Fourteen short question steps, followed by photos and separate processing consent.
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
    "id": "protocolAgeRange",
    "askIds": ["protocolAgeRange"]
  },
  {
    "id": "goals",
    "askIds": [
      "places"
    ]
  },
  {
    "id": "protocolHairTexture",
    "askIds": [
      "protocolHairTexture"
    ],
    "auto": true
  },
  {
    "id": "protocolHairGoal",
    "askIds": [
      "protocolHairGoal"
    ],
    "auto": true
  },
  {
    "id": "protocolSkinConcerns",
    "askIds": [
      "protocolSkinConcerns"
    ]
  },
  {
    "id": "protocolSensitivity",
    "askIds": [
      "protocolSensitivity"
    ],
    "auto": true
  },
  {
    "id": "protocolBeardGoal",
    "askIds": [
      "protocolBeardGoal"
    ],
    "auto": true
  },
  {
    "id": "protocolBudget",
    "askIds": [
      "protocolBudget"
    ],
    "auto": true
  },
  {
    "id": "maxWilling",
    "askIds": [
      "maxWilling"
    ],
    "auto": true
  },
  {
    "id": "wantAfterPhoto",
    "askIds": [
      "wantAfterPhoto"
    ],
    "auto": true
  },
  {
    "id": "protocolBodyMetrics",
    "title": "Optional height and weight",
    "askIds": ["protocolHeight", "protocolWeight"]
  },
  {
    "id": "protocolDiet",
    "askIds": ["protocolDiet"]
  },
  {
    "id": "protocolActivity",
    "askIds": ["protocolActivity"]
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
  return true;
}
