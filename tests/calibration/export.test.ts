import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { EXPORT_KIND, buildSessionsExport, findMediaBytes, serializeSessionsExport } from "../../lib/facial-analysis/calibration/export.ts";
import { emptyExpectations } from "../../lib/facial-analysis/calibration/expectations.ts";
import { createProposal } from "../../lib/facial-analysis/calibration/proposals.ts";
import { createSession, withNotes } from "../../lib/facial-analysis/calibration/session.ts";
import { CALIBRATION_VERSION, VISUAL_OBSERVATIONS_CALIBRATED } from "../../lib/facial-analysis/calibration/status.ts";
import { ANALYSIS_VERSION } from "../../lib/facial-analysis/analysis.ts";
import { OBSERVATION_ENGINE_VERSION } from "../../lib/observation/versions.ts";
import { realSession } from "./sessionFixtures.ts";

const ROOT = new URL("../../", import.meta.url).pathname;
const full = () => realSession("REAL-001", { expectations: { ...emptyExpectations(), lines: { forehead: "clearly", glabellar: null, lateralEye: null }, underEye: "subtle", quality: { front: "usable" } } });
const ok = (input: Parameters<typeof serializeSessionsExport>[0]) => {
  const r = serializeSessionsExport(input);
  assert.ok(r.ok, r.ok ? "" : r.problems.join("; "));
  return r.ok ? r.text : "";
};

test("export contains the structured calibration metadata the brief lists, and the version ids", () => {
  const proposal = createProposal({ thresholdId: "lineContrast.ratio", proposedValue: 1.38, reason: "Repeated false positives across real samples.", evidenceSampleIds: ["REAL-001"] });
  assert.ok(proposal.ok);
  const e = JSON.parse(ok({ sessions: [full()], proposals: proposal.ok ? [proposal.proposal] : [] }));
  assert.equal(e.exportKind, EXPORT_KIND);
  assert.equal(e.calibrationVersion, CALIBRATION_VERSION);
  assert.equal(e.versions.analysisVersion, ANALYSIS_VERSION);
  assert.equal(e.versions.observationEngineVersion, OBSERVATION_ENGINE_VERSION);
  assert.ok(e.versions.videoAnalysisVersion && e.versions.multiPhotoAnalysisVersion);
  const s = e.sessions[0];
  assert.equal(s.sessionId, "REAL-001");
  assert.deepEqual(Object.keys(s.metadata).sort(), ["ageBand", "camera", "glasses", "lighting", "makeup"]);
  assert.equal(s.expectations.lines.forehead, "clearly");
  assert.ok(s.comparison.some((r: { domain: string; result: string }) => r.domain === "lines.forehead" && r.result === "MATCH"));
  assert.ok(s.photos.front.observations.length > 0 && s.photos.front.thresholdDecisions.length > 0);
  assert.ok(s.videoSample.thresholdDecisions.some((d: { id: string }) => d.id === "video.movement.BROW_RAISE"));
  assert.equal(s.photos.front.quality.faceDetected, true);
  assert.equal(typeof e.aggregate.label, "string");
  assert.equal(e.proposals[0].status, "PROPOSED");
  assert.match(e.notice, /no photos or videos/i);
  assert.ok(s.photos.front.observations.every((o: { source: string; id: string }) => o.source && o.id), "every exported observation keeps its provenance");
});

test("export includes threshold decisions with their margins so a reviewer can see why", () => {
  const e = JSON.parse(ok({ sessions: [realSession("REAL-002", { underEyeRatio: 0.84 })] }));
  const d = e.sessions[0].photos.front.thresholdDecisions.find((x: { id: string }) => x.id === "photo.underEyeRatio.right");
  assert.deepEqual([d.value, d.threshold, d.result], [0.84, 0.85, "BORDERLINE_INSUFFICIENT"]);
  assert.ok(d.borderline.clear < 0.85 && d.borderline.fail > 0.85);
  assert.ok(e.sessions[0].report.borderlineCount >= 1);
});

test("raw numeric metrics are OFF by default and only added on request — and even then contain no media", () => {
  const s = full();
  assert.equal(JSON.parse(ok({ sessions: [s] })).sessions[0].photos.front.rawMetrics, undefined);
  const withRaw = JSON.parse(ok({ sessions: [s], includeRaw: true }));
  assert.equal(withRaw.sessions[0].photos.front.rawMetrics.kind, "photo");
  assert.equal(withRaw.sessions[0].videoSample.rawMetrics.kind, "video");
});

test("NO media bytes in exported JSON: no data URLs, blob URLs, base64, file names or media-like fields", () => {
  for (const includeRaw of [false, true]) {
    const text = ok({ sessions: [full(), realSession("REAL-002", { underEyeRatio: 0.84 })], includeRaw });
    assert.deepEqual(findMediaBytes(text), [], `includeRaw=${includeRaw}`);
    assert.ok(!/data:image|data:video|base64|blob:|\.(jpe?g|png|mp4|mov|webm)\b/i.test(text));
    assert.ok(text.length < 400_000, `export stays small (${text.length} bytes)`);
  }
});

test("the media guard detects every kind of leak", () => {
  assert.ok(findMediaBytes(JSON.stringify({ a: "data:image/png;base64,AAAA" })).includes("a data: URL"));
  assert.ok(findMediaBytes(JSON.stringify({ a: "blob:http://localhost/1234" })).includes("a blob: URL"));
  assert.ok(findMediaBytes(JSON.stringify({ a: "A".repeat(400) })).includes("a long base64-like run"));
  assert.ok(findMediaBytes(JSON.stringify({ note: "see front.jpg" })).includes("a media file name"));
  assert.ok(findMediaBytes(JSON.stringify({ nested: [{ imageData: "x" }] })).includes('a "imageData" field'));
  assert.ok(findMediaBytes(JSON.stringify({ file: "x" })).includes('a "file" field'));
  assert.ok(findMediaBytes("not json").includes("text that is not valid JSON"));
  assert.deepEqual(findMediaBytes(JSON.stringify({ ok: "Front photo: usable", n: 0.84 })), []);
});

test("export REFUSES to produce text when media-like content sneaks in (e.g. via free-text notes)", () => {
  for (const note of ["exported from front.jpg", "data:image/jpeg;base64,/9j/4AAQSkZJRg", "blob:http://localhost:3000/abc"]) {
    const r = serializeSessionsExport({ sessions: [withNotes(full(), note)] });
    assert.equal(r.ok, false, note);
    assert.match(!r.ok ? r.problems.join() : "", /Refusing to export/);
  }
});

test("export refuses an invalid session rather than exporting it", () => {
  const bad = { ...full(), sessionId: "jane@example.com" };
  const r = serializeSessionsExport({ sessions: [bad] });
  assert.equal(r.ok, false);
  assert.match(!r.ok ? r.problems.join() : "", /REAL-|jane@example.com/);
  const extra = { ...full(), file: "x" } as never;
  assert.equal(serializeSessionsExport({ sessions: [extra] }).ok, false);
});

test("source descriptions (which could hold a file name) are not part of the export", () => {
  const text = ok({ sessions: [full()] });
  assert.ok(!text.includes("test front") && !text.includes("sourceDescription"));
});

test("an empty session list exports cleanly", () => {
  const e = JSON.parse(ok({ sessions: [] }));
  assert.deepEqual([e.sessions, e.proposals, e.aggregate.samplesEvaluated], [[], [], 0]);
  assert.equal(buildSessionsExport({ sessions: [createSession("REAL-003")] }).sessions[0].videoSample, null);
});

// ---- privacy: nothing real is persisted ----

const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
function sources(dir: string): { file: string; code: string }[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? sources(p) : /\.(ts|tsx)$/.test(n) ? [{ file: p, code: stripComments(readFileSync(p, "utf8")) }] : [];
  });
}

test("privacy (static): calibration code and the dev workbench never use browser storage, IndexedDB, cookies, or the network", () => {
  const files = [...sources(join(ROOT, "lib/facial-analysis/calibration")), ...sources(join(ROOT, "components/dev")), ...sources(join(ROOT, "app/dev"))];
  assert.ok(files.length > 8);
  // API USE, not words: the UI's privacy note legitimately names these in text.
  const banned = /\b(localStorage|sessionStorage|indexedDB|IndexedDB)\s*(\.|\[|\))|window\.(localStorage|sessionStorage|indexedDB)|document\.cookie|caches\.(open|match)|navigator\.storage|\bfetch\s*\(|XMLHttpRequest|sendBeacon|new WebSocket|readAsDataURL|toDataURL/;
  // The scan itself must be meaningful: it flags real API use and ignores prose.
  for (const use of ["localStorage.setItem('k','v')", "window.sessionStorage", "indexedDB.open('x')", "fetch('/upload')", "canvas.toDataURL()", "reader.readAsDataURL(f)"]) assert.match(use, banned, use);
  for (const prose of ["Nothing is stored in localStorage, sessionStorage or IndexedDB, and nothing is uploaded."]) assert.doesNotMatch(prose, banned);
  const offenders = files.filter((f) => banned.test(f.code)).map((f) => f.file.replace(ROOT, ""));
  assert.deepEqual(offenders, []);
});

test("privacy (runtime): building, analysing, comparing and exporting a session never touches storage", () => {
  const calls: string[] = [];
  const spy = { getItem: () => (calls.push("getItem"), null), setItem: () => calls.push("setItem"), removeItem: () => calls.push("removeItem"), clear: () => calls.push("clear"), key: () => null, length: 0 };
  Object.assign(globalThis, { localStorage: spy, sessionStorage: spy, indexedDB: new Proxy({}, { get: () => { calls.push("indexedDB"); return undefined; } }) });
  const s = full();
  serializeSessionsExport({ sessions: [s] });
  assert.deepEqual(calls, []);
  delete (globalThis as Record<string, unknown>).localStorage;
  delete (globalThis as Record<string, unknown>).sessionStorage;
  delete (globalThis as Record<string, unknown>).indexedDB;
});

test("privacy (structural): a session holds only metrics — no File, Blob, typed array or URL anywhere in it", () => {
  const seen: string[] = [];
  const walk = (v: unknown, path: string) => {
    if (typeof v === "string" && /^(blob:|data:)/.test(v)) seen.push(`${path} is a media URL`);
    if (typeof Blob !== "undefined" && v instanceof Blob) seen.push(`${path} is a Blob`);
    if (ArrayBuffer.isView(v) || v instanceof ArrayBuffer) seen.push(`${path} is binary data`);
    if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`);
  };
  walk(full(), "session");
  assert.deepEqual(seen, []);
});

test("the export does not change the calibration status: VISUAL_OBSERVATIONS_CALIBRATED stays false", () => {
  assert.equal(VISUAL_OBSERVATIONS_CALIBRATED, false);
});
