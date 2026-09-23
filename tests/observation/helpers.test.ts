import { test } from "node:test";
import assert from "node:assert/strict";
import { measuredObservation, userReportedObservation } from "../../lib/observation/helpers.ts";
import { FACIAL_ANALYSIS_METHODOLOGY_VERSION, OBSERVATION_ENGINE_VERSION } from "../../lib/observation/versions.ts";

test("measuredObservation is always type=measured with confidence=not_calibrated", () => {
  const obs = measuredObservation({ id: "x", domain: "facial-structure", label: "Face width", value: 0.5, source: "front" });
  assert.equal(obs.type, "measured");
  assert.equal(obs.confidence, "not_calibrated");
  assert.equal(obs.source, "front");
  assert.equal(obs.methodologyVersion, FACIAL_ANALYSIS_METHODOLOGY_VERSION);
  assert.ok(!Number.isNaN(Date.parse(obs.createdAt)));
});

test("userReportedObservation is always type=user_reported with confidence=self_reported, source=user", () => {
  const obs = userReportedObservation({ id: "x", domain: "hair", label: "Hair length", value: "short" });
  assert.equal(obs.type, "user_reported");
  assert.equal(obs.confidence, "self_reported");
  assert.equal(obs.source, "user");
  assert.equal(obs.methodologyVersion, OBSERVATION_ENGINE_VERSION);
});

test("provenance: every constructed observation carries id, domain, label, source, and a parseable createdAt", () => {
  const measured = measuredObservation({ id: "facialStructure.faceWidth", domain: "facial-structure", label: "Face width", value: 0.42, source: "front" });
  const userReported = userReportedObservation({ id: "hair.length", domain: "hair", label: "Hair length", value: "short" });

  for (const obs of [measured, userReported]) {
    assert.ok(obs.id.length > 0);
    assert.ok(obs.domain.length > 0);
    assert.ok(obs.label.length > 0);
    assert.ok(obs.source.length > 0);
    assert.ok(!Number.isNaN(Date.parse(obs.createdAt)));
  }
});
