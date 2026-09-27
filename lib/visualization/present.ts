/**
 * Turns an approved VisualizationChange into what the report (and the
 * dev-only composite test) actually show a person: an area name, a plain
 * description of what was illustrated, and — only where a real treatment
 * family applies — its label. Never a suitability, need, or guarantee claim;
 * see VISUALIZATION_CATEGORY_LABELS/VISUALIZATION_CATEGORY_TREATMENT_CATEGORY
 * (types.ts) for where the two pieces of text come from.
 */

import { TREATMENT_CATEGORY_DEFINITIONS } from "../treatment-opportunities/categories.ts";
import { VISUALIZATION_CATEGORY_LABELS, VISUALIZATION_CATEGORY_TREATMENT_CATEGORY } from "./types.ts";
import type { VisualizationChange } from "./types.ts";

export interface VisualizedArea {
  /** Short area name for a card heading, e.g. "Expression lines". */
  area: string;
  /** What was visually illustrated, in consumer-safe wording. */
  description: string;
  /** A neutral treatment-family name (e.g. "Neuromodulator") to discuss with a clinician — never a suitability or need claim. */
  treatmentFamily: string | null;
}

export function visualizedAreaFor(change: VisualizationChange): VisualizedArea {
  const treatmentCategory = VISUALIZATION_CATEGORY_TREATMENT_CATEGORY[change.category];
  return {
    area: VISUALIZATION_CATEGORY_LABELS[change.category],
    description: change.description,
    treatmentFamily: treatmentCategory ? TREATMENT_CATEGORY_DEFINITIONS[treatmentCategory].label : null,
  };
}
