/**
 * The browser's view of the server-side AI provider: it posts the narrow
 * InterpretationInput (never photos, age, gender or body measurements) plus the
 * person's consent state to /api/interpret. It holds no key. Whatever comes
 * back is validated again by interpretWithFallback, and any failure —
 * including "not enabled" — falls back to the local rules.
 */

import { allowsThirdPartyInterpretation } from "./consent.ts";
import type { InterpretationConsent } from "./consent.ts";
import { createLocalRulesProvider } from "./provider.ts";
import type { InterpretationInput, InterpretationProvider, InterpretationResult } from "./types.ts";

const CLIENT_TIMEOUT_MS = 30_000; // longer than the server's own bound, so the server's deterministic fallback arrives first

export function createRemoteInterpretationProvider(consent: InterpretationConsent, fetchImpl: typeof fetch = fetch): InterpretationProvider {
  return {
    id: "remote-ai",
    async interpret(input: InterpretationInput) {
      const response = await fetchImpl("/api/interpret", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ consent, input }),
        signal: AbortSignal.timeout(CLIENT_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`remote interpretation unavailable (${response.status})`);
      const body = (await response.json()) as { result?: InterpretationResult; available?: boolean };
      if (!body.result) throw new Error("remote interpretation is not configured");
      return body.result;
    },
  };
}

/**
 * Which provider the results page uses. The remote (third-party) path needs
 * ALL of: not the demo, the operator's public opt-in flag, and the person's
 * consent. Otherwise: the local deterministic provider, with no network call.
 */
export function chooseInterpretationProvider(opts: { demo: boolean; remoteEnabled: boolean; consent: InterpretationConsent; fetchImpl?: typeof fetch }): InterpretationProvider {
  if (opts.demo || !opts.remoteEnabled || !allowsThirdPartyInterpretation(opts.consent)) return createLocalRulesProvider();
  return createRemoteInterpretationProvider(opts.consent, opts.fetchImpl);
}
