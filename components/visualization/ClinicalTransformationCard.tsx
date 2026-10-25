"use client";

import { useState } from "react";
import Image from "next/image";
import type { ClinicalTreatmentPillar } from "@/lib/submissions/clinicalVision";

interface ClinicalTransformationCardProps {
  beforeSrc: string;
  afterSrc: string;
  clientName?: string;
  pillars?: ClinicalTreatmentPillar[];
  className?: string;
}

export function ClinicalTransformationCard({
  beforeSrc,
  afterSrc,
  clientName = "Patient",
  pillars,
  className = "",
}: ClinicalTransformationCardProps) {
  const [viewMode, setViewMode] = useState<"side-by-side" | "slider">("slider");
  const [sliderPos, setSliderPos] = useState<number>(50);

  const displayPillars = pillars ?? [];

  return (
    <div className={`overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl ${className}`}>
      {/* View Switcher Top Bar */}
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-4 py-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-bold text-slate-900">
            {clientName}&apos;s Consultation Preview
          </span>
          <span className="hidden sm:inline-block rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold">
            Illustrative
          </span>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-slate-200/70 p-0.5 border border-slate-200">
          <button
            type="button"
            onClick={() => setViewMode("slider")}
            className={`cursor-pointer rounded-full px-3 py-1 text-[11px] font-bold transition-all ${
              viewMode === "slider"
                ? "bg-white text-violet-700 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Interactive Wipe
          </button>
          <button
            type="button"
            onClick={() => setViewMode("side-by-side")}
            className={`cursor-pointer rounded-full px-3 py-1 text-[11px] font-bold transition-all ${
              viewMode === "side-by-side"
                ? "bg-white text-violet-700 shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Side by Side
          </button>
        </div>
      </div>

      {/* Portrait Display Section */}
      {viewMode === "side-by-side" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200 bg-slate-900">
          {/* Before Photo */}
          <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-950">
            <Image
              src={beforeSrc}
              alt="Baseline Before"
              fill
              unoptimized
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
            {/* Pill Badge */}
            <div className="absolute bottom-4 left-4 z-10">
              <span className="inline-flex items-center px-3.5 py-1 rounded-full bg-slate-900/85 text-white font-bold text-xs tracking-wide shadow-md backdrop-blur-md border border-white/10">
                Baseline Before
              </span>
            </div>
          </div>

          {/* After Photo */}
          <div className="relative aspect-[3/4] w-full overflow-hidden bg-slate-950">
            <Image
              src={afterSrc}
              alt="Targeted Simulation"
              fill
              unoptimized
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
            {/* Pill Badge */}
            <div className="absolute bottom-4 left-4 z-10">
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-violet-600 text-white font-bold text-xs tracking-wide shadow-md backdrop-blur-md">
                <span>Targeted Simulation</span>
                <span className="text-violet-200 font-normal text-[10px]">(Non-Surgical)</span>
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* Slider Mode */
        <div
          className="relative aspect-[3/4] w-full select-none overflow-hidden bg-slate-950 cursor-ew-resize touch-none"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
            setSliderPos((x / rect.width) * 100);
          }}
          onTouchMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = Math.max(0, Math.min(e.touches[0].clientX - rect.left, rect.width));
            setSliderPos((x / rect.width) * 100);
          }}
        >
          {/* Base: After Image */}
          <Image
            src={afterSrc}
            alt="Simulation After"
            fill
            unoptimized
            className="object-cover pointer-events-none"
          />

          {/* Clipped: Before Image */}
          <div
            className="absolute inset-0 overflow-hidden pointer-events-none"
            style={{ width: `${sliderPos}%` }}
          >
            <div className="relative h-full w-full" style={{ width: "100%", height: "100%" }}>
              <Image
                src={beforeSrc}
                alt="Baseline Before"
                fill
                unoptimized
                className="object-cover"
              />
            </div>
          </div>

          {/* Slider Line Divider */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_12px_rgba(255,255,255,0.8)] pointer-events-none"
            style={{ left: `${sliderPos}%` }}
          >
            <div className="absolute top-1/2 -left-3.5 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-violet-600 border-2 border-white text-white shadow-xl text-xs font-bold ring-4 ring-violet-500/20">
              ↔
            </div>
          </div>

          {/* Labels */}
          <div className="absolute bottom-4 left-4 z-10 pointer-events-none">
            <span className="px-3 py-1 rounded-full bg-slate-900/85 text-white font-bold text-xs backdrop-blur-md shadow-xs">
              Baseline
            </span>
          </div>
          <div className="absolute bottom-4 right-4 z-10 pointer-events-none">
            <span className="px-3 py-1 rounded-full bg-violet-600/90 text-white font-bold text-xs backdrop-blur-md shadow-xs">
              Simulated Outcome
            </span>
          </div>
        </div>
      )}

      {/* 5-Pillar Clinical Treatment Breakdown Bar */}
      <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-6 sm:px-6">
        <div
          className={`grid grid-cols-2 sm:grid-cols-3 ${
            displayPillars.length > 5 ? "lg:grid-cols-6" : "lg:grid-cols-5"
          } gap-4 sm:gap-6 text-center`}
        >
          {displayPillars.map((pillar) => (
            <div key={pillar.key} className="flex flex-col items-center">
              {/* Icon Container */}
              <div className="mb-2.5 flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700 shadow-2xs">
                {getPillarIcon(pillar.key)}
              </div>

              {/* Title */}
              <h4 className="text-xs font-bold text-slate-900 tracking-tight">
                {pillar.title}
              </h4>

              {/* Description */}
              <p className="mt-1 text-[11px] text-slate-500 leading-snug max-w-[150px]">
                {pillar.summary}
              </p>

              {/* Clinical Modality */}
              <p className="mt-1 text-[10px] font-semibold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-md border border-violet-200/50">
                {pillar.modality}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function getPillarIcon(key: string) {
  switch (key) {
    case "forehead":
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M5 8c2.5-1.5 5-1.5 7 0s4.5 1.5 7 0" />
          <path d="M5 12c2.5-1.5 5-1.5 7 0s4.5 1.5 7 0" />
          <path d="M5 16c2.5-1.5 5-1.5 7 0s4.5 1.5 7 0" />
        </svg>
      );

    case "under_eye":
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );

    case "midface":
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 5c2.5 0 5 1.5 5 5 0 2.5-1 4-1 6s1.5 2.5 3 4" />
          <path d="M14 10c2 .8 3.2 2.2 3.2 3.8s-1.2 3.2-3.2 4" />
        </svg>
      );

    case "jawline":
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 7v5c0 5 3.5 8.5 7 8.5s7-3.5 7-8.5V7" />
        </svg>
      );

    case "skin":
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3l2 5.5L19.5 11l-5.5 2L12 18.5 10 13l-5.5-2 5.5-2.5L12 3z" />
        </svg>
      );

    case "hair":
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 17c1-5 3.5-11 7-11s6 6 7 11" />
          <path d="M8 16c1-3.5 2.5-7 4-7s3 3.5 4 7" />
          <circle cx="12" cy="6" r="1.2" />
        </svg>
      );

    default:
      return (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
  }
}
