import { test } from "node:test";
import assert from "node:assert/strict";
import { chooseResultSource } from "../../lib/results/source.ts";

test("results source: the most recent of assessment snapshot and /analyze result wins", () => {
  const older = "2026-09-25T10:00:00.000Z";
  const newer = "2026-09-25T10:05:00.000Z";
  assert.equal(chooseResultSource(older, newer), "legacy"); // a fresh /analyze run is not hidden by an old assessment
  assert.equal(chooseResultSource(newer, older), "snapshot");
  assert.equal(chooseResultSource(newer, newer), "snapshot");
});

test("results source: only one present, or neither, or garbage timestamps", () => {
  assert.equal(chooseResultSource("2026-09-25T10:00:00.000Z", null), "snapshot");
  assert.equal(chooseResultSource(null, "2026-09-25T10:00:00.000Z"), "legacy");
  assert.equal(chooseResultSource(null, null), "none");
  assert.equal(chooseResultSource("not a date", null), "none");
  assert.equal(chooseResultSource("not a date", "2026-09-25T10:00:00.000Z"), "legacy");
});
