import { createHash, createHmac } from "node:crypto";
import type { AnalysisRecord } from "../analysis-session/types.ts";
import { expressionContext } from "../observation/expressionContext.ts";
import { prepareReportDisplay } from "./display.server.ts";
import { exportReviewHtml, type ExportVersion } from "./export.ts";
import { savePublishedReport } from "./published.ts";
import type { DetailedReview } from "./types.ts";

type ReportPhoto = { base64: string; mime: string };

export async function publishBaselineReport(
  submissionId: string,
  record: AnalysisRecord,
  review: DetailedReview,
  original: ReportPhoto,
  after: ReportPhoto | null,
  signal?: AbortSignal,
): Promise<string> {
  const secret = process.env.REVIEW_REVISION_SECRET?.trim() || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!secret) throw new Error("report_storage_unavailable");

  // Retries of the same snapshot reuse its URL. Changed results receive a new URL.
  const digest = createHash("sha256").update(JSON.stringify([review, after?.mime, after?.base64])).digest("hex");
  const key = createHmac("sha256", secret).update(`report-v1:${submissionId}:${digest}`).digest("hex");
  const versions: ExportVersion[] = after ? [{
    image: { ...after, receipt: "" },
    label: "First AI illustration",
    targets: [],
    notes: "Automatically prepared from your original photo and assessment preferences.",
  }] : [];
  const sidePhotos = record.reportPhotos ? [
    { label: "Left oblique — original", ...record.reportPhotos.leftFortyFive },
    { label: "Right oblique — original", ...record.reportPhotos.rightFortyFive },
  ] : [];
  const display = await prepareReportDisplay(original.base64, record.portraitGeometry);
  const html = exportReviewHtml(record.contact?.name || "Your appearance review", { ...original, receipt: "" },
    review, versions, after ? 0 : -1, { sidePhotos, display, videoSummary: expressionContext(record.analysis.expression).summary });
  return savePublishedReport(html, { key, signal });
}

export function sharedReportPath(key: string) {
  return `/reports/${key}.html#protocol`;
}
