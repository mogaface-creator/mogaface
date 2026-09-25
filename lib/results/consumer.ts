/**
 * The consumer presentation model. A MogaFaceResult is turned into plain,
 * human-readable copy — and NOTHING else: no evidence ids, landmark numbers,
 * symmetry values, thresholds, calibration flags, methodology versions or
 * debug output ever reach this shape. Every string is re-scanned for
 * forbidden language on the way out (defence in depth: the interpretation was
 * already validated), and an offending string is dropped, not shown.
 */

import { findForbiddenLanguage } from "../safety/language.ts";
import { VISUALIZATION_DISCLAIMER } from "../visualization/types.ts";
import type { MogaFaceResult } from "./types.ts";

export interface ConsumerArea {
  title: string;
  body: string;
}

export type ConsumerVisualization =
  | { state: "ready"; beforeUrl: string; afterUrl: string; changes: string[]; label: string; notice: string; isMock: boolean }
  | { state: "unavailable" | "failed"; title: string; body: string };

export interface ConsumerResultView {
  headline: string;
  intro: string;
  summary: string;
  priorities: string[];
  keyObservations: string[];
  /** Areas that may be worth discussing, plus observation-only items. */
  areas: ConsumerArea[];
  /** Goals that were recorded but couldn't be evaluated from the evidence — shown quietly, behind a disclosure. */
  notEstablished: ConsumerArea[];
  visualization: ConsumerVisualization;
  clinicianNote: string;
  limitations: string[];
}

export const CLINICIAN_NOTE =
  "Your results are intended to help you prepare for a consultation. A qualified clinician should assess your face in person and determine which treatments, if any, are appropriate.";

const ALLOW = [VISUALIZATION_DISCLAIMER.label, VISUALIZATION_DISCLAIMER.notice, CLINICIAN_NOTE];
const safe = (s: string) => findForbiddenLanguage(s, ALLOW).length === 0;
const keepSafe = (list: string[]) => [...new Set(list.filter(safe))];

export function toConsumerView(result: MogaFaceResult, beforeUrl: string | null): ConsumerResultView {
  const i = result.interpretation;

  const areas = i.opportunities.filter((o) => o.status !== "insufficient_evidence").map((o) => ({ title: o.title, body: o.statement })).filter((a) => safe(a.title) && safe(a.body));
  const notEstablished = i.opportunities.filter((o) => o.status === "insufficient_evidence").map((o) => ({ title: o.title, body: o.statement })).filter((a) => safe(a.title) && safe(a.body));
  const keyObservations = keepSafe([...i.facialStructure.statements, ...i.eyeArea.statements, ...i.skin.statements].map((s) => s.statement)).filter(
    // The under-eye statement is already an area card; do not say it twice.
    (s) => !areas.some((a) => a.body === s),
  );

  const v = result.visualization;
  const plan = result.visualizationPlan;
  let visualization: ConsumerVisualization;
  if (v.status === "ready" && v.imageUrl && beforeUrl) {
    visualization = {
      state: "ready",
      beforeUrl,
      afterUrl: v.imageUrl,
      changes: keepSafe(plan.changes.map((c) => c.description)),
      label: VISUALIZATION_DISCLAIMER.label,
      notice: VISUALIZATION_DISCLAIMER.notice,
      isMock: v.isMock === true,
    };
  } else if (v.status === "failed") {
    visualization = {
      state: "failed",
      title: "Your assessment is ready",
      body: "We couldn't generate the illustrative visualization this time. Your results below are unaffected.",
    };
  } else if (plan.status === "not_eligible" || v.errorCode === "not_eligible") {
    visualization = {
      state: "unavailable",
      title: "Your assessment is ready",
      body:
        areas.length > 0
          ? "We found useful areas to discuss, but there isn't enough visual evidence to create an illustrative visualization yet."
          : "Your current assessment doesn't provide enough evidence for an illustrative visualization.",
    };
  } else {
    visualization = {
      state: "unavailable",
      title: "Your assessment is ready",
      body: "The illustrative visualization isn't available right now. Your results below are unaffected.",
    };
  }

  return {
    headline: "Your MogaFace assessment",
    intro: "Here's what your assessment highlighted.",
    summary: safe(i.summary.statement) ? i.summary.statement : "Your assessment is ready.",
    priorities: keepSafe(i.priorities.map((p) => p.label)),
    keyObservations,
    areas,
    notEstablished,
    visualization,
    clinicianNote: CLINICIAN_NOTE,
    limitations: keepSafe(result.limitations),
  };
}
