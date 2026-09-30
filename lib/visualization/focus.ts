/**
 * Where an approved illustration should act on THIS person's photo.
 *
 * The category instruction (APPROVED_VISUAL_CHANGES) stays the safety ceiling.
 * These sentences only name the place the person actually selected, in fixed
 * wording — never their free text, never a measurement, never a treatment.
 * Every sentence is scanned by the image-prompt safety check before it can
 * be stored on a plan.
 */

import type { AppearanceConcernDetailId } from "../assessment/appearanceConcerns.ts";
import type { Assessment, HairConcern } from "../assessment/types.ts";
import type { VisualizationCategory } from "./types.ts";

export interface PredictionFocus {
  category: VisualizationCategory;
  text: string;
}

const DETAIL_FOCUS: Partial<Record<AppearanceConcernDetailId, PredictionFocus>> = {
  FOREHEAD_LINES: {
    category: "expression_lines",
    text: "On this photo, change only the horizontal lines across the forehead. Make those lines clearly less noticeable beside the original, and leave the brows, eyes, and every other feature unchanged.",
  },
  FROWN_LINES: {
    category: "expression_lines",
    text: "On this photo, change only the vertical lines between the eyebrows. Make those lines clearly less noticeable beside the original, and leave the brows in the same position.",
  },
  EYE_AREA_LINES: {
    category: "expression_lines",
    text: "On this photo, change only the lines at the outer corners of the eyes. Make those lines clearly less noticeable beside the original, and leave eye shape unchanged.",
  },
  MOUTH_AREA_LINES: {
    category: "expression_lines",
    text: "On this photo, change only the lines around the mouth. Make those lines clearly less noticeable beside the original, and leave lip shape unchanged.",
  },
  GENERAL_EXPRESSION_LINES: {
    category: "expression_lines",
    text: "On this photo, change only the expression lines visible on the forehead and between the brows. Make those lines clearly less noticeable beside the original.",
  },
  JAW_DEFINITION: {
    category: "facial_contour",
    text: "On this photo, change only the jawline edge. Show a clearly cleaner jaw contour beside the original, and leave the lips, chin width, and identity unchanged.",
  },
  CHEEK_DEFINITION: {
    category: "facial_contour",
    text: "On this photo, change only the cheek contour. Show a clearly more distinct cheek contour beside the original, and leave the eyes, nose, and jaw width unchanged.",
  },
  LOWER_FACE_DEFINITION: {
    category: "facial_contour",
    text: "On this photo, change only the lower-face contour. Show a clearly more distinct lower-face outline beside the original, and leave the lips and identity unchanged.",
  },
  OVERALL_CONTOUR: {
    category: "facial_contour",
    text: "On this photo, change only the lower-face and jaw contour. Show a clearly more distinct outline beside the original, and leave feature shapes and identity unchanged.",
  },
  CONTOUR_BALANCE: {
    category: "facial_contour",
    text: "On this photo, change only the balance of the lower-face contour. Make that outline clearly more even beside the original, and leave feature shapes unchanged.",
  },
  DARK_LOOKING_UNDER_EYES: {
    category: "under_eye",
    text: "On this photo, change only the dark-looking skin directly under the eyes. Make that darkness clearly lighter beside the original, and leave eye shape unchanged.",
  },
  UNDER_EYE_PUFFINESS: {
    category: "under_eye",
    text: "On this photo, change only the puffy look directly under the eyes. Make that area clearly smoother beside the original, and leave eye shape unchanged.",
  },
  UNDER_EYE_HOLLOW_APPEARANCE: {
    category: "under_eye",
    text: "On this photo, change only the hollow look directly under the eyes. Make that area clearly less sunken beside the original, and leave eye shape unchanged.",
  },
  UNDER_EYE_FINE_LINES: {
    category: "under_eye",
    text: "On this photo, change only the fine lines directly under the eyes. Make those lines clearly less noticeable beside the original, and leave eye shape unchanged.",
  },
  UNDER_EYE_APPEARANCE_GENERAL: {
    category: "under_eye",
    text: "On this photo, change only the skin directly under the eyes. Make that area clearly clearer beside the original, and leave eye shape unchanged.",
  },
  UNEVEN_TEXTURE: {
    category: "skin_appearance",
    text: "On this photo, change only uneven-looking skin texture. Make that texture clearly more even beside the original, and leave facial structure unchanged.",
  },
  ROUGH_LOOKING_SKIN: {
    category: "skin_appearance",
    text: "On this photo, change only rough-looking skin. Make that skin clearly smoother beside the original, and keep natural skin texture rather than a plastic surface.",
  },
  VISIBLE_PORES: {
    category: "skin_appearance",
    text: "On this photo, change only the look of visible pores. Make pores clearly less prominent beside the original, and keep the skin looking real.",
  },
  FINE_LINES: {
    category: "skin_appearance",
    text: "On this photo, change only fine lines in the skin. Make those lines clearly less noticeable beside the original, and leave facial structure unchanged.",
  },
  GENERAL_TEXTURE: {
    category: "skin_appearance",
    text: "On this photo, change only overall skin texture. Make the texture clearly more even beside the original, and leave facial structure unchanged.",
  },
  UNEVEN_TONE: {
    category: "skin_appearance",
    text: "On this photo, change only uneven-looking skin tone. Make the tone clearly more even beside the original, and leave facial structure unchanged.",
  },
  DULL_LOOKING_SKIN: {
    category: "skin_appearance",
    text: "On this photo, change only skin that looks dull. Make that skin clearly clearer beside the original, and leave facial structure and identity unchanged.",
  },
  REDNESS: {
    category: "skin_appearance",
    text: "On this photo, change only visible redness in the skin. Make that redness clearly calmer beside the original, and leave facial structure unchanged.",
  },
  GENERAL_TONE: {
    category: "skin_appearance",
    text: "On this photo, change only overall skin tone. Make the tone clearly more even beside the original, and leave facial structure unchanged.",
  },
  DARK_SPOTS: {
    category: "skin_appearance",
    text: "On this photo, change only dark spots on the skin. Make those spots clearly lighter beside the original, and leave facial structure unchanged.",
  },
  UNEVEN_PIGMENTATION: {
    category: "skin_appearance",
    text: "On this photo, change only uneven-looking skin colour. Make the colour clearly more even beside the original, and leave facial structure unchanged.",
  },
  GENERAL_PIGMENTATION: {
    category: "skin_appearance",
    text: "On this photo, change only the look of skin colour variation. Make that colour clearly more even beside the original, and leave facial structure unchanged.",
  },
  ACTIVE_BLEMISHES: {
    category: "skin_appearance",
    text: "On this photo, change only blemishes that are visible on the skin. Make those blemishes clearly less noticeable beside the original, and leave facial structure unchanged.",
  },
  BLEMISH_MARKS: {
    category: "skin_appearance",
    text: "On this photo, change only marks left on the skin. Make those marks clearly less noticeable beside the original, and leave facial structure unchanged.",
  },
  GENERAL_BLEMISH_CONCERN: {
    category: "skin_appearance",
    text: "On this photo, change only visible blemishes. Make them clearly less noticeable beside the original, and leave facial structure unchanged.",
  },
};

const HAIR_FOCUS: Partial<Record<HairConcern, string>> = {
  hairline: "On this photo, change only the hairline. Show clearly more hair coverage along that hairline beside the original, and keep the existing hair texture, color, and general style.",
  thinning: "On this photo, change only where the scalp shows through the hair. Show clearly more coverage there beside the original, and keep the existing hair texture, color, and general style.",
  scalp: "On this photo, change only visible scalp among the hair. Show clearly more coverage there beside the original, and keep the existing hair texture, color, and general style.",
};

const MAX_FOCUS = 6;

/** Specific places for the categories this plan actually approved. Empty when the person named the area but not a place within it. */
export function buildPredictionFocus(assessment: Assessment, categories: readonly VisualizationCategory[]): PredictionFocus[] {
  const allowed = new Set(categories);
  const out: PredictionFocus[] = [];
  const seen = new Set<string>();
  const add = (category: VisualizationCategory, text: string) => {
    if (!allowed.has(category) || seen.has(text) || out.length >= MAX_FOCUS) return;
    seen.add(text);
    out.push({ category, text });
  };

  for (const detail of assessment.appearanceConcerns.details) {
    if (detail.endsWith("_NOT_SURE")) continue;
    const mapped = DETAIL_FOCUS[detail];
    if (mapped) add(mapped.category, mapped.text);
  }
  for (const concern of assessment.hair.concerns) {
    const text = HAIR_FOCUS[concern];
    if (text) add("hair_appearance", text);
  }
  return out;
}

/** Used when a category was approved but the person did not name a place inside it. */
export const CATEGORY_FOCUS: Record<VisualizationCategory, string> = {
  expression_lines: "On this photo, change only expression lines that are actually visible, starting with the forehead. Make those lines clearly less noticeable beside the original.",
  facial_contour: "On this photo, change only the lower-face contour that is actually visible. Show a clearly more distinct outline beside the original, and leave feature shapes unchanged.",
  jawline_definition: "On this photo, change only the jawline that is actually visible. Show a clearly more distinct jaw edge beside the original, and leave the lips unchanged.",
  under_eye: "On this photo, change only the skin directly under the eyes. Make that area clearly clearer beside the original, and leave eye shape unchanged.",
  skin_appearance: "On this photo, change only the skin concern that is actually visible. Make that skin clearly clearer beside the original, and leave facial structure unchanged.",
  hair_appearance: "On this photo, change only the hairline and where the scalp shows through. Show clearly more coverage there beside the original, and keep the existing hair texture, color, and general style.",
};
