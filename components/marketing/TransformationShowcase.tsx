"use client";

import { useState } from "react";
import { BeforeAfterToggle } from "./BeforeAfterToggle";

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
      "Tear trough hollowing softened with gentle anterior cheek volume restoration, establishing natural youthful light reflection without surgery.",
  },
  {
    id: "case-2",
    category: "jawline",
    name: "Lucas M.",
    age: "32",
    focusArea: "Mandibular Angle & Jawline Definition",
    beforeSrc: "/images/transformations/male_jawline_before.webp",
    afterSrc: "/images/transformations/male_jawline_after.webp",
    metrics: [
      { label: "Jaw-to-Neck Separation", value: "+28% Definition" },
      { label: "Cervical Angle", value: "112° Sculpted" },
      { label: "Submental Volume", value: "Streamlined" },
    ],
    clinicalFinding:
      "Crisp lower mandibular definition and submental soft-tissue contouring, eliminating fatigue signals while preserving authentic bone structure.",
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
      { label: "Cheek Apex Vector", value: "Elevated" },
      { label: "Blemish Clarity", value: "Cleared" },
    ],
    clinicalFinding:
      "Luminous complexion enhancement paired with midface malar contouring, softening nasolabial shadows with authentic dermal pore micro-texture.",
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
      { label: "Profile Balance", value: "Harmonious" },
    ],
    clinicalFinding:
      "Integrated forehead line relaxation and under-eye hollow restoration, translating tired baseline into an energized, confident clinical projection.",
  },
];

export function TransformationShowcase() {
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const filteredCases =
    activeCategory === "all"
      ? CASES
      : CASES.filter((c) => c.category === activeCategory);

  return (
    <section id="transformations" className="scroll-mt-20 border-b border-[#e6ebed] bg-[#fafcfc] py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Section Header */}
        <div className="max-w-2xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#71858c]">
            Verified Case Studies
          </p>
          <h2 className="mt-4 text-3xl sm:text-5xl font-medium tracking-tight text-[#141e22] leading-[1.12]">
            Life-changing Transformations
          </h2>
          <p className="mt-4 text-base sm:text-lg text-[#556970]">
            Real results achieved through non-surgical methods tailored to each individual&apos;s unique features—with 100% identity preservation.
          </p>
        </div>

        {/* Category Filters */}
        <div className="mt-10 flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap no-scrollbar">
          {[
            { id: "all", label: "All Cases" },
            { id: "eyes", label: "Tear Troughs & Eyes" },
            { id: "jawline", label: "Jawline & Mandible" },
            { id: "skin", label: "Dermal Radiance & Tone" },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`cursor-pointer rounded-full px-5 py-2 text-xs font-semibold tracking-wide transition-all ${
                activeCategory === cat.id
                  ? "bg-[#182327] text-white shadow-xs"
                  : "bg-white text-[#55686f] hover:bg-[#f0f4f6] hover:text-[#182327] border border-[#e2e8ea]"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Grid of Interactive Comparisons */}
        <div className="mt-10 grid gap-8 md:grid-cols-2">
          {filteredCases.map((c) => (
            <div
              key={c.id}
              className="flex flex-col rounded-2xl border border-[#e2e7e9] bg-[#ffffff] p-5 sm:p-7 shadow-xs hover:border-[#ccd7db] transition-all"
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
              <div className="mt-6 flex items-start justify-between border-b border-[#edf2f4] pb-4">
                <div>
                  <h3 className="text-base sm:text-lg font-medium text-[#141e22]">
                    {c.name}, <span className="text-xs sm:text-sm font-normal text-[#75888f]">Age {c.age}</span>
                  </h3>
                  <p className="text-xs font-semibold text-[#3b4e54] mt-0.5">{c.focusArea}</p>
                </div>
                <span className="rounded-full bg-[#f0f4f6] border border-[#dce4e7] px-3 py-1 text-[10px] font-semibold text-[#3a4d53]">
                  Identity Verified
                </span>
              </div>

              {/* Metrics Row */}
              <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-[#fafcfc] border border-[#e8eded] p-3 text-center">
                {c.metrics.map((m) => (
                  <div key={m.label} className="overflow-hidden">
                    <p className="text-[10px] uppercase tracking-wider text-[#73888f] truncate">{m.label}</p>
                    <p className="text-xs sm:text-sm font-semibold text-[#182327] truncate mt-0.5">{m.value}</p>
                  </div>
                ))}
              </div>

              {/* Clinical Finding Narrative */}
              <p className="mt-4 text-xs sm:text-sm text-[#556970] leading-relaxed">
                {c.clinicalFinding}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
