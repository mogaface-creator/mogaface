/**
 * The one concrete model call: OpenAI's Responses API (POST /v1/responses)
 * over plain `fetch` — no SDK dependency, so it is fully testable with a
 * stubbed fetch. SERVER-SIDE ONLY: it takes an API key, so it must only ever
 * run inside the interpretation handler (handler.ts). It returns the model's
 * raw JSON text; the caller validates it.
 *
 * Every failure is a ProviderFailure with a content-free reason: no error
 * message ever contains the request, the response body, headers or the key.
 * Requests set `store: false` so OpenAI does not retain the exchange for
 * later retrieval (retention/processing terms are still a product decision).
 */

import { ProviderFailure } from "./provider.ts";
import type { ModelCompletion } from "./provider.ts";
import { REPORT_OUTPUT_SCHEMA } from "./reportSchema.ts";

/**
 * Used only when INTERPRETATION_MODEL is unset. Taken from OpenAI's published
 * model list (the small, high-volume tier) — confirm it during the supervised
 * live call and override with INTERPRETATION_MODEL if needed.
 */
export const DEFAULT_INTERPRETATION_MODEL = "gpt-6-luna";
export const DEFAULT_INTERPRETATION_TIMEOUT_MS = 20_000;
export const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";
/** Room for a full structured report; reasoning tokens (if the model uses them) count toward this too. */
const MAX_OUTPUT_TOKENS = 8000;

export interface OpenAiConfig {
  apiKey: string;
  model?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/** The request body, exposed so tests can assert exactly what is sent. */
export function buildOpenAiRequestBody(model: string, prompt: { system: string; user: string }) {
  return {
    model,
    instructions: prompt.system,
    input: prompt.user,
    text: { format: { type: "json_schema", name: "mogaface_report_wording", strict: true, schema: REPORT_OUTPUT_SCHEMA } },
    max_output_tokens: MAX_OUTPUT_TOKENS,
    store: false,
  };
}

/** Keeps the outermost JSON object, in case a model wraps it in prose or code fences. */
export function extractJsonObject(text: string): string {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) throw new ProviderFailure("malformed_json");
  return text.slice(start, end + 1);
}

interface ResponsesBody {
  status?: string;
  error?: unknown;
  incomplete_details?: { reason?: string } | null;
  output?: { type?: string; content?: { type?: string; text?: string }[] }[];
}

export function createOpenAiCompletion(config: OpenAiConfig): ModelCompletion {
  return async (prompt) => {
    let response: Response;
    try {
      response = await (config.fetchImpl ?? fetch)(OPENAI_RESPONSES_URL, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify(buildOpenAiRequestBody(config.model || DEFAULT_INTERPRETATION_MODEL, prompt)),
        signal: AbortSignal.timeout(config.timeoutMs ?? DEFAULT_INTERPRETATION_TIMEOUT_MS),
      });
    } catch (e) {
      const name = e instanceof Error ? e.name : "";
      throw new ProviderFailure(name === "TimeoutError" || name === "AbortError" ? "timeout" : "network");
    }
    if (!response.ok) throw new ProviderFailure("provider_error");
    let data: ResponsesBody;
    try {
      data = (await response.json()) as ResponsesBody;
    } catch {
      throw new ProviderFailure("malformed_json");
    }
    if (data.error) throw new ProviderFailure("provider_error");
    if (data.status === "incomplete") throw new ProviderFailure(data.incomplete_details?.reason === "content_filter" ? "provider_refused" : "truncated");
    if (data.status && data.status !== "completed") throw new ProviderFailure("provider_error");
    const parts = (data.output ?? []).filter((item) => item.type === "message").flatMap((item) => item.content ?? []);
    if (parts.some((p) => p.type === "refusal")) throw new ProviderFailure("provider_refused");
    const text = parts.filter((p) => p.type === "output_text" && typeof p.text === "string").map((p) => p.text).join("");
    if (!text) throw new ProviderFailure("malformed_json");
    return extractJsonObject(text);
  };
}
