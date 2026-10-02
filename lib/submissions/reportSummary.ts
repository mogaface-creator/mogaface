/**
 * Builds the plain-text report summary and detected areas list for the PDF.
 *
 * Uses the existing interpretation engine (local rules, with optional OpenAI
 * rephrasing if configured) to produce human-readable wording from the
 * treatment opportunities stored in the analysis record.
 *
 * This runs server-side inside the job runner — it has access to the full
 * AnalysisRecord, so it can produce a proper personalised summary.
 */

import { buildInterpretationInput } from "../interpretation/build";
import { interpretWithFallback, localRulesProvider, createAiInterpretationProvider } from "../interpretation/provider";
import type { AnalysisRecord } from "../analysis-session/types";

export interface ReportSummaryResult {
  /** 2–4 sentence plain-text overview for the top of the PDF */
  summary: string;
  /** Per-area cards for the body of the PDF */
  areas: { label: string; description: string }[];
}

/**
 * Builds a concise summary paragraph from the first few opportunity descriptions.
 * Falls back to a generic sentence if the interpretation produces nothing.
 */
function buildSummaryText(opportunityDescriptions: string[], name?: string): string {
  const greeting = name ? `Based on ${name.split(" ")[0]}'s` : "Based on your";
  if (opportunityDescriptions.length === 0) {
    return `${greeting} photos and answers, your personalized facial analysis has been completed. A clinician will review your results and reach out to discuss next steps.`;
  }

  const top = opportunityDescriptions.slice(0, 3);
  const areas = top.map((d, i) => {
    // Extract just the first sentence of each description
    const first = d.split(".")[0].trim();
    return i === 0 ? first : first.toLowerCase();
  });

  if (areas.length === 1) {
    return `${greeting} photos and answers, we noticed ${areas[0]}. Your illustrative after image reflects this area. A clinician will review your results and discuss the best approach.`;
  }
  if (areas.length === 2) {
    return `${greeting} photos and answers, we noticed ${areas[0]}, and ${areas[1]}. Your illustrative after image reflects these areas. A clinician will follow up to discuss next steps.`;
  }
  return `${greeting} photos and answers, we noticed ${areas[0]}, ${areas[1]}, and ${areas[2]}. Your illustrative after image reflects these areas. A clinician will review your results and reach out shortly.`;
}

export async function buildReportSummary(record: AnalysisRecord): Promise<ReportSummaryResult> {
  try {
    const input = buildInterpretationInput(record.assessment, record.analysis, record.opportunities);

    // Use OpenAI rephrasing if configured, fall back to local rules
    const env = process.env;
    let provider = localRulesProvider;
    if (env.INTERPRETATION_PROVIDER === "openai" && env.OPENAI_API_KEY && env.INTERPRETATION_MODEL) {
      const { createOpenAiCompletion } = await import("../interpretation/openai");
      const complete = createOpenAiCompletion({
        apiKey: env.OPENAI_API_KEY,
        model: env.INTERPRETATION_MODEL,
        timeoutMs: Number(env.INTERPRETATION_TIMEOUT_MS) || 20_000,
      });
      provider = createAiInterpretationProvider({ complete });
    }

    const { result } = await interpretWithFallback(provider, input, { calibrated: true });

    // Extract opportunity descriptions for the summary paragraph
    const opportunityDescriptions = result.opportunities
      .filter((o) => o.status === "discuss")
      .map((o) => o.statement ?? o.title ?? o.area)
      .filter(Boolean);

    const summary = buildSummaryText(opportunityDescriptions, record.contact?.name);

    // Build per-area cards
    const areas = result.opportunities
      .filter((o) => o.status === "discuss" || o.status === "observation_only")
      .slice(0, 6)
      .map((o) => ({
        label: o.title ?? o.area,
        description: o.statement ?? `${o.title ?? o.area}: this area was identified based on your photos and answers.`,
      }));

    return { summary, areas };
  } catch (err) {
    console.error("[reportSummary] Failed to build summary:", err instanceof Error ? err.message : err);
    return {
      summary: "Your personalized facial analysis has been completed. A clinician will review your results and reach out to discuss next steps.",
      areas: [],
    };
  }
}
