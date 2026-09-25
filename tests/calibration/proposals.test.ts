import { test } from "node:test";
import assert from "node:assert/strict";
import { APPROVAL_NOTE, MIN_EVIDENCE_SAMPLES, PROPOSAL_STATUSES, createProposal, decideProposal, validateProposal } from "../../lib/facial-analysis/calibration/proposals.ts";
import { VISUAL_THRESHOLDS } from "../../lib/facial-analysis/calibration/thresholds.ts";
import { CALIBRATION_VERSION, VISUAL_OBSERVATIONS_CALIBRATED } from "../../lib/facial-analysis/calibration/status.ts";
import { LINE_CONTRAST_RATIO_THRESHOLD } from "../../lib/facial-analysis/video/observe.ts";

const base = { thresholdId: "lineContrast.ratio", proposedValue: 1.38, reason: "Repeated false positives across real samples.", evidenceSampleIds: ["REAL-001", "REAL-003", "REAL-005"] };

test("proposal: the brief's example — current 1.30 → proposed 1.38, with reason and evidence, status PROPOSED", () => {
  const r = createProposal(base);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const p = r.proposal;
  assert.deepEqual([p.thresholdId, p.currentValue, p.proposedValue, p.status], ["lineContrast.ratio", 1.3, 1.38, "PROPOSED"]);
  assert.deepEqual(p.evidenceSampleIds, ["REAL-001", "REAL-003", "REAL-005"]);
  assert.equal(p.reason, "Repeated false positives across real samples.");
  assert.deepEqual([p.decidedAt, p.decisionNote], [null, null]);
  assert.equal(p.calibrationVersion, CALIBRATION_VERSION);
  assert.deepEqual(validateProposal(p), []);
  assert.deepEqual([...PROPOSAL_STATUSES], ["PROPOSED", "APPROVED", "REJECTED"]);
});

test("the current value is read from the registry — it cannot be typed in or faked", () => {
  const r = createProposal({ ...base, ...{ currentValue: 99 } } as never);
  assert.equal(r.ok && r.proposal.currentValue, LINE_CONTRAST_RATIO_THRESHOLD);
});

test("proposal validation: unknown threshold, bad value, same value, short reason, missing or invalid evidence", () => {
  const bad = (patch: object): string => { const r = createProposal({ ...base, ...patch }); return r.ok ? "" : r.problems.join(" | "); };
  assert.match(bad({ thresholdId: "made.up" }), /not a registered threshold/);
  for (const v of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, "1.4"]) assert.match(bad({ proposedValue: v }), /positive number/, String(v));
  assert.match(bad({ proposedValue: 1.3 }), /equals the current value/);
  assert.match(bad({ reason: "too short" }), /reason of at least/);
  assert.match(bad({ reason: "   " }), /reason of at least/);
  assert.match(bad({ evidenceSampleIds: [] }), /At least one evidence sample id/);
  assert.match(bad({ evidenceSampleIds: ["jane@example.com"] }), /not a valid anonymous sample id/);
  assert.equal(bad({ evidenceSampleIds: ["REAL-999"] }), ""); // a well-formed id is accepted when no session list is given
  const known = createProposal({ ...base, evidenceSampleIds: ["REAL-001", "REAL-777"] }, { knownSessionIds: ["REAL-001"] });
  assert.equal(known.ok, false);
  assert.match(!known.ok ? known.problems.join() : "", /REAL-777.*not in this session/);
});

test("a proposal based on very few samples carries an overfitting warning, and always the approval caveat", () => {
  const few = createProposal({ ...base, evidenceSampleIds: ["REAL-001"] });
  assert.ok(few.ok && few.proposal.warnings.some((w) => /only 1 sample/.test(w) && /overfitting/.test(w)));
  const enough = createProposal(base);
  assert.ok(enough.ok && !enough.proposal.warnings.some((w) => /only \d/.test(w)));
  assert.equal(MIN_EVIDENCE_SAMPLES, 3);
  assert.ok(enough.ok && enough.proposal.warnings.includes(APPROVAL_NOTE));
  const dup = createProposal({ ...base, evidenceSampleIds: ["REAL-001", "REAL-001", "REAL-001"] });
  assert.ok(dup.ok && dup.proposal.evidenceSampleIds.length === 1 && dup.proposal.warnings.some((w) => /only 1/.test(w)));
});

test("approving or rejecting records a decision only: a note is required and a decided proposal is final", () => {
  const p = (createProposal(base) as { ok: true; proposal: never }).proposal;
  assert.equal(decideProposal(p, "APPROVED", "").ok, false);
  const noNote = decideProposal(p, "APPROVED", "  ");
  assert.equal(noNote.ok, false);
  const ok = decideProposal(p, "APPROVED", "Reviewed REAL-001..005 against the false positives.", () => "2026-01-01T00:00:00.000Z");
  assert.ok(ok.ok);
  if (!ok.ok) return;
  assert.deepEqual([ok.proposal.status, ok.proposal.decidedAt, ok.proposal.decisionNote], ["APPROVED", "2026-01-01T00:00:00.000Z", "Reviewed REAL-001..005 against the false positives."]);
  const again = decideProposal(ok.proposal, "REJECTED", "changed my mind");
  assert.equal(again.ok, false);
  assert.match(!again.ok ? again.problems.join() : "", /already APPROVED/);
  assert.match(validateProposal({ ...ok.proposal, decisionNote: null }).join(), /needs a decision note/);
});

test("NO automatic tuning: creating, approving or rejecting a proposal never changes any threshold or the calibration flag", () => {
  const before = JSON.stringify(VISUAL_THRESHOLDS);
  const ratioBefore = LINE_CONTRAST_RATIO_THRESHOLD;
  const created = createProposal(base);
  assert.ok(created.ok);
  if (!created.ok) return;
  const approved = decideProposal(created.proposal, "APPROVED", "approved for testing");
  assert.ok(approved.ok);
  assert.equal(JSON.stringify(VISUAL_THRESHOLDS), before, "the registry is untouched");
  assert.equal(LINE_CONTRAST_RATIO_THRESHOLD, ratioBefore, "the live constant is untouched");
  assert.equal(VISUAL_THRESHOLDS.find((t) => t.id === "lineContrast.ratio")!.value, 1.3);
  assert.equal(VISUAL_OBSERVATIONS_CALIBRATED, false);
  assert.match(APPROVAL_NOTE, /decision only/);
});

test("proposal validation never throws on malformed input", () => {
  for (const v of [null, undefined, 3, "x", [], {}]) { assert.doesNotThrow(() => validateProposal(v)); assert.ok(validateProposal(v).length > 0); }
});
