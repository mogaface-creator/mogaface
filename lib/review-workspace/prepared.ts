import { parseDetailedReview, type DetailedReview } from "./types.ts";

const marker = "\n[DETAILED_REPORT_V1]\n";

/** Keep the legacy preview summary readable and persist the private report in the same submission row. */
export function readPreparedReport(value: string | null) {
  const raw = value || "";
  const index = raw.indexOf(marker);
  const summary = index < 0 ? raw : raw.slice(0, index);
  let reportKey: string | null = null;
  let review: DetailedReview | null = null;
  if (index >= 0) {
    try {
      const payload = JSON.parse(raw.slice(index + marker.length));
      review = parseDetailedReview(payload?.review ?? payload, true);
      if (review && typeof payload?.reportKey === "string" && /^[a-f0-9]{64}$/.test(payload.reportKey)) reportKey = payload.reportKey;
    } catch { /* An invalid payload can be retried as a missing review. */ }
  }
  return { summary, review, reportKey, prepared: index >= 0 };
}

export function storePreparedReport(summary: string, review: DetailedReview | null, reportKey: string | null = null) {
  return summary + marker + JSON.stringify({ review, reportKey });
}

export function previewState(summary: string) {
  return /\[PREVIEW_STATUS:([^\]]+)\]/.exec(summary)?.[1] || "";
}
