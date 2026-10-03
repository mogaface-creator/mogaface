"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export function DossierPreview() {
  const [mobilePage, setMobilePage] = useState<1 | 2>(1);

  return (
    <section id="dossier" className="scroll-mt-20 border-t border-border bg-background py-16 sm:py-24 lg:py-32 overflow-hidden">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          {/* Left Column: Copy & Deliverables List */}
          <div>
            <p className="eyebrow text-[11px]">Your Personal Deliverable</p>
            <h2 className="mt-3 font-serif text-3xl sm:text-5xl leading-[1.05] tracking-tight text-balance">
              A comprehensive 2-page
              <span className="mt-1 block font-light italic text-accent">Clinical Aesthetic Dossier.</span>
            </h2>
            <div aria-hidden className="mt-4 sm:mt-6 h-px w-16 bg-accent" />
            <p className="mt-4 sm:mt-6 text-sm sm:text-base leading-6 sm:leading-7 text-body-text">
              We don&apos;t just flash a temporary screen. In 60 seconds, our system compiles an executive medical-grade report
              formatted in accordance with luxury aesthetic clinic standards and delivers it straight to your email.
            </p>

            <div className="mt-6 sm:mt-8 space-y-3 sm:space-y-4">
              {[
                {
                  title: "Photographic Baseline & Targeted Simulation",
                  desc: "Side-by-side high-resolution comparison preserving your natural bone structure and identity.",
                },
                {
                  title: "Executive Clinical Interpretation",
                  desc: "Objective plain-language analysis of your facial balance, light-reflection vectors, and soft-tissue harmony.",
                },
                {
                  title: "Identified Anatomical Opportunities",
                  desc: "Structured breakdown of your jawline, tear troughs, midface malar projection, and skin tone.",
                },
                {
                  title: "In-Clinic Consultation Pathway & Reference ID",
                  desc: "A confidential file code to present to your medical aesthetic specialist for hands-on planning.",
                },
              ].map((item, idx) => (
                <div key={item.title} className="flex items-start gap-3 sm:gap-4 rounded-xl sm:rounded-2xl border border-border/60 bg-surface-warm p-3.5 sm:p-4">
                  <span className="flex h-6 w-6 sm:h-7 sm:w-7 flex-shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
                    {idx + 1}
                  </span>
                  <div>
                    <h3 className="font-heading text-xs sm:text-sm font-bold text-foreground">{item.title}</h3>
                    <p className="mt-0.5 sm:mt-1 text-[11px] sm:text-xs leading-4 sm:leading-5 text-secondary-text">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row sm:items-center gap-4">
              <Link href="/assessment" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto shadow-elevated">Get Your Free Dossier</Button>
              </Link>
              <a
                href="/api/test-pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold tracking-wide text-foreground underline decoration-accent decoration-2 underline-offset-4 hover:text-accent text-center sm:text-left"
              >
                View Sample PDF Report ↗
              </a>
            </div>
          </div>

          {/* Right Column: Visual 2-Page PDF Presentation */}
          <div className="relative flex flex-col items-center justify-center py-4 sm:py-6">
            {/* Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-72 sm:h-96 w-72 sm:w-96 rounded-full bg-accent/10 blur-3xl pointer-events-none" />

            {/* Mobile View: Interactive Segmented Tabs + Upright Clean View */}
            <div className="w-full sm:hidden flex flex-col items-center">
              <div className="mb-4 flex w-full max-w-[280px] rounded-full bg-surface-warm p-1 border border-border">
                <button
                  type="button"
                  onClick={() => setMobilePage(1)}
                  className={`flex-1 rounded-full py-1.5 text-xs font-semibold transition-all ${
                    mobilePage === 1 ? "bg-accent text-white shadow-xs" : "text-muted hover:text-foreground"
                  }`}
                >
                  Page 1: Comparison
                </button>
                <button
                  type="button"
                  onClick={() => setMobilePage(2)}
                  className={`flex-1 rounded-full py-1.5 text-xs font-semibold transition-all ${
                    mobilePage === 2 ? "bg-accent text-white shadow-xs" : "text-muted hover:text-foreground"
                  }`}
                >
                  Page 2: Findings
                </button>
              </div>

              <div className="relative w-full max-w-[280px] aspect-[1/1.414] rounded-2xl overflow-hidden shadow-elevated border border-accent/25 bg-white">
                <Image
                  src={mobilePage === 1 ? "/images/dossier/dossier_page_1.png" : "/images/dossier/dossier_page_2.png"}
                  alt={`MogaFace Clinical Dossier Page ${mobilePage}`}
                  fill
                  className="object-cover object-top"
                  sizes="280px"
                  priority
                />
                <span className="absolute top-2.5 right-2.5 rounded-full bg-accent px-2.5 py-0.5 text-[9px] font-bold text-white shadow-xs">
                  {mobilePage === 1 ? "Page 1: Photo Analysis" : "Page 2: Opportunities"}
                </span>
              </div>
            </div>

            {/* Desktop View: Stacked 3D Luxury Perspective */}
            <div className="relative hidden sm:flex items-center justify-center">
              {/* Page 2 (Tilted back-left) */}
              <div className="relative w-64 sm:w-72 aspect-[1/1.414] -rotate-6 translate-x-6 sm:translate-x-8 rounded-2xl overflow-hidden shadow-elevated border border-border/80 bg-white transition-transform hover:scale-105 hover:z-20">
                <Image
                  src="/images/dossier/dossier_page_2.png"
                  alt="MogaFace Clinical Dossier Page 2"
                  fill
                  className="object-cover object-top"
                  sizes="300px"
                />
                <span className="absolute bottom-3 left-3 rounded-full bg-dark-surface/90 backdrop-blur-md px-3 py-1 text-[10px] font-bold text-white shadow-sm">
                  Page 2: Anatomical Findings
                </span>
              </div>

              {/* Page 1 (Front & center, slightly rotated right) */}
              <div className="relative w-64 sm:w-72 aspect-[1/1.414] rotate-3 -translate-x-4 sm:-translate-x-6 z-10 rounded-2xl overflow-hidden shadow-heavy border border-accent/30 bg-white transition-transform hover:scale-105 hover:z-30">
                <Image
                  src="/images/dossier/dossier_page_1.png"
                  alt="MogaFace Clinical Dossier Page 1"
                  fill
                  className="object-cover object-top"
                  sizes="300px"
                  priority
                />
                <span className="absolute top-3 right-3 rounded-full bg-accent px-3 py-1 text-[10px] font-bold text-white shadow-sm">
                  Page 1: Visual Comparison
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
