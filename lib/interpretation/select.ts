/**
 * Chooses the interpretation provider from server-side environment
 * variables. Nothing here is public (no NEXT_PUBLIC_*), and the key never
 * leaves the server.
 *
 *   INTERPRETATION_PROVIDER    unset | "local" → deterministic local rules (no key, no network) — the default
 *                              "openai"        → the OpenAI Responses API (needs OPENAI_API_KEY)
 *                              anything else   → refuses, so the caller falls back to local
 *   OPENAI_API_KEY             the OpenAI credential
 *   INTERPRETATION_MODEL       optional model id (see openai.ts for the default)
 *   INTERPRETATION_TIMEOUT_MS  optional, clamped to 1s–25s (default 20s)
 *
 * To add another vendor later: write a ModelCompletion for it and add a branch
 * here; the adapter, validation, immutability checks and fallback are shared.
 */

import { createOpenAiCompletion, DEFAULT_INTERPRETATION_MODEL, DEFAULT_INTERPRETATION_TIMEOUT_MS } from "./openai.ts";
import { createAiInterpretationProvider, localRulesProvider } from "./provider.ts";
import type { InterpretationProvider } from "./types.ts";

type Env = Record<string, string | undefined>;

export function interpretationTimeoutMs(env: Env): number {
  const n = Number(env.INTERPRETATION_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? Math.min(25_000, Math.max(1_000, Math.round(n))) : DEFAULT_INTERPRETATION_TIMEOUT_MS;
}

/** The model id in use (for logs and requests). */
export function interpretationModel(env: Env): string {
  return env.INTERPRETATION_MODEL?.trim() || DEFAULT_INTERPRETATION_MODEL;
}

/** True only when a third-party provider is switched on AND has a key. The default (unset) is off. */
export function isThirdPartyInterpretationEnabled(env: Env): boolean {
  return env.INTERPRETATION_PROVIDER?.trim().toLowerCase() === "openai" && !!env.OPENAI_API_KEY?.trim();
}

export function selectInterpretationProvider(env: Env, fetchImpl?: typeof fetch): InterpretationProvider {
  const name = env.INTERPRETATION_PROVIDER?.trim().toLowerCase();
  if (!name || name === "local") return localRulesProvider;
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (name === "openai" && apiKey) {
    return createAiInterpretationProvider({
      id: "openai",
      complete: createOpenAiCompletion({ apiKey, model: interpretationModel(env), fetchImpl, timeoutMs: interpretationTimeoutMs(env) }),
    });
  }
  return createAiInterpretationProvider({ id: name }); // unknown provider or no key: throws ProviderNotConfigured
}
