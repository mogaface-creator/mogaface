/**
 * The production-readiness contract of the AI interpretation provider.
 * NO live call is ever made: the model is a stubbed `fetch`.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { buildInterpretation } from "../../lib/interpretation/build.ts";
import { validateInterpretation } from "../../lib/interpretation/validate.ts";
import { DRAFT_MARKER } from "../../lib/interpretation/prompts.ts";
import { createAiInterpretationProvider, interpretWithFallback } from "../../lib/interpretation/provider.ts";
import { findAiReportViolations, introducedClaims } from "../../lib/interpretation/immutable.ts";
import { handleInterpretRequest, MAX_BODY_BYTES } from "../../lib/interpretation/handler.ts";
import type { InterpretHandlerDeps, InterpretLogEntry } from "../../lib/interpretation/handler.ts";
import { createMemoryRateLimiter } from "../../lib/interpretation/access.ts";
import { allowsThirdPartyInterpretation, DEFAULT_INTERPRETATION_CONSENT, INTERPRETATION_CONSENT_STATES } from "../../lib/interpretation/consent.ts";
import { chooseInterpretationProvider } from "../../lib/interpretation/remote.ts";
import { createOpenAiCompletion } from "../../lib/interpretation/openai.ts";
import { isThirdPartyInterpretationEnabled, selectInterpretationProvider } from "../../lib/interpretation/select.ts";
import { buildDemoSnapshot } from "../../lib/results/demo.ts";
import { buildInterpretationInput } from "../../lib/interpretation/build.ts";
import type { InterpretationInput, MogaFaceReport } from "../../lib/interpretation/types.ts";
import { assessmentWith, inputFor } from "../results/fixtures.ts";

const CAL = { calibrated: true };
const KEY = "test-key-do-not-leak-123456";
const DEV = { INTERPRETATION_PROVIDER: "openai", OPENAI_API_KEY: KEY, NODE_ENV: "development" };
const PROD = { ...DEV, NODE_ENV: "production" };
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

/** Real-shaped input from the production functions (gate closed) — has a discussable skin area and rich questionnaire sections. */
const realInput = (): InterpretationInput => {
  const a = assessmentWith({ selected: ["SKIN_TONE", "FACIAL_DEFINITION", "UNDER_EYE"], priorities: ["SKIN_TONE", "FACIAL_DEFINITION"] });
  a.profile = { ageYears: 41, genderPresentation: "female", heightCm: 171, weightKg: 63 };
  a.hair.currentStyle = "my free text hairstyle";
  return inputFor(a).input;
};
/** The synthetic demo (gate open): discussable areas of every kind. */
const demoInput = (): InterpretationInput => {
  const s = buildDemoSnapshot();
  return buildInterpretationInput(s.assessment, s.analysis, s.opportunities);
};

// ---- a stub OpenAI Responses API: the request body in, a chosen response out ----

interface Sent { url: string; headers: Record<string, string>; body: { model: string; instructions: string; input: string; text: unknown; store: boolean } }
interface StubOptions { status?: number; raw?: string; refusal?: boolean; incomplete?: "max_output_tokens" | "content_filter" }
function stubModel(edit: (draft: MogaFaceReport) => void = () => {}, opts: StubOptions = {}) {
  const sent: Sent[] = [];
  const fetchImpl: typeof fetch = async (url, init) => {
    const body = JSON.parse(String(init!.body));
    sent.push({ url: String(url), headers: init!.headers as Record<string, string>, body });
    if (opts.status && opts.status !== 200) return new Response("upstream body with " + KEY, { status: opts.status });
    if (opts.incomplete) return new Response(JSON.stringify({ status: "incomplete", incomplete_details: { reason: opts.incomplete }, output: [] }), { status: 200 });
    if (opts.refusal) return new Response(JSON.stringify({ status: "completed", output: [{ type: "message", content: [{ type: "refusal", refusal: "I can't help with that." }] }] }), { status: 200 });
    const user: string = body.input;
    const draft = JSON.parse(user.slice(user.indexOf(DRAFT_MARKER) + DRAFT_MARKER.length)) as MogaFaceReport;
    edit(draft);
    const text = opts.raw ?? JSON.stringify(draft);
    return new Response(JSON.stringify({ status: "completed", output: [{ type: "reasoning" }, { type: "message", content: [{ type: "output_text", text }] }] }), { status: 200 });
  };
  return { fetchImpl, sent };
}
/** A ModelCompletion that answers through a stub (for provider-level tests that bypass the handler). */
const completeVia = (model: ReturnType<typeof stubModel>) => async (p: { system: string; user: string }) => {
  const res = await model.fetchImpl("x", { body: JSON.stringify({ input: p.user }) });
  return (await res.json()).output.find((o: { type: string }) => o.type === "message").content[0].text as string;
};

function harness(overrides: Partial<InterpretHandlerDeps> = {}, model = stubModel()) {
  const logs: InterpretLogEntry[] = [];
  // each harness gets its own generous limiter, so tests do not share the process-wide development limiter
  const deps: InterpretHandlerDeps = { env: DEV, fetchImpl: model.fetchImpl, logger: (e) => logs.push(e), rateLimiter: createMemoryRateLimiter({ limit: 1000 }), ...overrides };
  const call = async (body: unknown, headers: Record<string, string> = {}) => {
    const res = await handleInterpretRequest(new Request("http://localhost/api/interpret", { method: "POST", headers: { "content-type": "application/json", host: "localhost", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) }), deps);
    const text = await res.text();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { status: res.status, headers: res.headers, text, json: JSON.parse(text) as Record<string, any> };
  };
  return { call, logs, sent: model.sent };
}
const granted = (input: InterpretationInput) => ({ consent: "granted", input });

// ---- 1–2: the provider is off unless explicitly enabled ----

test("1. API key missing → the endpoint answers 'not available' and never calls the model", async () => {
  const h = harness({ env: { INTERPRETATION_PROVIDER: "openai", NODE_ENV: "development" } });
  const r = await h.call(granted(realInput()));
  assert.deepEqual([r.status, r.json], [200, { available: false }]);
  assert.equal(h.sent.length, 0);
  assert.equal(isThirdPartyInterpretationEnabled({ INTERPRETATION_PROVIDER: "openai" }), false);
  assert.equal(h.logs[0].reason, "provider_disabled");
});

test("2. Provider disabled (unset, 'local', or unknown) → 'not available', no model call; the default is local", async () => {
  for (const env of [{ NODE_ENV: "production" }, { INTERPRETATION_PROVIDER: "local", OPENAI_API_KEY: KEY }, { INTERPRETATION_PROVIDER: "mystery", OPENAI_API_KEY: KEY }]) {
    const h = harness({ env });
    const r = await h.call(granted(realInput()));
    assert.deepEqual([r.status, r.json], [200, { available: false }], JSON.stringify(env));
    assert.equal(h.sent.length, 0);
  }
  assert.equal(selectInterpretationProvider({}).id, "local-rules");
  const example = readFileSync(new URL("../../.env.example", import.meta.url), "utf8");
  assert.match(example, /# INTERPRETATION_PROVIDER=\s+# unset or "local"/);
});

// ---- 3: authorization ----

test("3. Unauthorized: production has no authentication yet → refused before consent, body or model; a denying authenticator refuses too", async () => {
  const input = realInput();
  const prod = harness({ env: PROD });
  const r = await prod.call(granted(input));
  assert.deepEqual([r.status, r.json], [401, { error: "unauthorized" }]);
  assert.equal(prod.logs[0].reason, "authentication_not_configured");
  assert.equal(prod.sent.length, 0);

  const denied = harness({ env: PROD, authenticator: async () => null, rateLimiter: createMemoryRateLimiter() });
  assert.equal((await denied.call(granted(input))).status, 401);
  assert.equal(denied.sent.length, 0);

  // authenticated but no shared rate-limit store in production → still refused (fail closed)
  const noLimiter = harness({ env: PROD, authenticator: async () => ({ subject: "user-1" }), rateLimiter: null });
  assert.deepEqual([(await noLimiter.call(granted(input))).status, noLimiter.logs[0].reason], [503, "rate_limiter_not_configured"]);
  assert.equal(noLimiter.sent.length, 0);

  // both supplied → allowed through
  const ok = harness({ env: PROD, authenticator: async () => ({ subject: "user-1" }), rateLimiter: createMemoryRateLimiter() });
  assert.equal((await ok.call(granted(input))).status, 200);
  assert.equal(ok.sent.length, 1);

  const cross = harness();
  assert.equal((await cross.call(granted(input), { origin: "http://evil.example" })).status, 403);
  assert.equal(cross.sent.length, 0);
});

// ---- rate limiting ----

test("rate limiting: over the limit → 429 with Retry-After; the in-memory limiter is per-process and documented as such", async () => {
  let t = 0;
  const limiter = createMemoryRateLimiter({ limit: 2, windowMs: 60_000, now: () => t });
  assert.deepEqual([await limiter.check("a"), await limiter.check("a")].map((d) => d.allowed), [true, true]);
  const third = await limiter.check("a");
  assert.deepEqual([third.allowed, third.retryAfterSeconds], [false, 60]);
  assert.equal((await limiter.check("b")).allowed, true, "keys are independent");
  t = 61_000;
  assert.equal((await limiter.check("a")).allowed, true, "a new window");

  const h = harness({ rateLimiter: createMemoryRateLimiter({ limit: 1 }) });
  const input = realInput();
  assert.equal((await h.call(granted(input))).status, 200);
  const blocked = await h.call(granted(input));
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get("retry-after")) >= 1);
  assert.equal(h.sent.length, 1, "the blocked request never reached the model");
  assert.match(readFileSync(new URL("../../lib/interpretation/access.ts", import.meta.url), "utf8"), /NOT a production\s+\*\s+control/);
});

// ---- 4–5: consent ----

test("4–5. Consent missing, pending, declined or not_required → refused; only 'granted' reaches the model", async () => {
  const input = realInput();
  const h = harness();
  for (const consent of [undefined, "pending", "declined", "not_required", "yes", true, null]) {
    const r = await h.call({ consent, input });
    assert.deepEqual([r.status, r.json.error], [403, "consent_required"], String(consent));
  }
  assert.equal(h.sent.length, 0, "the model was never called");
  assert.equal(DEFAULT_INTERPRETATION_CONSENT, "pending");
  assert.deepEqual(INTERPRETATION_CONSENT_STATES.filter(allowsThirdPartyInterpretation), ["granted"]);
  assert.equal((await h.call(granted(input))).status, 200);
  assert.equal(h.sent.length, 1);
});

test("consent on the browser side: the third-party path needs the operator flag AND consent AND not the demo", () => {
  const remote = (o: Partial<Parameters<typeof chooseInterpretationProvider>[0]>) => chooseInterpretationProvider({ demo: false, remoteEnabled: true, consent: "granted", ...o }).id;
  assert.equal(remote({}), "remote-ai");
  assert.equal(remote({ remoteEnabled: false }), "local-rules");
  assert.equal(remote({ demo: true }), "local-rules");
  for (const consent of ["pending", "declined", "not_required"] as const) assert.equal(remote({ consent }), "local-rules", consent);
});

// ---- 6, 16: a valid AI response ----

test("6 + 16. A successful provider response with valid wording is used — and only the wording changed", async () => {
  const input = demoInput();
  const draft = buildInterpretation(input, CAL);
  const model = stubModel((r) => {
    r.overview.text = "Facial definition is one of the priorities you selected. Your available facial measurements provide some structural context for exploring this goal, and several areas may be worth discussing with your clinician.";
    r.priorities[0].evidence.text = "Your available facial measurements provide some structural context for exploring this goal.";
    r.sections.facialStructure!.statements.reverse(); // ordering within an approved section may change
  });
  const outcome = await interpretWithFallback(createAiInterpretationProvider({ id: "openai", options: CAL, complete: completeVia(model) }), input, CAL);
  assert.equal(outcome.providerId, "openai");
  assert.equal(outcome.fallbackReason, null);
  assert.match(outcome.result.report.overview.text, /^Facial definition is one of the priorities you selected\./);
  assert.deepEqual(validateInterpretation(outcome.result, input, CAL), []);
  // everything except that wording is exactly the deterministic report
  const strip = (r: MogaFaceReport) => JSON.stringify({ ...r, overview: { ...r.overview, text: "" }, priorities: r.priorities.map((p) => ({ ...p, evidence: { ...p.evidence, text: "" } })), sections: { ...r.sections, facialStructure: null } });
  assert.equal(strip(outcome.result.report), strip(draft.report));
  assert.deepEqual(outcome.result.report.sections.hair, draft.report.sections.hair);
  assert.deepEqual(outcome.result.report.limitations, draft.report.limitations);
  assert.deepEqual(outcome.result.opportunities, draft.opportunities);
});

test("6. Through the endpoint: granted + valid wording → 200 from the provider; the deterministic report is untouched elsewhere", async () => {
  const input = realInput();
  const h = harness({}, stubModel((r) => { r.overview.text = "Your assessment indicates two priorities, and the areas below may be worth discussing with your clinician."; }));
  const r = await h.call(granted(input));
  assert.equal(r.status, 200);
  assert.deepEqual([r.json.providerId, r.json.usedFallback, r.json.fallbackReason], ["openai", false, null]);
  assert.match(r.json.result.report.overview.text, /^Your assessment indicates two priorities/);
  assert.deepEqual(r.json.result.report.sections.lifestyle, buildInterpretation(input).report.sections.lifestyle);
  assert.equal(h.logs[0].outcome, "ai");
});

// ---- 7–9, 17: failures fall back to the deterministic report ----

const deterministic = (input: InterpretationInput) => buildInterpretation(input).report;

test("7–9 + 17. Malformed JSON, timeouts, network and provider errors → HTTP 200 with the DETERMINISTIC report, never an error", async () => {
  const input = realInput();
  const expected = deterministic(input);
  const cases: [string, ReturnType<typeof stubModel> | { fetchImpl: typeof fetch; sent: Sent[] }, string][] = [
    ["malformed JSON", stubModel(() => {}, { raw: "not json at all {" }), "malformed_json"],
    ["no JSON object", stubModel(() => {}, { raw: "Sorry, I can't." }), "malformed_json"],
    ["provider 500", stubModel(() => {}, { status: 500 }), "provider_error"],
    ["provider 401", stubModel(() => {}, { status: 401 }), "provider_error"],
    ["provider 429", stubModel(() => {}, { status: 429 }), "provider_error"],
    ["refusal", stubModel(() => {}, { refusal: true }), "provider_refused"],
    ["content filter", stubModel(() => {}, { incomplete: "content_filter" }), "provider_refused"],
    ["truncated", stubModel(() => {}, { incomplete: "max_output_tokens" }), "truncated"],
    ["network error", { sent: [], fetchImpl: async () => { throw new TypeError("fetch failed"); } }, "network"],
    ["abort timeout", { sent: [], fetchImpl: async () => { throw new DOMException("timed out", "TimeoutError"); } }, "timeout"],
  ];
  for (const [name, model, reason] of cases) {
    const h = harness({}, model);
    const r = await h.call(granted(input));
    assert.equal(r.status, 200, name);
    assert.deepEqual([r.json.providerId, r.json.usedFallback, r.json.fallbackReason], ["local-rules", true, reason], name);
    assert.deepEqual(r.json.result.report, expected, `${name}: the deterministic report`);
    assert.deepEqual(validateInterpretation(r.json.result, input), []);
    assert.ok(r.json.result.report.overview.text.length > 0 && r.json.result.report.priorities.length > 0, "never an empty report");
    assert.equal(h.logs[0].outcome, "fallback");
    assert.equal(h.logs[0].reason, reason);
  }
});

test("8. A model that never answers is cut off by the server-side timeout, and the deterministic report is returned", async () => {
  const input = realInput();
  const never: typeof fetch = () => new Promise(() => {}); // ignores the abort signal on purpose: the race must still end
  const h = harness({ timeoutMs: 40 }, { fetchImpl: never, sent: [] });
  const started = Date.now();
  const r = await h.call(granted(input));
  assert.ok(Date.now() - started < 2000, "did not hang");
  assert.deepEqual([r.status, r.json.usedFallback, r.json.fallbackReason, r.json.providerId], [200, true, "timeout", "local-rules"]);
  assert.deepEqual(r.json.result.report, deterministic(input));
  assert.equal(h.logs[0].reason, "timeout");
});

// ---- 10–15: validation and immutability ----

const withDraft = (edit: (r: MogaFaceReport) => void) => async () => {
  const input = demoInput();
  const model = stubModel(edit);
  const provider = createAiInterpretationProvider({ id: "openai", options: CAL, complete: completeVia(model) });
  const outcome = await interpretWithFallback(provider, input, CAL);
  return { input, outcome, draft: buildInterpretation(input, CAL) };
};

const REJECTED: [string, (r: MogaFaceReport) => void, "invalid_output" | "changed_facts"][] = [
  // evidence
  ["adds an evidence reference", (r) => r.priorities[0].why.evidenceRefs.push({ sourceType: "questionnaire", sourceId: "user_reports_facial_lines_concern" }), "changed_facts"],
  ["removes an evidence reference", (r) => r.sections.facialStructure!.statements[0].evidenceRefs.pop(), "changed_facts"],
  ["changes an evidence reference", (r) => (r.priorities[0].evidence.evidenceRefs[0] = { sourceType: "questionnaire", sourceId: "user_reports_skin_tone_concern" }), "changed_facts"],
  ["cites evidence that does not exist", (r) => r.sections.eyeArea!.statements[0].evidenceRefs.push({ sourceType: "visual_observation", sourceId: "eyeArea.madeUp" }), "invalid_output"],
  ["drops every reference", (r) => (r.sections.skin!.statements[0].evidenceRefs = []), "invalid_output"],
  ["changes sourceType", (r) => (r.sections.skin!.statements[0].sourceType = "observed"), "invalid_output"],
  ["changes sourceType to look observed", (r) => (r.overview.sourceType = "user_reported"), "invalid_output"],
  ["changes confidence", (r) => (r.sections.facialStructure!.statements[0].confidence = "complete"), "changed_facts"],
  ["changes a statement id", (r) => (r.overview.id = "report.999"), "changed_facts"],
  // opportunities
  ["changes an opportunity category", (r) => (r.opportunities[0].category = "DERMAL_FILLER"), "invalid_output"],
  ["changes an opportunity status", (r) => (r.opportunities.find((o) => o.status === "discuss")!.status = "insufficient_evidence"), "invalid_output"],
  ["promotes an insufficient area", (r) => { const o = r.opportunities.find((x) => x.status === "insufficient_evidence")!; o.status = "discuss"; }, "invalid_output"],
  ["smuggles a consumerReady field", (r) => ((r.opportunities[0] as unknown as Record<string, unknown>).consumerReady = true), "changed_facts"],
  ["adds a field to a statement", (r) => ((r.overview as unknown as Record<string, unknown>).extra = "x"), "changed_facts"],
  ["changes an opportunity title", (r) => (r.opportunities[0].title = "Botox area"), "invalid_output"],
  ["rewrites 'what the clinician can evaluate'", (r) => (r.opportunities[0].clinicianCanEvaluate = "Whether you should proceed."), "changed_facts"],
  // structure
  ["rewords a limitation", (r) => (r.sections.skin!.statements.find((s) => s.sourceType === "limitation")!.text = "Skin analysis will be available soon."), "changed_facts"],
  ["adds a statement", (r) => r.sections.skin!.statements.push({ ...r.sections.skin!.statements[0], id: "report.new", text: "An extra sentence." }), "changed_facts"],
  ["removes a statement", (r) => r.sections.facialStructure!.statements.pop(), "changed_facts"],
  ["adds a section that has no evidence", (r) => { r.sections.expression = { basis: "observed", statements: [r.overview], howAssessed: null }; }, "changed_facts"],
  ["changes limitations copy", (r) => ((r as unknown as Record<string, unknown>).limitations = ["No limits."]), "changed_facts"],
  // new treatments (14)
  ["introduces a treatment the draft never named", (r) => (r.opportunities.find((o) => o.status === "discuss")!.why.text = "Contouring may be worth discussing with your clinician."), "changed_facts"],
  ["introduces a treatment without an opportunity", (r) => (r.sections.skin!.statements[0].text = "Fillers may help with skin tone."), "invalid_output"],
  ["introduces a procedure word", (r) => (r.overview.text = "Your assessment indicates a procedure may be worth discussing with your clinician."), "changed_facts"],
  // forbidden language (15)
  ["says 'You need Botox'", (r) => (r.overview.text = "You need Botox."), "invalid_output"],
  ["says 'You need filler'", (r) => (r.overview.text = "You need filler for your jaw."), "invalid_output"],
  ["says 'You should get threads'", (r) => (r.overview.text = "You should get threads."), "invalid_output"],
  ["says 'You are a candidate'", (r) => (r.overview.text = "You are a candidate for contouring."), "invalid_output"],
  ["says 'You are suitable for'", (r) => (r.overview.text = "You are suitable for this."), "invalid_output"],
  ["says the face is attractive", (r) => (r.overview.text = "Your face is attractive."), "invalid_output"],
  ["gives a beauty score", (r) => (r.overview.text = "Your beauty score is high."), "invalid_output"],
  ["gives an attractiveness score", (r) => (r.overview.text = "Your attractiveness score is 8."), "invalid_output"],
  ["makes a diagnosis", (r) => (r.sections.skin!.statements[0].text = "This is a diagnosis of a skin condition."), "invalid_output"],
  ["gives a dosage", (r) => (r.overview.text = "A dose of 20 units is typical."), "invalid_output"],
  ["prescribes", (r) => (r.overview.text = "A clinician will prescribe a course."), "invalid_output"],
  ["adds a percentage", (r) => (r.priorities[0].evidence.text = "Your measurements are 92% typical."), "invalid_output"],
  // claims that pass the forbidden list but were not in the draft
  ["adds a number", (r) => (r.priorities[0].evidence.text = "Your available facial measurements give context across 3 views."), "changed_facts"],
  ["invents a medical cause", (r) => (r.sections.eyeArea!.statements[0].text = "Your under-eye appearance is caused by poor sleep."), "changed_facts"],
  ["invents a cause with 'because of'", (r) => (r.overview.text = "This is because of stress."), "changed_facts"],
  ["issues an instruction", (r) => (r.overview.text = "You should discuss this soon."), "changed_facts"],
  ["judges the face", (r) => (r.sections.facialStructure!.statements[0].text = "Your jaw is weak."), "changed_facts"],
  ["promises an outcome", (r) => (r.overview.text = "This will improve your appearance."), "changed_facts"],
  ["adds markup", (r) => (r.overview.text = "**Your** analysis <b>shows</b> a focus."), "changed_facts"],
  ["adds a link", (r) => (r.overview.text = "See https://example.com for more."), "changed_facts"],
  ["grows into an essay", (r) => (r.overview.text = r.overview.text + " " + "Your analysis shows a clear picture of your goals. ".repeat(10)), "changed_facts"],
];

test("10–15. Every attempt to change evidence, opportunities, confidence, treatments or wording rules is rejected → deterministic fallback", async () => {
  for (const [name, edit, reason] of REJECTED) {
    const { input, outcome, draft } = await withDraft(edit)();
    assert.equal(outcome.providerId, "local-rules", name);
    assert.equal(outcome.fallbackReason, reason, `${name}: ${outcome.fellBackBecause}`);
    assert.deepEqual(outcome.result.report, draft.report, `${name}: the deterministic report is what is returned`);
    assert.deepEqual(validateInterpretation(outcome.result, input, CAL), [], name);
  }
});

test("allowed rewording passes: the brief's example, cautious phrasing, and words the draft itself used", async () => {
  const ok: ((r: MogaFaceReport) => void)[] = [
    (r) => (r.priorities[0].evidence.text = "Your available facial measurements provide some structural context for exploring this goal."),
    (r) => (r.overview.text = "Your analysis shows a focus on facial definition, and the areas below may be worth discussing with your clinician."),
    (r) => (r.opportunities.find((o) => o.status === "discuss")!.why.text = "Your goal and the available measurements point here. This may be worth discussing with your clinician."),
    (r) => r.sections.eyeArea!.statements.reverse(),
  ];
  for (const edit of ok) {
    const { outcome } = await withDraft(edit)();
    assert.equal(outcome.fallbackReason, null, String(outcome.fellBackBecause));
    assert.equal(outcome.providerId, "openai");
  }
  const draft = "Because expression-related changes are involved, this may be worth discussing.";
  assert.deepEqual(introducedClaims(draft, "Because expression-related changes are involved, this may be an area worth discussing."), []);
  assert.deepEqual(introducedClaims("A.", "A."), []);
  assert.ok(introducedClaims("A.", "It is caused by stress.").length > 0);
});

test("immutability: findAiReportViolations is exact on an unchanged report and never throws on garbage", () => {
  const { report } = buildInterpretation(demoInput(), CAL);
  assert.deepEqual(findAiReportViolations(report, clone(report)), []);
  for (const junk of [null, undefined, 3, "x", [], {}, { overview: 5, priorities: "x", sections: 4, opportunities: null }]) {
    assert.doesNotThrow(() => findAiReportViolations(report, junk));
    assert.ok(findAiReportViolations(report, junk).length > 0);
  }
});

// ---- 18–20: privacy ----

test("18. Nothing sensitive is in the payload sent to the model: no age, gender, body data, ids, questionnaire-only sections, goals list or values", async () => {
  const input = realInput();
  const draft = buildInterpretation(input);
  const h = harness();
  await h.call(granted(input));
  assert.equal(h.sent.length, 1);
  const payload = h.sent[0].body.input + h.sent[0].body.instructions;
  for (const forbidden of ["ageYears", "\"41\"", "genderPresentation", "\"female\"", "heightCm", "171", "weightKg", "63", "email", "phone", "@", input.assessmentId, "my free text hairstyle", "textured crop", "frontPhoto", "blob:", "data:image", "\"landmarks\"", "methodologyVersion", "createdAt"]) {
    assert.ok(!payload.includes(forbidden), forbidden);
  }
  // questionnaire-only sections were not sent at all (their sentences are absent), only the findings/goal parts were
  for (const key of ["hair", "facialHair", "lifestyle", "style"] as const) for (const s of draft.report.sections[key].statements) assert.ok(!payload.includes(s.text), s.text);
  for (const s of draft.report.limitations) assert.ok(!payload.includes(s), "standing limitations copy is not sent");
  assert.ok(!payload.includes(draft.report.clinicianReview) && !payload.includes(draft.report.cta.supportingText));
  // no raw measurement values: observation values do not appear
  for (const o of input.observations.filter((x) => x.type === "measured" && typeof x.value === "number" && String(x.value).length >= 5)) assert.ok(!payload.includes(String(o.value)), o.id);
  // the assessment id was replaced by a fixed token, and the model's answer is restored to the real id
  assert.ok(payload.includes('"sourceId": "assessment"') || !payload.includes("assessment\""));
  // it does carry what it needs
  assert.ok(payload.includes("Skin tone") && payload.includes("evidenceRefs"));
});

test("18. The assessment id is pseudonymised out and back: an echoed draft round-trips exactly", async () => {
  const noEvidence = buildInterpretationInputFromEmpty();
  const h = harness({}, stubModel(() => {}));
  const r = await h.call(granted(noEvidence));
  assert.equal(r.json.usedFallback, false);
  assert.deepEqual(r.json.result.report, buildInterpretation(noEvidence).report);
  assert.ok(JSON.stringify(r.json.result.report).includes(noEvidence.assessmentId), "the real id is back in the refs");
  assert.ok(!h.sent[0].body.input.includes(noEvidence.assessmentId));
});
function buildInterpretationInputFromEmpty(): InterpretationInput {
  return { assessmentId: "assess-secret-id-777", goals: [], observations: [], opportunities: [], limitations: [] };
}

test("19. No API key reaches the client: only server modules read it, no NEXT_PUBLIC key exists, no response or log contains it", async () => {
  const root = new URL("../../", import.meta.url).pathname;
  const readers: string[] = [];
  const publicVars = new Set<string>();
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (["node_modules", ".next", ".git", "tests", "docs"].includes(name)) continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(name)) {
        const src = readFileSync(p, "utf8");
        if (/OPENAI_API_KEY/.test(src)) readers.push(p.replace(root, ""));
        for (const m of src.matchAll(/NEXT_PUBLIC_[A-Z_]+/g)) publicVars.add(m[0]);
        if (/"use client"/.test(src) || p.includes("/components/")) assert.ok(!/OPENAI_API_KEY|process\.env\.(OPENAI|INTERPRETATION_PROVIDER|INTERPRETATION_MODEL)/.test(src), `client file ${p} must not read the key`);
      }
    }
  };
  walk(root);
  assert.deepEqual(readers.sort(), ["lib/interpretation/select.ts"], "the key is read in exactly one server module (docs/comments aside)");
  assert.ok(![...publicVars].some((v) => /KEY|SECRET|TOKEN/.test(v)), [...publicVars].join());
  const example = readFileSync(join(root, ".env.example"), "utf8");
  assert.ok(!example.includes("NEXT_PUBLIC_OPENAI_API_KEY"));
  assert.ok(!/^[A-Z_]+=./m.test(example.replace(/^#.*$/gm, "")), "no variable has a value");
  assert.ok(!existsSync(join(root, ".env")));
  assert.match(readFileSync(join(root, "app/api/interpret/route.ts"), "utf8"), /handleInterpretRequest\(request, \{ env: process\.env \}\)/);

  // behaviour: no response body, header or log line ever contains the key — success, fallback, or denial
  const input = realInput();
  for (const [deps, model] of [[{}, stubModel()], [{}, stubModel(() => {}, { status: 500 })], [{ env: PROD }, stubModel()]] as const) {
    const h = harness(deps, model);
    const r = await h.call(granted(input));
    assert.ok(!r.text.includes(KEY) && ![...r.headers.values()].some((v) => v.includes(KEY)));
    assert.ok(!JSON.stringify(h.logs).includes(KEY));
  }
  await assert.rejects(() => createOpenAiCompletion({ apiKey: KEY, fetchImpl: async () => { throw new Error("boom " + KEY); } })({ system: "s", user: "u" }), (e: Error) => !e.message.includes(KEY));
});

test("20. No photos are sent to the provider: a body carrying image data is refused before the model, and the input type has no image fields", async () => {
  const input = realInput();
  const h = harness();
  for (const poison of [{ ...input, frontPhoto: { ref: "blob:http://localhost/x" } }, { ...input, note: "data:image/jpeg;base64,AAAA" }, { ...input, landmarks: [{ x: 0.1, y: 0.2 }] }]) {
    const r = await h.call({ consent: "granted", input: poison });
    assert.deepEqual([r.status, r.json.error], [400, "invalid_input"]);
  }
  assert.equal(h.sent.length, 0);
  assert.deepEqual(Object.keys(input).sort(), ["assessmentCreatedAt", "assessmentId", "goals", "limitations", "methodologyVersions", "observations", "opportunities"]);
  const model = stubModel();
  await harness({}, model).call(granted(input));
  assert.ok(!/blob:|data:image|data:video|imageUrl|frontPhoto|"landmarks"/i.test(model.sent[0].body.input));
});

// ---- request hygiene, logging ----

test("the body is bounded and strict: too large → 413, not JSON → 400, extra envelope fields → 400", async () => {
  const input = realInput();
  const h = harness();
  assert.equal((await h.call("x".repeat(MAX_BODY_BYTES + 1))).status, 413);
  assert.equal((await h.call("{not json")).status, 400);
  assert.equal((await h.call({ consent: "granted", input, extra: 1 })).status, 400);
  assert.equal((await h.call({ consent: "granted", input: { assessmentId: "x" } })).status, 400);
  assert.equal(h.sent.length, 0);
});

test("logging is minimal operational metadata only — never the key, payload, answers or model output", async () => {
  const input = realInput();
  const model = stubModel((r) => { r.overview.text = "Model wording marker for the log test."; });
  const h = harness({ requestId: () => "req-1" }, model);
  await h.call(granted(input));
  const bad = harness({}, stubModel((r) => { r.overview.text = "You need Botox."; }));
  await bad.call(granted(input));
  const denied = harness({ env: PROD });
  await denied.call(granted(input));
  const all = [...h.logs, ...bad.logs, ...denied.logs];
  for (const entry of all) {
    assert.deepEqual(Object.keys(entry).filter((k) => !["event", "requestId", "provider", "model", "outcome", "status", "reason", "durationMs"].includes(k)), []);
    assert.ok(typeof entry.durationMs === "number" && entry.requestId.length > 0);
  }
  const text = JSON.stringify(all);
  for (const forbidden of [KEY, "Model wording", "Botox", "Skin tone", "hairstyle", "strength", input.assessmentId, "stubble"]) assert.ok(!text.includes(forbidden), forbidden);
  assert.equal(h.logs[0].requestId, "req-1");
  assert.deepEqual(all.map((e) => e.outcome), ["ai", "fallback", "denied"]);
  assert.match(bad.logs[0].reason ?? "", /changed_facts|invalid_output/);
});

test("demo mode never uses the third-party path, and a real result defaults to the local provider (consent is pending)", () => {
  assert.equal(chooseInterpretationProvider({ demo: true, remoteEnabled: true, consent: "granted" }).id, "local-rules");
  assert.equal(chooseInterpretationProvider({ demo: false, remoteEnabled: true, consent: DEFAULT_INTERPRETATION_CONSENT }).id, "local-rules");
  const src = readFileSync(new URL("../../components/results/ResultsExperience.tsx", import.meta.url), "utf8");
  assert.match(src, /NEXT_PUBLIC_INTERPRETATION_REMOTE === "1"/);
  assert.match(src, /!IS_PRODUCTION && params\.get\("consent"\) === "granted"/);
});
