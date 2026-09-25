/**
 * The OpenAI Responses-API provider. No real call is ever made: `fetch` is stubbed.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildInterpretation, buildInterpretationInput } from "../../lib/interpretation/build.ts";
import { buildInterpretationPrompt, DRAFT_MARKER, editableDraft, INTERPRETATION_SYSTEM_PROMPT } from "../../lib/interpretation/prompts.ts";
import { interpretWithFallback } from "../../lib/interpretation/provider.ts";
import { buildOpenAiRequestBody, createOpenAiCompletion, DEFAULT_INTERPRETATION_MODEL, extractJsonObject, OPENAI_RESPONSES_URL } from "../../lib/interpretation/openai.ts";
import { REPORT_OUTPUT_SCHEMA } from "../../lib/interpretation/reportSchema.ts";
import { interpretationModel, interpretationTimeoutMs, isThirdPartyInterpretationEnabled, selectInterpretationProvider } from "../../lib/interpretation/select.ts";
import { handleInterpretRequest } from "../../lib/interpretation/handler.ts";
import type { InterpretLogEntry } from "../../lib/interpretation/handler.ts";
import { createMemoryRateLimiter } from "../../lib/interpretation/access.ts";
import { buildDemoSnapshot } from "../../lib/results/demo.ts";
import type { MogaFaceReport } from "../../lib/interpretation/types.ts";
import { assessmentWith, inputFor } from "../results/fixtures.ts";

const KEY = "sk-test-not-a-real-key-000000000000";
const CAL = { calibrated: true };
const demo = () => {
  const s = buildDemoSnapshot();
  return buildInterpretationInput(s.assessment, s.analysis, s.opportunities);
};
const okBody = (text: string) => JSON.stringify({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text }] }] });
const run = (fetchImpl: typeof fetch) => createOpenAiCompletion({ apiKey: KEY, model: "test-model", fetchImpl })({ system: "S", user: "U" });
const reason = (e: unknown) => (e as Error).message;

// ---- 1, 5: provider selection and model configuration ----

test("OpenAI provider selection: only 'openai' + OPENAI_API_KEY enables it; everything else is local or refuses", async () => {
  assert.equal(selectInterpretationProvider({}).id, "local-rules");
  assert.equal(selectInterpretationProvider({ INTERPRETATION_PROVIDER: "local", OPENAI_API_KEY: KEY }).id, "local-rules");
  assert.equal(selectInterpretationProvider({ INTERPRETATION_PROVIDER: "openai", OPENAI_API_KEY: KEY }).id, "openai");
  assert.equal(selectInterpretationProvider({ INTERPRETATION_PROVIDER: " OpenAI ", OPENAI_API_KEY: KEY }).id, "openai");
  assert.equal(isThirdPartyInterpretationEnabled({ INTERPRETATION_PROVIDER: "openai", OPENAI_API_KEY: KEY }), true);
  for (const env of [{ INTERPRETATION_PROVIDER: "openai" }, { INTERPRETATION_PROVIDER: "openai", OPENAI_API_KEY: "  " }, { OPENAI_API_KEY: KEY }, { INTERPRETATION_PROVIDER: "anthropic", OPENAI_API_KEY: KEY }]) {
    assert.equal(isThirdPartyInterpretationEnabled(env), false, JSON.stringify(env));
  }
  const { input } = inputFor(assessmentWith({ selected: ["SKIN_TONE"] }));
  const refused = await interpretWithFallback(selectInterpretationProvider({ INTERPRETATION_PROVIDER: "openai" }), input);
  assert.deepEqual([refused.providerId, refused.fallbackReason], ["local-rules", "not_configured"]);
});

test("model configuration: INTERPRETATION_MODEL is used as given; the default is one documented constant; the timeout is clamped", () => {
  assert.equal(interpretationModel({ INTERPRETATION_MODEL: " my-model " }), "my-model");
  assert.equal(interpretationModel({}), DEFAULT_INTERPRETATION_MODEL);
  assert.equal(interpretationModel({ INTERPRETATION_MODEL: "  " }), DEFAULT_INTERPRETATION_MODEL);
  assert.equal(interpretationTimeoutMs({}), 20_000);
  assert.equal(interpretationTimeoutMs({ INTERPRETATION_TIMEOUT_MS: "5" }), 1_000);
  assert.equal(interpretationTimeoutMs({ INTERPRETATION_TIMEOUT_MS: "999999" }), 25_000);
  assert.equal(interpretationTimeoutMs({ INTERPRETATION_TIMEOUT_MS: "nope" }), 20_000);
  // the model id appears in exactly one source file besides tests and docs
  const src = readFileSync(new URL("../../lib/interpretation/openai.ts", import.meta.url), "utf8");
  assert.equal(src.match(new RegExp(`"${DEFAULT_INTERPRETATION_MODEL}"`, "g"))?.length, 1);
});

// ---- 2, 6: the request ----

test("OpenAI request: POST /v1/responses with Bearer auth, instructions + input, strict json_schema, store:false, no sampling params", async () => {
  let seen: { url: string; init: RequestInit } | null = null;
  const fetchImpl: typeof fetch = async (url, init) => {
    seen = { url: String(url), init: init! };
    return new Response(okBody('{"ok":true}'), { status: 200 });
  };
  assert.equal(await run(fetchImpl), '{"ok":true}');
  assert.equal(seen!.url, "https://api.openai.com/v1/responses");
  assert.equal(OPENAI_RESPONSES_URL, "https://api.openai.com/v1/responses");
  assert.equal(seen!.init.method, "POST");
  const headers = seen!.init.headers as Record<string, string>;
  assert.equal(headers.authorization, `Bearer ${KEY}`);
  assert.equal(headers["content-type"], "application/json");
  assert.ok(seen!.init.signal instanceof AbortSignal, "a timeout signal is always set");

  const body = JSON.parse(String(seen!.init.body));
  assert.deepEqual(Object.keys(body).sort(), ["input", "instructions", "max_output_tokens", "model", "store", "text"]);
  assert.equal(body.model, "test-model");
  assert.equal(body.instructions, "S");
  assert.equal(body.input, "U");
  assert.equal(body.store, false);
  assert.ok(body.max_output_tokens >= 1000);
  assert.deepEqual(body.text.format, { type: "json_schema", name: "mogaface_report_wording", strict: true, schema: JSON.parse(JSON.stringify(REPORT_OUTPUT_SCHEMA)) });
  for (const absent of ["temperature", "top_p", "tools", "reasoning", "previous_response_id", "user", "metadata"]) assert.ok(!(absent in body), absent);
  assert.deepEqual(buildOpenAiRequestBody("m", { system: "a", user: "b" }).model, "m");
});

test("OpenAI request through the selector: the configured model and the approved prompt are what is sent", async () => {
  const { input } = inputFor(assessmentWith({ selected: ["SKIN_TONE"] }));
  const bodies: { model: string; instructions: string; input: string }[] = [];
  const fetchImpl: typeof fetch = async (_u, init) => {
    const b = JSON.parse(String(init!.body));
    bodies.push(b);
    return new Response(okBody(b.input.slice(b.input.indexOf(DRAFT_MARKER) + DRAFT_MARKER.length)), { status: 200 });
  };
  const outcome = await interpretWithFallback(selectInterpretationProvider({ INTERPRETATION_PROVIDER: "openai", OPENAI_API_KEY: KEY, INTERPRETATION_MODEL: "configured-model" }, fetchImpl), input);
  assert.equal(outcome.providerId, "openai");
  assert.equal(bodies[0].model, "configured-model");
  assert.equal(bodies[0].instructions, INTERPRETATION_SYSTEM_PROMPT);
  assert.ok(bodies[0].input.startsWith(DRAFT_MARKER));
});

// ---- 3–4: the key is server-only ----

test("the OpenAI key is server-only: read by one server module, never in a client file, no NEXT_PUBLIC_OPENAI variable anywhere", () => {
  const root = new URL("../../", import.meta.url);
  const select = readFileSync(new URL("lib/interpretation/select.ts", root), "utf8");
  assert.match(select, /env\.OPENAI_API_KEY/);
  for (const client of ["components/results/ResultsExperience.tsx", "lib/interpretation/remote.ts", "lib/results/pipeline.ts"]) {
    assert.doesNotMatch(readFileSync(new URL(client, root), "utf8"), /OPENAI/i, client);
  }
  const example = readFileSync(new URL(".env.example", root), "utf8");
  assert.doesNotMatch(example, /NEXT_PUBLIC_OPENAI|NEXT_PUBLIC_INTERPRETATION_(API_)?KEY/);
  for (const name of ["OPENAI_API_KEY", "INTERPRETATION_PROVIDER", "INTERPRETATION_MODEL"]) assert.ok(example.includes(`# ${name}=`), name);
  assert.doesNotMatch(example, /^[A-Z_]+=./m, "no variable in .env.example has a value");
  assert.doesNotMatch(example, /sk-[A-Za-z0-9_-]{16,}/);
  assert.doesNotMatch(example, /INTERPRETATION_API_KEY|anthropic/i, "the old provider's variables are gone");
});

// ---- 7–10: responses ----

test("OpenAI response parsing: valid structured output (reasoning items ignored, parts joined), and every failure is a content-free reason", async () => {
  const two: typeof fetch = async () => new Response(JSON.stringify({ status: "completed", output: [{ type: "reasoning" }, { type: "message", content: [{ type: "output_text", text: '{"a":' }, { type: "output_text", text: "1}" }] }] }), { status: 200 });
  assert.equal(await run(two), '{"a":1}');
  const fenced: typeof fetch = async () => new Response(okBody('Sure:\n```json\n{"a":1}\n```'), { status: 200 });
  assert.equal(await run(fenced), '{"a":1}');

  const cases: [string, Response, string][] = [
    ["HTTP 401", new Response(`bad key ${KEY}`, { status: 401 }), "provider_error"],
    ["HTTP 429", new Response("{}", { status: 429 }), "provider_error"],
    ["HTTP 500", new Response("{}", { status: 500 }), "provider_error"],
    ["error field", new Response(JSON.stringify({ status: "failed", error: { message: `oops ${KEY}` } }), { status: 200 }), "provider_error"],
    ["failed status", new Response(JSON.stringify({ status: "failed", output: [] }), { status: 200 }), "provider_error"],
    ["refusal", new Response(JSON.stringify({ status: "completed", output: [{ type: "message", content: [{ type: "refusal", refusal: "No." }] }] }), { status: 200 }), "provider_refused"],
    ["content filter", new Response(JSON.stringify({ status: "incomplete", incomplete_details: { reason: "content_filter" } }), { status: 200 }), "provider_refused"],
    ["incomplete (max tokens)", new Response(JSON.stringify({ status: "incomplete", incomplete_details: { reason: "max_output_tokens" }, output: [] }), { status: 200 }), "truncated"],
    ["no output text", new Response(JSON.stringify({ status: "completed", output: [{ type: "message", content: [] }] }), { status: 200 }), "malformed_json"],
    ["no output at all", new Response(JSON.stringify({ status: "completed" }), { status: 200 }), "malformed_json"],
    ["not JSON body", new Response("<html>", { status: 200 }), "malformed_json"],
    ["text without an object", new Response(okBody("I cannot do that."), { status: 200 }), "malformed_json"],
  ];
  for (const [name, res, expected] of cases) {
    await assert.rejects(() => run(async () => res.clone()), (e: Error) => reason(e) === expected && !e.message.includes(KEY), name);
  }
  await assert.rejects(() => run(async () => { throw new TypeError(`fetch failed ${KEY}`); }), (e: Error) => reason(e) === "network" && !e.message.includes(KEY));
  await assert.rejects(() => run(async () => { throw new DOMException("t", "TimeoutError"); }), (e: Error) => reason(e) === "timeout");
  assert.throws(() => extractJsonObject("nothing"), (e: Error) => reason(e) === "malformed_json");
});

// ---- the strict schema ----

/** A minimal JSON-Schema check for the subset the strict schema uses (type, enum, properties, required, additionalProperties, items, anyOf). */
function conforms(value: unknown, schema: Record<string, unknown>, path = "$"): string[] {
  if (Array.isArray(schema.anyOf)) return (schema.anyOf as Record<string, unknown>[]).some((s) => conforms(value, s, path).length === 0) ? [] : [`${path}: matches no anyOf branch`];
  const types = ([] as unknown[]).concat(schema.type);
  const kind = value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
  if (!types.includes(kind)) return [`${path}: expected ${types.join("|")}, got ${kind}`];
  if (schema.enum && !(schema.enum as unknown[]).includes(value)) return [`${path}: ${String(value)} not in enum`];
  const out: string[] = [];
  if (kind === "object") {
    const props = schema.properties as Record<string, Record<string, unknown>>;
    for (const k of schema.required as string[]) if (!(k in (value as object))) out.push(`${path}.${k}: missing`);
    for (const [k, v] of Object.entries(value as object)) {
      if (!props[k]) out.push(`${path}.${k}: not allowed (additionalProperties)`);
      else out.push(...conforms(v, props[k], `${path}.${k}`));
    }
  }
  if (kind === "array") (value as unknown[]).forEach((v, i) => out.push(...conforms(v, schema.items as Record<string, unknown>, `${path}[${i}]`)));
  return out;
}
/** Strict mode: every object lists all its properties as required and forbids extras. */
function strictProblems(schema: unknown, path = "$"): string[] {
  if (Array.isArray(schema)) return schema.flatMap((s, i) => strictProblems(s, `${path}[${i}]`));
  if (!schema || typeof schema !== "object") return [];
  const s = schema as Record<string, unknown>;
  const out: string[] = [];
  if (s.type === "object") {
    if (s.additionalProperties !== false) out.push(`${path}: additionalProperties must be false`);
    if (JSON.stringify([...(s.required as string[])].sort()) !== JSON.stringify(Object.keys(s.properties as object).sort())) out.push(`${path}: every property must be required`);
  }
  for (const [k, v] of Object.entries(s)) out.push(...strictProblems(v, `${path}.${k}`));
  return out;
}

test("the output schema is valid for OpenAI strict mode, and every real editable draft conforms to it", () => {
  assert.deepEqual(strictProblems(REPORT_OUTPUT_SCHEMA), []);
  const real = inputFor(assessmentWith({ selected: ["SKIN_TONE", "FACIAL_DEFINITION", "UNDER_EYE"] })).input; // no expression section → null
  const rich = demo(); // expression section present
  for (const [name, input, opts] of [["real", real, {}], ["demo", rich, CAL]] as const) {
    const report = buildInterpretation(input, opts).report;
    assert.deepEqual(conforms(editableDraft(report, input.assessmentId), REPORT_OUTPUT_SCHEMA as unknown as Record<string, unknown>), [], name);
  }
  assert.ok(conforms({ overview: {} }, REPORT_OUTPUT_SCHEMA as unknown as Record<string, unknown>).length > 0, "the checker itself rejects a wrong shape");
});

// ---- 11–18: a model that returns the right shape but wrong content is still rejected ----

/** Runs a stub OpenAI that edits the draft it was sent. Uses the REAL calibration gate (closed), so the selector's own draft is the reference. */
const bad = async (edit: (r: MogaFaceReport) => void) => {
  const input = inputFor(assessmentWith({ selected: ["SKIN_TONE", "FACIAL_DEFINITION", "UNDER_EYE"], priorities: ["SKIN_TONE", "FACIAL_DEFINITION"] })).input;
  const fetchImpl: typeof fetch = async (_u, init) => {
    const user: string = JSON.parse(String(init!.body)).input;
    const draft = JSON.parse(user.slice(user.indexOf(DRAFT_MARKER) + DRAFT_MARKER.length)) as MogaFaceReport;
    edit(draft);
    return new Response(okBody(JSON.stringify(draft)), { status: 200 });
  };
  const provider = selectInterpretationProvider({ INTERPRETATION_PROVIDER: "openai", OPENAI_API_KEY: KEY }, fetchImpl);
  return { input, outcome: await interpretWithFallback(provider, input), draft: buildInterpretation(input) };
};

test("OpenAI output with changed facts or forbidden wording is rejected and the deterministic report is used", async () => {
  const cases: [string, (r: MogaFaceReport) => void][] = [
    ["invalid evidence reference", (r) => r.priorities[0].why.evidenceRefs.push({ sourceType: "visual_observation", sourceId: "nope.invented" })],
    ["changed evidence reference", (r) => (r.priorities[0].evidence.evidenceRefs[0] = { sourceType: "questionnaire", sourceId: "user_reports_facial_definition_goal" })],
    ["changed opportunity status", (r) => (r.opportunities.find((o) => o.status === "discuss")!.status = "observation_only")],
    ["promoted an insufficient area", (r) => (r.opportunities.find((o) => o.status === "insufficient_evidence")!.status = "discuss")],
    ["changed opportunity category", (r) => (r.opportunities.find((o) => o.status === "discuss")!.category = "DERMAL_FILLER")],
    ["changed confidence", (r) => (r.overview.confidence = "complete")],
    ["smuggled consumerReady", (r) => ((r.opportunities[0] as unknown as Record<string, unknown>).consumerReady = true)],
    ["unsupported treatment", (r) => (r.sections.skin!.statements[0].text = "Fillers may help with skin tone.")],
    ["You need Botox", (r) => (r.overview.text = "You need Botox.")],
    ["You need threads", (r) => (r.overview.text = "You need threads.")],
    ["You should get filler", (r) => (r.overview.text = "You should get filler.")],
    ["You are an ideal candidate", (r) => (r.overview.text = "You are an ideal candidate for this.")],
    ["You are suitable", (r) => (r.overview.text = "You are suitable for contouring.")],
    ["You have a medical condition", (r) => (r.overview.text = "You have a medical condition.")],
    ["Your face is attractive", (r) => (r.overview.text = "Your face is attractive.")],
    ["You are attractive", (r) => (r.overview.text = "You are attractive.")],
    ["beauty score", (r) => (r.overview.text = "Your beauty score is high.")],
    ["attractiveness score", (r) => (r.overview.text = "Your attractiveness score is 8.")],
    ["you will look better", (r) => (r.overview.text = "You will look better.")],
    ["this will improve your appearance", (r) => (r.overview.text = "This will improve your appearance.")],
    ["this will make you younger", (r) => (r.overview.text = "This will make you younger.")],
    ["X% improvement", (r) => (r.overview.text = "Expect a 30% improvement.")],
    ["X% more attractive", (r) => (r.overview.text = "You are 20% more attractive.")],
    ["prescribe", (r) => (r.overview.text = "A clinician will prescribe a plan.")],
    ["dosage", (r) => (r.overview.text = "The dosage is small.")],
    ["invented cause", (r) => (r.sections.eyeArea!.statements[0].text = "Your lack of sleep caused this in the eye area.")],
    ["invented cause (skin)", (r) => (r.sections.skin!.statements[0].text = "Your skin problem is caused by stress.")],
    ["invented number", (r) => (r.priorities[0].evidence.text = "Your available facial measurements give context across 4 views.")],
  ];
  const control = await bad(() => {}); // the plumbing works: an unedited echo of the draft is accepted, so the rejections below are for their own reasons
  assert.equal(control.outcome.providerId, "openai", String(control.outcome.fellBackBecause));
  assert.ok(control.draft.report.opportunities.some((o) => o.status === "discuss"));
  for (const [name, edit] of cases) {
    const { input, outcome, draft } = await bad(edit);
    assert.equal(outcome.providerId, "local-rules", name);
    assert.ok(outcome.fallbackReason === "invalid_output" || outcome.fallbackReason === "changed_facts", `${name}: ${outcome.fellBackBecause}`);
    assert.deepEqual(outcome.result.report, draft.report, `${name}: deterministic report`);
    assert.deepEqual(outcome.result.opportunities, draft.opportunities, `${name}: interpretation untouched`);
    assert.ok(input.opportunities.length > 0);
  }
});

test("an approved, valid rewording from the model is accepted end to end", async () => {
  const { outcome, draft } = await bad((r) => {
    r.priorities[0].evidence.text = "Your available facial measurements provide some structural context for exploring this goal.";
    r.overview.text = "Your assessment identifies a more defined appearance as a priority, and several areas may be worth discussing with your clinician.";
  });
  assert.equal(outcome.providerId, "openai", String(outcome.fellBackBecause));
  assert.match(outcome.result.report.priorities[0].evidence.text, /^Your available facial measurements provide some structural context/);
  assert.deepEqual(outcome.result.report.opportunities, draft.report.opportunities);
  assert.deepEqual(outcome.result.report.limitations, draft.report.limitations);
});

// ---- the endpoint with OpenAI: fallback, logging, and the privacy of the request ----

test("endpoint with OpenAI: an API failure returns the deterministic report (HTTP 200); logs carry the model but never the key or content", async () => {
  const input = inputFor(assessmentWith({ selected: ["SKIN_TONE", "FACIAL_DEFINITION"], priorities: ["SKIN_TONE"] })).input;
  input.observations.push(...[]); // real-shaped input, untouched
  const logs: InterpretLogEntry[] = [];
  const sent: string[] = [];
  const deps = {
    env: { INTERPRETATION_PROVIDER: "openai", OPENAI_API_KEY: KEY, INTERPRETATION_MODEL: "configured-model", NODE_ENV: "development" },
    fetchImpl: (async (_u: unknown, init: RequestInit) => { sent.push(String(init.body)); return new Response("{}", { status: 503 }); }) as typeof fetch,
    logger: (e: InterpretLogEntry) => logs.push(e),
    rateLimiter: createMemoryRateLimiter({ limit: 100 }),
  };
  const res = await handleInterpretRequest(new Request("http://localhost/api/interpret", { method: "POST", headers: { host: "localhost", "content-type": "application/json" }, body: JSON.stringify({ consent: "granted", input }) }), deps);
  const json = await res.json();
  assert.deepEqual([res.status, json.providerId, json.usedFallback, json.fallbackReason], [200, "local-rules", true, "provider_error"]);
  assert.deepEqual(json.result.report, buildInterpretation(input).report);
  assert.equal(logs[0].model, "configured-model");
  assert.equal(logs[0].provider, "openai");
  assert.ok(!JSON.stringify(logs).includes(KEY) && !JSON.stringify(logs).includes("Skin tone"));
  // what was sent: no assessment id, no PII words, no media
  const body = sent[0];
  for (const forbidden of [input.assessmentId, "ageYears", "genderPresentation", "heightCm", "weightKg", "email", "phone", "accountId", "createdAt", "frontPhoto", "blob:", "data:image", "\"landmarks\""]) assert.ok(!body.includes(forbidden), forbidden);
  const prompt = buildInterpretationPrompt(input, buildInterpretation(input).report);
  assert.ok(!prompt.user.includes(input.assessmentId));
});
