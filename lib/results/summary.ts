/**
 * Pure selection logic for the mobile Results summary (see
 * components/results/ResultsSummary.tsx) — kept out of the component so it's
 * directly testable without a DOM. Reuses ReportView's own data; computes
 * nothing new.
 */

import type { ReportPriorityView, ReportView } from "./reportView.ts";

export const SUMMARY_MAX_PRIORITIES = 3;

/** The top priorities shown in the mobile summary — the same list the full report shows, just capped to the first few. */
export function topPriorities(view: ReportView, max: number = SUMMARY_MAX_PRIORITIES): ReportPriorityView[] {
  return view.priorities.slice(0, max);
}
