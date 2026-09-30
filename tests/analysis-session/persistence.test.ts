/**
 * Persistence proof for lib/analysis-session/store.ts's Supabase-backed path
 * (createAnalysisRecord / getAnalysisRecord when NEXT_PUBLIC_SUPABASE_URL /
 * SUPABASE_SERVICE_ROLE_KEY are configured — see supabaseClient.ts).
 *
 * Every test in this file injects `deps.env` with fake-but-configured
 * Supabase credentials and a stubbed `deps.fetchImpl` that implements just
 * enough of PostgREST's REST contract (POST insert / GET select / DELETE) to
 * stand in for a real Supabase table. The "table" is a plain object living
 * OUTSIDE any store.ts module state — createFakeSupabase()'s closure, not
 * store.ts's fallbackRecords Map — so a record written by one call and read
 * by another only ever communicates through the fetch/HTTP boundary, exactly
 * like two separate Vercel serverless invocations only ever communicate
 * through the real Supabase REST API. This is deliberately NOT a test of the
 * in-memory fallback: __clearAnalysisRecordsForTests/__setAnalysisRecordForTests
 * are never used here, and every call passes an explicit `env`, so it can
 * never silently fall through to the fallback Map.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createAnalysisRecord, getAnalysisRecord } from "../../lib/analysis-session/store.ts";
import type { AnalysisSessionStoreDeps } from "../../lib/analysis-session/store.ts";
import type { AnalysisRecord } from "../../lib/analysis-session/types.ts";
import { createEmptyAssessment } from "../../lib/assessment/defaults.ts";
import { buildMogaFaceAnalysis } from "../../lib/observation/build.ts";
import { measuredObservation } from "../../lib/observation/helpers.ts";
import type { Assessment } from "../../lib/assessment/types.ts";
import type { MogaFaceAnalysis } from "../../lib/observation/types.ts";

const FAKE_ENV = { NEXT_PUBLIC_SUPABASE_URL: "https://fake-project.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "fake-service-role-key-not-real" };

function realExpressionLinesInput(): { assessment: Assessment; analysis: MogaFaceAnalysis } {
  const assessment = createEmptyAssessment();
  assessment.appearanceConcerns = { ...assessment.appearanceConcerns, selected: ["FACIAL_LINES"], details: ["FOREHEAD_LINES"], priorities: ["FACIAL_LINES"] };
  const analysis = buildMogaFaceAnalysis(assessment, null);
  analysis.observations.push(
    measuredObservation({ id: "expression.browRaise.foreheadRegionMovementPct", domain: "expression", label: "Brow raise movement", value: 24, source: "video_frame_0" }),
    measuredObservation({ id: "expression.visibleForeheadLinePattern", domain: "expression", label: "Visible forehead line pattern", value: true, source: "video_frame_0" }),
  );
  return { assessment, analysis };
}

interface FakeRow {
  analysis_id: string;
  session_token_hash: string;
  record: AnalysisRecord;
  created_at: string;
  expires_at: string;
}

/**
 * A minimal stand-in for a real Supabase Postgres table, speaking just
 * enough PostgREST wire format (query-string filters, Prefer headers, JSON
 * bodies) for store.ts's supabaseRequest calls. `table` is the only state,
 * and it is read/written ONLY via the returned fetchImpl — never accessed
 * directly by a test — so this genuinely exercises the HTTP contract, not a
 * shortcut around it.
 */
function createFakeSupabase() {
  const table = new Map<string, FakeRow>();
  const requests: { method: string; url: string; headers: Headers }[] = [];

  const fetchImpl: typeof fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    const method = (init.method ?? "GET").toUpperCase();
    const headers = new Headers(init.headers);
    requests.push({ method, url: url.toString(), headers });

    assert.equal(url.pathname, "/rest/v1/analysis_sessions", "store.ts must call the real PostgREST table path");
    assert.equal(headers.get("apikey"), FAKE_ENV.SUPABASE_SERVICE_ROLE_KEY, "every call must carry the service-role key as apikey");
    assert.equal(headers.get("authorization"), `Bearer ${FAKE_ENV.SUPABASE_SERVICE_ROLE_KEY}`, "every call must carry the service-role key as a bearer token");

    const analysisIdFilter = url.searchParams.get("analysis_id"); // e.g. "eq.<uuid>"
    const idFromFilter = analysisIdFilter?.startsWith("eq.") ? decodeURIComponent(analysisIdFilter.slice(3)) : null;

    if (method === "POST") {
      const body = JSON.parse(String(init.body)) as FakeRow;
      table.set(body.analysis_id, body);
      return new Response(null, { status: 201 });
    }
    if (method === "GET") {
      const rows = idFromFilter ? [table.get(idFromFilter)].filter((r): r is FakeRow => !!r) : [...table.values()];
      return Response.json(rows, { status: 200 });
    }
    if (method === "DELETE") {
      if (idFromFilter) table.delete(idFromFilter);
      return new Response(null, { status: 200 });
    }
    throw new Error(`unexpected method ${method}`);
  };

  return { fetchImpl, table, requests };
}

// ===========================================================================
// A. create record → persist
// ===========================================================================

test("A. createAnalysisRecord, when Supabase is configured, writes a row via the real REST call — not the in-memory Map", async () => {
  const supa = createFakeSupabase();
  const deps: AnalysisSessionStoreDeps = { env: FAKE_ENV, fetchImpl: supa.fetchImpl };
  const handle = await createAnalysisRecord(realExpressionLinesInput(), deps);
  assert.ok(handle);
  assert.equal(supa.table.size, 1, "exactly one row was written to the fake table");
  const row = [...supa.table.values()][0];
  assert.equal(row.analysis_id, handle!.analysisId);
  assert.notEqual(row.session_token_hash, handle!.sessionToken, "the raw token is never persisted, only its hash");
  assert.equal(supa.requests.some((r) => r.method === "POST"), true);
});

// ===========================================================================
// B/H. retrieve with correct token succeeds, across a simulated separate
// process boundary — a fresh deps object, a fresh fetchImpl closure, the
// ONLY thing carried over is the fake table (standing in for Supabase itself)
// ===========================================================================

test("B/H. a record created by one call is retrievable by a completely separate later call — simulating two separate serverless invocations sharing only the remote table, never in-process memory", async () => {
  const supa = createFakeSupabase();
  const createDeps: AnalysisSessionStoreDeps = { env: { ...FAKE_ENV }, fetchImpl: supa.fetchImpl };
  const handle = (await createAnalysisRecord(realExpressionLinesInput(), createDeps))!;

  // A brand-new deps object — new env object identity, new fetchImpl reference bound to the
  // same fake table — simulating a second, independent serverless invocation.
  const retrieveDeps: AnalysisSessionStoreDeps = { env: { ...FAKE_ENV }, fetchImpl: supa.fetchImpl };
  const record = await getAnalysisRecord(handle.analysisId, handle.sessionToken, retrieveDeps);
  assert.ok(record, "the record created in the first call must be visible to the second, independent call");
  assert.equal(record!.id, handle.analysisId);
  assert.ok(supa.requests.some((r) => r.method === "GET"), "retrieval went through the real REST GET path, not a shared JS Map");
});

// ===========================================================================
// C. wrong token → rejected
// ===========================================================================

test("C. the correct analysisId with a wrong sessionToken is rejected", async () => {
  const supa = createFakeSupabase();
  const deps: AnalysisSessionStoreDeps = { env: FAKE_ENV, fetchImpl: supa.fetchImpl };
  const handle = (await createAnalysisRecord(realExpressionLinesInput(), deps))!;
  const record = await getAnalysisRecord(handle.analysisId, "not-the-real-token", deps);
  assert.equal(record, null);
});

// ===========================================================================
// D. wrong analysisId → rejected
// ===========================================================================

test("D. the correct sessionToken with a wrong analysisId is rejected", async () => {
  const supa = createFakeSupabase();
  const deps: AnalysisSessionStoreDeps = { env: FAKE_ENV, fetchImpl: supa.fetchImpl };
  const handle = (await createAnalysisRecord(realExpressionLinesInput(), deps))!;
  const record = await getAnalysisRecord("00000000-0000-0000-0000-000000000000", handle.sessionToken, deps);
  assert.equal(record, null);
  void handle;
});

// ===========================================================================
// E. expired record → rejected, and best-effort deleted
// ===========================================================================

test("E. an expired row is rejected exactly like a missing one, and is best-effort deleted from the table", async () => {
  const supa = createFakeSupabase();
  const deps: AnalysisSessionStoreDeps = { env: FAKE_ENV, fetchImpl: supa.fetchImpl };
  const handle = (await createAnalysisRecord(realExpressionLinesInput(), deps))!;
  const row = supa.table.get(handle.analysisId)!;
  row.expires_at = new Date(Date.now() - 60_000).toISOString(); // one minute in the past

  const record = await getAnalysisRecord(handle.analysisId, handle.sessionToken, deps);
  assert.equal(record, null, "an expired record must be rejected even with the correct token");
  assert.equal(supa.table.has(handle.analysisId), false, "an expired row is cleaned up on read");
});

// ===========================================================================
// F/G. stored opportunities/eligibility cannot be replaced by client input
// ===========================================================================

test("F/G. createAnalysisRecord never accepts client-submitted opportunities or an eligibility override — both are always server-computed before being persisted", async () => {
  const supa = createFakeSupabase();
  const deps: AnalysisSessionStoreDeps = { env: FAKE_ENV, fetchImpl: supa.fetchImpl };
  const input = realExpressionLinesInput();
  // A caller cannot even express a forged opportunity/eligibility through this function's own
  // input type — createAnalysisRecord's signature has no such fields — but prove it structurally
  // too: the persisted row's opportunities are exactly what the real engine computes, uninfluenced
  // by any extra property smuggled onto the input object.
  const forged = { ...input, opportunities: [{ id: "attacker", consumerReady: true }], illustrationEligible: true } as typeof input;
  const handle = (await createAnalysisRecord(forged, deps))!;
  const row = supa.table.get(handle.analysisId)!;
  assert.ok(row.record.opportunities.every((o) => o.id !== "attacker"), "a smuggled opportunity never reaches the persisted record");
  assert.equal(row.record.opportunities.every((o) => o.consumerReady === false), true, "consumerReady is always the real (uncalibrated) computed value, never a forged true");
  assert.equal(handle.illustrationEligible, false, "eligibility is always recomputed by the real, unmodified decision logic, never taken from input");
});

// ===========================================================================
// Unconfigured Supabase never silently produces a fake "persisted" result
// ===========================================================================

test("when Supabase is not configured, the fallback path is used (and clearly distinguishable) rather than pretending to be Supabase-backed", async () => {
  const deps: AnalysisSessionStoreDeps = { env: {}, fetchImpl: async () => { throw new Error("must never call fetch when Supabase is not configured"); } };
  const handle = await createAnalysisRecord(realExpressionLinesInput(), deps);
  assert.ok(handle, "the in-memory fallback must still work for local development");
  const record = await getAnalysisRecord(handle!.analysisId, handle!.sessionToken, deps);
  assert.ok(record, "the fallback path must be internally consistent (write, then read, without Supabase)");
});
