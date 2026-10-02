/**
 * One screen per question. A follow-up appears only after the answer that needs it.
 * Eighteen questions in all, including those follow-ups.
 */

import { detailsOfConcern, isAppearanceConcernId } from "./appearanceConcerns.ts";
import { askVisible, replyOf } from "./clinicIntake.ts";
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
  { id: "age", askIds: ["ageConfirmed"], auto: true },
  { id: "words", askIds: ["directWordsOk"], auto: true },
  { id: "want", askIds: ["reportWant"], auto: true },
  { id: "bother", askIds: ["dislikes"] },
  { id: "howLong", askIds: ["dislikeDuration"], auto: true },
  { id: "places", askIds: ["places"] },
  { id: "where", askIds: ["placeDetails"] },
  { id: "look", askIds: ["lookDirections"] },
  { id: "limit", askIds: ["maxWilling"], auto: true },
  { id: "down", askIds: ["downtime"], auto: true },
  { id: "prior", askIds: ["hadPriorWork"], auto: true },
  { id: "priorWhat", askIds: ["priorTreatments"] },
  { id: "size", title: "Height and weight", askIds: ["heightCm", "weightKg"] },
  { id: "sleep", askIds: ["sleepHours"], auto: true },
  { id: "flags", askIds: ["clinicFlags"] },
  { id: "event", askIds: ["hasEvent"], auto: true },
  { id: "eventWhat", askIds: ["event"] },
  { id: "after", askIds: ["wantAfterPhoto"], auto: true },
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
  if (screen.id === "howLong") return intake.dislikes.some((dislike) => dislike.words.trim().length > 0);
  if (screen.id === "where") return whereGroups(intake).length > 0;
  return asksOn(screen).some((ask) => askVisible(intake, ask));
}

export function visibleScreens(intake: ClinicIntake): PreviewScreen[] {
  return PREVIEW_SCREENS.filter((screen) => screenApplies(screen, intake));
}

export function previewCanContinue(screenId: string, intake: ClinicIntake): boolean {
  if (screenId === "age") return intake.ageConfirmed === "yes";
  if (screenId === "bother") return intake.dislikes.some((dislike) => dislike.words.trim().length > 0);
  if (screenId === "howLong") return replyOf(intake, "dislikeDuration") !== "";
  if (screenId === "places") return intake.places.length > 0;
  if (screenId === "size") return intake.heightCm !== null && intake.weightKg !== null;
  if (screenId === "flags") return (intake.picked.clinicFlags ?? []).length > 0;
  if (screenId === "priorWhat") return replyOf(intake, "priorTreatments").trim().length > 0;
  if (screenId === "eventWhat") return replyOf(intake, "event").trim().length > 0;
  return true;
}
