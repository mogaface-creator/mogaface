/**
 * Interpretation providers.
 *
 * The app is not tied to any AI vendor: it depends only on the
 * InterpretationProvider interface. Two implementations exist:
 *   - localRulesProvider: the deterministic rule-based builder. Always
 *     available, needs no key, no network.
 *   - createAiInterpretationProvider: the AI adapter. It is given a model call
 *     (`complete`) — see openai.ts and select.ts, server-side only. With no
 *     `complete` it refuses (ProviderNotConfigured); it never fabricates output.
 *
 * interpretWithFallback is the only entry point the app uses: whatever a
 * provider returns is validated, and an invalid or failed result falls back
 * to the local rules — the assessment never depends on an AI call.
 */

import { buildInterpretation } from "./build.ts";
import type { BuildOptions } from "./build.ts";
import { findAiReportViolations } from "./immutable.ts";
import { buildInterpretationPrompt, restoreAssessmentId } from "./prompts.ts";
import { validateInterpretation } from "./validate.ts";
import type { InterpretationInput, InterpretationProvider, InterpretationResult, MogaFaceReport } from "./types.ts";

export class ProviderNotConfigured extends Error {}

/** Why the deterministic wording was used instead of a provider's. A category only — never any content. */
export type FallbackReason =
  | "not_configured"
  | "timeout"
  | "network"
  | "provider_error"
  | "provider_refused"
  | "truncated"
  | "malformed_json"
  | "invalid_output"
  | "changed_facts";

/** A provider failure with a safe, content-free reason. Its message never includes model output or request data. */
export class ProviderFailure extends Error {
  reason: FallbackReason;
  constructor(reason: FallbackReason) {
    super(reason);
    this.reason = reason;
  }
}

export function createLocalRulesProvider(options: BuildOptions = {}): InterpretationProvider {
  return { id: "local-rules", interpret: async (input) => buildInterpretation(input, options) };
}

export const localRulesProvider: InterpretationProvider = createLocalRulesProvider();

/** A model call: takes the prompt, returns the model's raw JSON text. Supplied by a future integration — never by this repo. */
export type ModelCompletion = (prompt: { system: string; user: string }) => Promise<string>;

export function createAiInterpretationProvider(config: { id?: string; complete?: ModelCompletion; options?: BuildOptions } = {}): InterpretationProvider {
  return {
    id: config.id ?? "ai-adapter",
    async interpret(input) {
      if (!config.complete) throw new ProviderNotConfigured("No AI interpretation provider is configured.");
      // The model rewrites the wording of a deterministic draft; the draft supplies every decision and evidence reference.
      const draft = buildInterpretation(input, config.options);
      let parsed: unknown;
      try {
        parsed = JSON.parse(await config.complete(buildInterpretationPrompt(input, draft.report)));
      } catch (e) {
        throw e instanceof ProviderFailure || e instanceof ProviderNotConfigured ? e : e instanceof SyntaxError ? new ProviderFailure("malformed_json") : e;
      }
      if (!parsed || typeof parsed !== "object") throw new ProviderFailure("malformed_json");
      // A full InterpretationResult (older contract) is taken as is; a report — bare, or under `report` — is merged
      // onto the draft, keeping the draft for anything the model did not return. Either way the result is checked by
      // interpretWithFallback: nothing the model returns is trusted.
      const o = parsed as Record<string, unknown>;
      if ("summary" in o && "report" in o) return parsed as InterpretationResult;
      const returned = restoreAssessmentId(o.report && typeof o.report === "object" ? o.report : o, input.assessmentId) as Partial<MogaFaceReport>;
      // Whatever the model returned is kept (so an attempt to alter limitations, the CTA or any other field is seen and rejected).
      const report: MogaFaceReport = { ...draft.report, ...returned, sections: { ...draft.report.sections, ...(returned.sections ?? {}) } };
      return { ...draft, report };
    },
  };
}

export interface InterpretOutcome {
  result: InterpretationResult;
  /** The provider whose output was used. */
  providerId: string;
  /** Set when the requested provider failed or returned something invalid and the local rules were used instead. */
  fellBackBecause: string | null;
  /** The same fact as a safe category (for logs and metrics). */
  fallbackReason: FallbackReason | null;
}

/** A provider may rephrase; it may never change which areas are "discuss", "observation only" or "insufficient". */
function decisionsChanged(candidate: InterpretationResult, local: InterpretationResult): boolean {
  return (
    candidate.opportunities.length !== local.opportunities.length ||
    candidate.opportunities.some((o, i) => o.area !== local.opportunities[i].area || o.status !== local.opportunities[i].status || o.category !== local.opportunities[i].category)
  );
}

export async function interpretWithFallback(
  provider: InterpretationProvider,
  input: InterpretationInput,
  options: BuildOptions = {},
): Promise<InterpretOutcome> {
  const local = createLocalRulesProvider(options);
  if (provider.id !== local.id) {
    const fallBack = async (fellBackBecause: string, fallbackReason: FallbackReason): Promise<InterpretOutcome> => ({ result: await local.interpret(input), providerId: local.id, fellBackBecause, fallbackReason });
    try {
      const candidate = await provider.interpret(input);
      const draft = await local.interpret(input);
      const problems = validateInterpretation(candidate, input, { calibrated: options.calibrated });
      if (problems.length > 0) return fallBack(`invalid output: ${problems[0]}`, "invalid_output");
      if (decisionsChanged(candidate, draft)) return fallBack("invalid output: the provider changed which areas are supported (area, status or category)", "changed_facts");
      const violations = findAiReportViolations(draft.report, candidate.report);
      if (violations.length > 0) return fallBack(`invalid output: ${violations[0]}`, "changed_facts");
      // Only the report's wording can come from a provider: everything else is the deterministic result.
      return { result: { ...draft, report: candidate.report }, providerId: provider.id, fellBackBecause: null, fallbackReason: null };
    } catch (e) {
      if (e instanceof ProviderNotConfigured) return fallBack(e.message, "not_configured");
      if (e instanceof ProviderFailure) return fallBack(`provider failed: ${e.reason}`, e.reason);
      return fallBack(e instanceof Error ? e.message : "provider failed", "provider_error");
    }
  }
  const result = await local.interpret(input);
  const problems = validateInterpretation(result, input, { calibrated: options.calibrated });
  if (problems.length > 0) throw new Error(`Local interpretation failed its own validation: ${problems[0]}`);
  return { result, providerId: local.id, fellBackBecause: null, fallbackReason: null };
}
