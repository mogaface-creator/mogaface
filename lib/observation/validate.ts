/**
 * Structural validation for Observations built by this app's own domain
 * builders. This isn't a localStorage-style external-data sanitizer (these
 * objects are never persisted/parsed from JSON on their own) — it's an
 * internal consistency check that catches a real bug class: a domain
 * builder that pairs "measured" with the wrong confidence state, forgets a
 * required field, or lets a NaN/Infinity leak into a measured value.
 */

import type { AnalysisDomain, ConfidenceState, Observation, ObservationSourceType } from "./types.ts";

const VALID_DOMAINS: AnalysisDomain[] = [
  "facial-structure",
  "eye-area",
  "hair",
  "facial-hair",
  "skin",
  "lifestyle",
  "style",
];
const VALID_TYPES: ObservationSourceType[] = ["measured", "user_reported", "inferred"];
const EXPECTED_CONFIDENCE: Record<ObservationSourceType, ConfidenceState> = {
  measured: "not_calibrated",
  user_reported: "self_reported",
  inferred: "not_available",
};

/** Returns a list of problems; an empty list means the observation is well-formed. */
export function validateObservation(observation: Observation<unknown>): string[] {
  const problems: string[] = [];

  if (!observation.id || typeof observation.id !== "string") problems.push("id must be a non-empty string");
  if (!observation.label || typeof observation.label !== "string") problems.push("label must be a non-empty string");
  if (!observation.source || typeof observation.source !== "string") problems.push("source must be a non-empty string");
  if (!observation.methodologyVersion || typeof observation.methodologyVersion !== "string") {
    problems.push("methodologyVersion must be a non-empty string");
  }

  if (!VALID_DOMAINS.includes(observation.domain)) {
    problems.push(`domain "${observation.domain}" is not a recognized analysis domain`);
  }

  if (!VALID_TYPES.includes(observation.type)) {
    problems.push(`type "${observation.type}" is not measured, user_reported, or inferred`);
  } else if (observation.confidence !== EXPECTED_CONFIDENCE[observation.type]) {
    problems.push(
      `confidence "${observation.confidence}" does not match type "${observation.type}" (expected "${EXPECTED_CONFIDENCE[observation.type]}")`,
    );
  }

  if (!observation.createdAt || Number.isNaN(Date.parse(observation.createdAt))) {
    problems.push("createdAt must be a valid ISO date string");
  }

  if (typeof observation.value === "number" && !Number.isFinite(observation.value)) {
    problems.push("value is a non-finite number (NaN/Infinity)");
  }

  return problems;
}

export function isValidObservation(observation: Observation<unknown>): boolean {
  return validateObservation(observation).length === 0;
}
