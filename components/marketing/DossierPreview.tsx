"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export function DossierPreview() {
  return (
    <section id="dossier" className="scroll-mt-20 border-t border-border bg-background py-24 sm:py-32 overflow-hidden">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-16 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          {/* Left Column: Copy & Deliverables List */}
          <div>
            <p className="eyebrow text-[11px]">Your Personal Deliverable</p>
            <h2 className="mt-4 font-serif text-4xl leading-[1.05] tracking-tight text-balance sm:text-5xl">
              A comprehensive 2-page
              <span className="mt-1 block font-light italic text-accent">Clinical Aesthetic Dossier.</span>
            </h2>
            <div aria-hidden className="mt-6 h-px w-16 bg-accent" />
            <p className="mt-6 text-base leading-7 text-body-text">
              We don&apos;t just flash a temporary screen. In 60 seconds, our system compiles an executive medical-grade report
              formatted in accordance with luxury aesthetic clinic standards and delivers it straight to your email.
            </p>

            <div className="mt-8 space-y-4">
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
                <div key={item.title} className="flex items-start gap-4 rounded-2xl border border-border/60 bg-surface-warm p-4">
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
                    {idx + 1}
                  </span>
                  <div>
                    <h3 className="font-heading text-sm font-bold text-foreground">{item.title}</h3>
                    <p className="mt-1 text-xs leading-5 text-secondary-text">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link href="/assessment">
                <Button size="lg">Get Your Free Dossier</Button>
              </Link>
              <a
                href="/api/test-pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold tracking-wide text-foreground underline decoration-accent decoration-2 underline-offset-4 hover:text-accent"
              >
                View Sample PDF Report ↗
              </a>
            </div>
          </div>

          {/* Right Column: Visual 2-Page PDF Stack Presentation */}
          <div className="relative flex justify-center py-6">
            {/* Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-accent/10 blur-3xl pointer-events-none" />

            <div className="relative flex items-center justify-center">
              {/* Page 2 (Tilted back-left) */}
              <div className="relative w-64 sm:w-72 aspect-[1/1.414] -rotate-6 translate-x-6 sm:translate-x-8 rounded-2xl overflow-hidden shadow-elevated border border-border/80 bg-white transition-transform hover:scale-105 hover:z-20">
                <Image
                  src="/images/dossier/dossier_page_2.png"
                  alt="MogaFace Clinical Dossier Page 2"
                  fill
                  className="object-cover object-top"
                  sizes="(max-width: 768px) 250px, 300px"
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
                  sizes="(max-width: 768px) 250px, 300px"
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
