import { parseDetailedReview, type DetailedReview } from "./types.ts";

const marker = "\n[DETAILED_REPORT_V1]\n";

/** Keep the legacy preview summary readable and persist the private report in the same submission row. */
export function readPreparedReport(value: string | null) {
  const raw = value || "";
  const index = raw.indexOf(marker);
  const summary = index < 0 ? raw : raw.slice(0, index);
  let review: DetailedReview | null = null;
  if (index >= 0) {
    try {
      review = parseDetailedReview(JSON.parse(raw.slice(index + marker.length)), true);
    } catch { /* An invalid payload can be retried as a missing review. */ }
  }
  return { summary, review, prepared: index >= 0 };
}

export function storePreparedReport(summary: string, review: DetailedReview | null) {
  return summary + marker + JSON.stringify(review);
}

export function previewState(summary: string) {
  return /\[PREVIEW_STATUS:([^\]]+)\]/.exec(summary)?.[1] || "";
}
