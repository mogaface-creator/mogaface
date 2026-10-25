"use client";

import { useState } from "react";
import Link from "next/link";
import { BeforeAfterToggle } from "./BeforeAfterToggle";
import { Button } from "@/components/ui/Button";

interface CaseStudy {
  id: string;
  category: "jawline" | "eyes" | "skin" | "all";
  name: string;
  age: string;
  focusArea: string;
  beforeSrc: string;
  afterSrc: string;
  metrics: { label: string; value: string }[];
  clinicalFinding: string;
}

const CASES: CaseStudy[] = [
  {
    id: "case-1",
    category: "eyes",
    name: "Elena R.",
    age: "32",
    focusArea: "Tear Trough & Midface Harmony",
    beforeSrc: "/images/transformations/female_studio_before.webp",
    afterSrc: "/images/transformations/female_studio_after.webp",
    metrics: [
      { label: "Periorbital Volume", value: "+35% Lift" },
      { label: "Tear Trough Shadow", value: "Restored" },
      { label: "Facial Symmetry", value: "96% Index" },
    ],
    clinicalFinding:
      "Tear trough hollowing diminished with subtle anterior cheek volume restoration, establishing natural youthful light reflection.",
  },
  {
    id: "case-2",
    category: "jawline",
    name: "Lucas M.",
    age: "32",
    focusArea: "Mandibular Angle & Jawline Sharpness",
    beforeSrc: "/images/transformations/male_jawline_before.webp",
    afterSrc: "/images/transformations/male_jawline_after.webp",
    metrics: [
      { label: "Jaw-to-Neck Separation", value: "+28% Definition" },
      { label: "Eye Openness", value: "Refreshed" },
      { label: "Submental Fullness", value: "Streamlined" },
    ],
    clinicalFinding:
      "Crisp lower mandibular definition and refined cervical angle, eliminating fatigue signals while preserving authentic masculine character.",
  },
  {
    id: "case-3",
    category: "skin",
    name: "Sofia V.",
    age: "28",
    focusArea: "Midface Contour & Complexion Radiance",
    beforeSrc: "/images/transformations/female_glow_before.webp",
    afterSrc: "/images/transformations/female_glow_after.webp",
    metrics: [
      { label: "Complexion Luminosity", value: "Hydrated Glow" },
      { label: "Cheek Volume Vector", value: "Elevated" },
      { label: "Smile Symmetry", value: "Balanced" },
    ],
    clinicalFinding:
      "Luminous complexion enhancement paired with midface malar contouring, softening nasolabial shadows and elevating everyday charisma.",
  },
  {
    id: "case-4",
    category: "all",
    name: "Marcus D.",
    age: "35",
    focusArea: "Full Facial Balancing & Forehead Architecture",
    beforeSrc: "/images/transformations/male_lifestyle_before.webp",
    afterSrc: "/images/transformations/male_lifestyle_after.webp",
    metrics: [
      { label: "Forehead Line Depth", value: "-45% Softened" },
      { label: "Periorbital Rest", value: "Energized" },
      { label: "Profile Confidence", value: "Elevated" },
    ],
    clinicalFinding:
      "Integrated forehead line relaxation and under-eye hollow restoration, translating tired indoor baseline into an energized, confident clinical projection.",
  },
];

export function TransformationShowcase() {
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const filteredCases =
    activeCategory === "all"
      ? CASES
      : CASES.filter((c) => c.category === activeCategory);

  return (
    <section id="transformations" className="scroll-mt-20 border-t border-slate-200/80 bg-slate-50/50 py-16 sm:py-24 lg:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Section Header */}
        <div className="max-w-2xl">
          <p className="eyebrow text-xs">Clinical Visualizations</p>
          <h2 className="mt-3 font-serif text-3xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-tight text-slate-900 text-balance">
            Targeted clinical changes,
            <span className="mt-1 block font-light italic text-violet-700">across real facial anatomies.</span>
          </h2>
          <div aria-hidden className="mt-4 sm:mt-6 h-1 w-12 bg-violet-600 rounded-full" />
          <p className="mt-4 sm:mt-6 text-sm sm:text-base leading-6 sm:leading-7 text-slate-600">
            Every simulation is produced by our clinical AI engine — respecting authentic bone structure,
            individual ethnic melanin undertones, and biological Golden Ratio balance.
          </p>
        </div>

        {/* Category Filters */}
        <div className="mt-8 sm:mt-10 flex gap-2 overflow-x-auto pb-2 pt-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap no-scrollbar">
          {[
            { id: "all", label: "All Treatments" },
            { id: "eyes", label: "Tear Troughs & Eyes" },
            { id: "jawline", label: "Jawline & Submental" },
            { id: "skin", label: "Skin Radiance & Tone" },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`cursor-pointer flex-shrink-0 rounded-full px-4 sm:px-5 py-2 text-xs font-semibold tracking-wide transition-all ${
                activeCategory === cat.id
                  ? "bg-violet-600 text-white shadow-sm"
                  : "bg-white text-slate-600 hover:text-slate-900 border border-slate-200/90 hover:border-slate-300"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Grid of Interactive Comparisons */}
        <div className="mt-8 sm:mt-12 grid gap-6 sm:gap-10 md:grid-cols-2">
          {filteredCases.map((c) => (
            <div
              key={c.id}
              className="flex flex-col rounded-3xl border border-slate-200/90 bg-white p-4 sm:p-6 shadow-sm hover:shadow-md transition-all"
            >
              {/* Interactive Comparison Component */}
              <BeforeAfterToggle
                beforeSrc={c.beforeSrc}
                afterSrc={c.afterSrc}
                beforeLabel="Current Baseline"
                afterLabel="Targeted Simulation"
                aspectRatio="aspect-[4/5]"
                className="w-full"
              />

              {/* Patient & Vector Details */}
              <div className="mt-4 sm:mt-6 flex items-start justify-between border-b border-slate-100 pb-3 sm:pb-4">
                <div>
                  <h3 className="font-heading text-base sm:text-lg font-bold text-slate-900">
                    {c.name}, <span className="text-xs sm:text-sm font-normal text-slate-500">Age {c.age}</span>
                  </h3>
                  <p className="text-xs font-semibold text-violet-700">{c.focusArea}</p>
                </div>
                <span className="rounded-full bg-violet-50 border border-violet-200/60 px-3 py-1 text-[10px] sm:text-[11px] font-bold text-violet-700">
                  AI Verified
                </span>
              </div>

              {/* Metrics Row */}
              <div className="mt-3 sm:mt-4 grid grid-cols-3 gap-1.5 sm:gap-2 rounded-2xl bg-slate-50 border border-slate-100 p-2.5 sm:p-3 text-center">
                {c.metrics.map((m) => (
                  <div key={m.label} className="overflow-hidden">
                    <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-slate-500 truncate">{m.label}</p>
                    <p className="font-heading text-xs sm:text-sm font-bold text-emerald-700 truncate">{m.value}</p>
                  </div>
                ))}
              </div>

              {/* Clinical Finding Note */}
              <p className="mt-3 sm:mt-4 text-[11px] sm:text-xs leading-relaxed text-slate-600">
                <strong className="text-slate-800">Clinical Observation:</strong> {c.clinicalFinding}
              </p>
            </div>
          ))}
        </div>

        {/* Bottom Banner within showcase */}
        <div className="mt-12 sm:mt-16 rounded-3xl border border-slate-200 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-12 text-center text-white shadow-xl">
          <p className="eyebrow text-violet-300 text-xs">Instant Pre-Consultation Insight</p>
          <h3 className="mt-2 sm:mt-3 font-serif text-2xl sm:text-4xl text-balance">
            Discover what your own facial simulation reveals.
          </h3>
          <p className="mx-auto mt-3 sm:mt-4 max-w-xl text-xs sm:text-sm leading-5 sm:leading-6 text-slate-300">
            Upload your photo today. In 60 seconds, receive your bespoke before &amp; after simulation
            and comprehensive 2-page Clinical Dossier directly on screen and to your inbox.
          </p>
          <div className="mt-6 sm:mt-8 flex justify-center">
            <a href="#portal" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto shadow-elevated">
                Try On Your Photo in 60s
              </Button>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
