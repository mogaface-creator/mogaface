/**
 * Interpretation providers.
 *
 * The app is not tied to any AI vendor: it depends only on the
 * InterpretationProvider interface. Two implementations exist:
 *   - localRulesProvider: the deterministic rule-based builder. Always
 *     available, needs no key, no network.
 *   - createAiInterpretationProvider: an ADAPTER STRUCTURE for a future model.
 *     With no `complete` function configured it refuses (ProviderNotConfigured);
 *     it does not fabricate output. No real AI provider is connected or tested.
 *
 * interpretWithFallback is the only entry point the app uses: whatever a
 * provider returns is validated, and an invalid or failed result falls back
 * to the local rules — the assessment never depends on an AI call.
 */

import { buildInterpretation } from "./build.ts";
import type { BuildOptions } from "./build.ts";
import { buildInterpretationPrompt } from "./prompts.ts";
import { validateInterpretation } from "./validate.ts";
import type { InterpretationInput, InterpretationProvider, InterpretationResult } from "./types.ts";

export class ProviderNotConfigured extends Error {}

export function createLocalRulesProvider(options: BuildOptions = {}): InterpretationProvider {
  return { id: "local-rules", interpret: async (input) => buildInterpretation(input, options) };
}

export const localRulesProvider: InterpretationProvider = createLocalRulesProvider();

/** A model call: takes the prompt, returns the model's raw JSON text. Supplied by a future integration — never by this repo. */
export type ModelCompletion = (prompt: { system: string; user: string }) => Promise<string>;

export function createAiInterpretationProvider(config: { id?: string; complete?: ModelCompletion } = {}): InterpretationProvider {
  return {
    id: config.id ?? "ai-adapter",
    async interpret(input) {
      if (!config.complete) throw new ProviderNotConfigured("No AI interpretation provider is configured.");
      const text = await config.complete(buildInterpretationPrompt(input));
      return JSON.parse(text) as InterpretationResult; // shape is checked by validateInterpretation in interpretWithFallback
    },
  };
}

export interface InterpretOutcome {
  result: InterpretationResult;
  /** The provider whose output was used. */
  providerId: string;
  /** Set when the requested provider failed or returned something invalid and the local rules were used instead. */
  fellBackBecause: string | null;
}

export async function interpretWithFallback(
  provider: InterpretationProvider,
  input: InterpretationInput,
  options: BuildOptions = {},
): Promise<InterpretOutcome> {
  const local = createLocalRulesProvider(options);
  if (provider.id !== local.id) {
    try {
      const candidate = await provider.interpret(input);
      const problems = validateInterpretation(candidate, input, { calibrated: options.calibrated });
      if (problems.length === 0) return { result: candidate, providerId: provider.id, fellBackBecause: null };
      return { result: await local.interpret(input), providerId: local.id, fellBackBecause: `invalid output: ${problems[0]}` };
    } catch (e) {
      return { result: await local.interpret(input), providerId: local.id, fellBackBecause: e instanceof Error ? e.message : "provider failed" };
    }
  }
  const result = await local.interpret(input);
  const problems = validateInterpretation(result, input, { calibrated: options.calibrated });
  if (problems.length > 0) throw new Error(`Local interpretation failed its own validation: ${problems[0]}`);
  return { result, providerId: local.id, fellBackBecause: null };
}
