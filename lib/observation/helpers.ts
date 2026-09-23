/**
 * Observation constructors. Every Observation in this app is built through
 * one of these two functions, so "measured" always pairs with
 * confidence "not_calibrated" and "user_reported" always pairs with
 * confidence "self_reported" — that pairing can't drift domain-by-domain
 * (see validate.ts, which checks this invariant holds).
 */

import { FACIAL_ANALYSIS_METHODOLOGY_VERSION, OBSERVATION_ENGINE_VERSION } from "./versions.ts";
import type { AnalysisDomain, Observation } from "./types.ts";

interface MeasuredInput<T> {
  id: string;
  domain: AnalysisDomain;
  label: string;
  value: T;
  /** e.g. "front" — which photo this value came from. */
  source: string;
}

export function measuredObservation<T>(input: MeasuredInput<T>): Observation<T> {
  return {
    id: input.id,
    domain: input.domain,
    label: input.label,
    type: "measured",
    value: input.value,
    source: input.source,
    confidence: "not_calibrated",
    methodologyVersion: FACIAL_ANALYSIS_METHODOLOGY_VERSION,
    createdAt: new Date().toISOString(),
  };
}

interface UserReportedInput<T> {
  id: string;
  domain: AnalysisDomain;
  label: string;
  value: T;
}

export function userReportedObservation<T>(input: UserReportedInput<T>): Observation<T> {
  return {
    id: input.id,
    domain: input.domain,
    label: input.label,
    type: "user_reported",
    value: input.value,
    source: "user",
    confidence: "self_reported",
    methodologyVersion: OBSERVATION_ENGINE_VERSION,
    createdAt: new Date().toISOString(),
  };
}
