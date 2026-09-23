import { test } from "node:test";
import assert from "node:assert/strict";
import { validateObservation, isValidObservation } from "../../lib/observation/validate.ts";
import { measuredObservation, userReportedObservation } from "../../lib/observation/helpers.ts";

test("a well-formed measured observation has no problems", () => {
  const obs = measuredObservation({ id: "x", domain: "facial-structure", label: "Face width", value: 0.5, source: "front" });
  assert.deepEqual(validateObservation(obs), []);
  assert.equal(isValidObservation(obs), true);
});

test("a well-formed user-reported observation has no problems", () => {
  const obs = userReportedObservation({ id: "x", domain: "style", label: "Current style", value: "casual" });
  assert.deepEqual(validateObservation(obs), []);
});

test("malformed observation: confidence that doesn't match its type is flagged", () => {
  const obs = measuredObservation({ id: "x", domain: "facial-structure", label: "Face width", value: 0.5, source: "front" });
  const corrupted = { ...obs, confidence: "self_reported" as const };
  const problems = validateObservation(corrupted);
  assert.ok(problems.some((p) => p.includes("confidence")));
});

test("malformed observation: NaN value is flagged", () => {
  const obs = measuredObservation({ id: "x", domain: "facial-structure", label: "Face width", value: Number.NaN, source: "front" });
  const problems = validateObservation(obs);
  assert.ok(problems.some((p) => p.includes("non-finite")));
});

test("malformed observation: missing id is flagged", () => {
  const obs = measuredObservation({ id: "x", domain: "facial-structure", label: "Face width", value: 0.5, source: "front" });
  const corrupted = { ...obs, id: "" };
  assert.ok(validateObservation(corrupted).some((p) => p.includes("id")));
});

test("malformed observation: unrecognized domain is flagged", () => {
  const obs = measuredObservation({ id: "x", domain: "facial-structure", label: "Face width", value: 0.5, source: "front" });
  const corrupted = JSON.parse(JSON.stringify({ ...obs, domain: "not-a-real-domain" }));
  assert.ok(validateObservation(corrupted).some((p) => p.includes("domain")));
});

test("malformed observation: invalid createdAt is flagged", () => {
  const obs = measuredObservation({ id: "x", domain: "facial-structure", label: "Face width", value: 0.5, source: "front" });
  const corrupted = { ...obs, createdAt: "not-a-date" };
  assert.ok(validateObservation(corrupted).some((p) => p.includes("createdAt")));
});
