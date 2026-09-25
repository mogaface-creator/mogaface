/**
 * The presentation model of the MogaFace report. Like toConsumerView it
 * outputs plain copy ONLY — no evidence ids, landmark numbers, thresholds,
 * calibration state, versions or debug data — and re-scans every string for
 * forbidden language on the way out: an offending string is dropped, never
 * shown (a section never goes blank; it falls back to an honest limitation).
 */

import type { ReportSection, ReportStatement, SectionBasis } from "../interpretation/types.ts";
import { consumerVisualization, safe, keepSafe } from "./consumer.ts";
import type { ConsumerVisualization } from "./consumer.ts";
import type { MogaFaceResult } from "./types.ts";

export type StatementKind = "observed" | "reported" | "limitation";

export interface ReportSectionView {
  key: "facialStructure" | "eyeArea" | "expression" | "skin" | "hair" | "facialHair" | "lifestyle" | "style";
  title: string;
  basis: SectionBasis;
  /** How the reader should understand where the content comes from. */
  basisLabel: string;
  statements: { text: string; kind: StatementKind }[];
  howAssessed: string | null;
}

export interface ReportPriorityView {
  number: string;
  concern: string;
  why: string;
  evidence: string;
  status: "discuss" | "observation_only" | "recorded";
  statusLabel: string;
}

export interface ReportAreaView {
  title: string;
  status: "discuss" | "observation_only";
  statusLabel: string;
  why: string;
  evidence: string[];
  clinicianCanEvaluate: string;
}

export interface ReportView {
  cover: { eyebrow: string; title: string; intro: string; dateLabel: string | null; badge: string };
  overview: string;
  priorities: ReportPriorityView[];
  sections: ReportSectionView[];
  areas: ReportAreaView[];
  notEstablished: { title: string; body: string }[];
  visualization: ConsumerVisualization;
  limitations: string[];
  clinicianReview: string;
  cta: { heading: string; supportingText: string };
  footer: { tagline: string; disclaimer: string };
}

const SECTION_TITLES: Record<ReportSectionView["key"], string> = {
  facialStructure: "Facial structure",
  eyeArea: "Eye area",
  expression: "Expression and facial lines",
  skin: "Skin",
  hair: "Hair",
  facialHair: "Facial hair",
  lifestyle: "Lifestyle",
  style: "Style and overall appearance",
};
const BASIS_LABEL: Record<SectionBasis, string> = {
  observed: "MogaFace observed",
  user_reported: "From your assessment",
  not_assessed: "Not assessed",
};
const PRIORITY_STATUS_LABEL = {
  discuss: "May be worth discussing",
  observation_only: "Observation recorded",
  recorded: "Recorded from your answers",
} as const;
const KIND: Record<ReportStatement["sourceType"], StatementKind> = { observed: "observed", opportunity: "observed", user_reported: "reported", limitation: "limitation" };
const NO_EVIDENCE = "No reliable visual evidence was available for this area.";

export const REPORT_FOOTER = {
  tagline: "AI-assisted appearance analysis for consultation preparation.",
  disclaimer: "MogaFace does not provide medical advice. This report should be reviewed by a qualified clinician.",
};

export function formatReportDate(iso: string | undefined): string | null {
  const t = iso ? Date.parse(iso) : Number.NaN;
  return Number.isNaN(t) ? null : new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

export function toReportView(result: MogaFaceResult, beforeUrl: string | null): ReportView {
  const report = result.interpretation.report;

  const sectionView = (key: ReportSectionView["key"], s: ReportSection): ReportSectionView => {
    const statements = s.statements.filter((x) => safe(x.text)).map((x) => ({ text: x.text, kind: KIND[x.sourceType] }));
    return {
      key,
      title: SECTION_TITLES[key],
      basis: statements.length > 0 ? s.basis : "not_assessed",
      basisLabel: BASIS_LABEL[statements.length > 0 ? s.basis : "not_assessed"],
      statements: statements.length > 0 ? statements : [{ text: NO_EVIDENCE, kind: "limitation" }],
      howAssessed: s.howAssessed && safe(s.howAssessed) ? s.howAssessed : null,
    };
  };
  const { sections } = report;
  const sectionViews = [
    sectionView("facialStructure", sections.facialStructure),
    sectionView("eyeArea", sections.eyeArea),
    ...(sections.expression ? [sectionView("expression", sections.expression)] : []),
    sectionView("skin", sections.skin),
    sectionView("hair", sections.hair),
    sectionView("facialHair", sections.facialHair),
    sectionView("lifestyle", sections.lifestyle),
    sectionView("style", sections.style),
  ];

  const priorities = report.priorities
    .filter((p) => safe(p.concern) && safe(p.why.text) && safe(p.evidence.text))
    .map((p, i) => ({
      number: String(i + 1).padStart(2, "0"),
      concern: p.concern,
      why: p.why.text,
      evidence: p.evidence.text,
      status: p.status,
      statusLabel: PRIORITY_STATUS_LABEL[p.status],
    }));

  const areaOk = (o: MogaFaceResult["interpretation"]["report"]["opportunities"][number]) => safe(o.title) && safe(o.why.text) && safe(o.clinicianCanEvaluate);
  const areas: ReportAreaView[] = report.opportunities
    .filter((o) => o.status !== "insufficient_evidence" && areaOk(o))
    .map((o) => ({
      title: o.title,
      status: o.status === "discuss" ? "discuss" : "observation_only",
      statusLabel: o.status === "discuss" ? "May be worth discussing" : "Observation only",
      why: o.why.text,
      evidence: keepSafe(o.evidenceLines),
      clinicianCanEvaluate: o.clinicianCanEvaluate,
    }));
  const notEstablished = report.opportunities.filter((o) => o.status === "insufficient_evidence" && areaOk(o)).map((o) => ({ title: o.title, body: o.why.text }));

  return {
    cover: {
      eyebrow: "MogaFace",
      title: "Your Personalized Appearance Analysis",
      intro:
        "MogaFace analyzed the information and visual evidence you provided to identify observable features, personal priorities, and areas you may want to discuss with your clinician.",
      dateLabel: formatReportDate(result.assessmentCreatedAt),
      badge: "AI-assisted analysis",
    },
    overview: safe(report.overview.text) ? report.overview.text : "Your assessment is ready.",
    priorities,
    sections: sectionViews,
    areas,
    notEstablished,
    visualization: consumerVisualization(result, beforeUrl, areas.length > 0),
    limitations: keepSafe(report.limitations),
    clinicianReview: safe(report.clinicianReview) ? report.clinicianReview : "A qualified clinician should assess you in person.",
    cta: { heading: report.cta.heading, supportingText: report.cta.supportingText },
    footer: REPORT_FOOTER,
  };
}
