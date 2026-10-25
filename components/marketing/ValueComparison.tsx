"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";

export function ValueComparison() {
  return (
    <section className="border-t border-slate-200/80 bg-slate-50/50 py-16 sm:py-24 lg:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto">
          <p className="eyebrow text-xs">Objective Clarity First</p>
          <h2 className="mt-3 font-serif text-3xl sm:text-5xl leading-[1.05] tracking-tight text-slate-900 text-balance">
            Why start with an AI simulation
            <span className="block font-light italic text-violet-700">before walking into a clinic?</span>
          </h2>
          <div aria-hidden="true" className="mx-auto mt-4 sm:mt-6 h-1 w-12 bg-violet-600 rounded-full" />
          <p className="mt-4 sm:mt-6 text-sm sm:text-base leading-6 sm:leading-7 text-slate-600">
            Consultations without visual alignment lead to unmet expectations. MogaFace gives you and your
            practitioner an objective photographic baseline before any procedure is scheduled.
          </p>
        </div>

        <div className="mt-10 sm:mt-16 grid gap-6 sm:gap-8 lg:grid-cols-2">
          {/* Traditional Clinic Path Card */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 lg:p-10 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 sm:pb-6">
              <div>
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">The Traditional Way</span>
                <h3 className="mt-1 font-heading text-lg sm:text-2xl font-bold text-slate-900">In-Person Consultation</h3>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] sm:text-xs font-semibold text-slate-600">
                $350 – $600 Fee
              </span>
            </div>

            <ul className="mt-6 sm:mt-8 space-y-3.5 sm:space-y-4">
              {[
                { title: "Long Booking Delays", desc: "Average 3–6 week wait time for top aesthetic dermatologists." },
                { title: "Verbal Descriptions Only", desc: "Doctors explain with hand gestures — no visual proof of how your face will respond." },
                { title: "High-Pressure Environment", desc: "Pressure to commit to injectable syringes or surgical packages on the spot." },
                { title: "Subjective Opinions", desc: "Every clinic sells the specific machine or product brand they carry." },
              ].map((item) => (
                <li key={item.title} className="flex items-start gap-2.5 sm:gap-3 text-xs sm:text-sm text-slate-600">
                  <span className="mt-0.5 flex h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600 text-[10px] sm:text-xs font-bold">
                    ✕
                  </span>
                  <div>
                    <strong className="text-slate-900">{item.title}:</strong> {item.desc}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* MogaFace Intelligence Path Card */}
          <div className="relative rounded-3xl border-2 border-violet-500 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 lg:p-10 text-white shadow-xl">
            <span className="absolute -top-3 sm:-top-3.5 right-4 sm:right-8 rounded-full bg-gradient-to-r from-violet-600 to-indigo-600 px-3.5 sm:px-4 py-0.5 sm:py-1 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-white shadow-md">
              Recommended First Step
            </span>

            <div className="flex items-center justify-between border-b border-white/10 pb-4 sm:pb-6">
              <div>
                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-violet-300">The MogaFace Path</span>
                <h3 className="mt-1 font-heading text-lg sm:text-2xl font-bold text-white">Digital Aesthetic Intelligence</h3>
              </div>
              <span className="rounded-full bg-violet-500/20 px-3 py-1 text-[11px] sm:text-xs font-semibold text-violet-300 border border-violet-400/30">
                Immediate in 60s
              </span>
            </div>

            <ul className="mt-6 sm:mt-8 space-y-3.5 sm:space-y-4">
              {[
                { title: "Instant 60-Second Turnaround", desc: "No weeks of waiting. Upload your photos and receive your simulation immediately." },
                { title: "Photographic Evidence Before Committing", desc: "See your actual face harmonized beside your original baseline photo." },
                { title: "Confidential 2-Page Clinical Dossier", desc: "Delivered on-screen and to your email as a medical-grade PDF to review in total privacy." },
                { title: "Objective Golden Ratio Mapping", desc: "Identifies specific mandibular vectors, tear troughs, and symmetry balance." },
              ].map((item) => (
                <li key={item.title} className="flex items-start gap-2.5 sm:gap-3 text-xs sm:text-sm text-slate-300">
                  <span className="mt-0.5 flex h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] sm:text-xs font-bold">
                    ✓
                  </span>
                  <div>
                    <strong className="text-white">{item.title}:</strong> {item.desc}
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-6 sm:mt-8 pt-5 sm:pt-6 border-t border-white/10">
              <a href="#portal">
                <Button size="lg" className="w-full justify-center shadow-elevated">
                  Try On Your Photo in 60s
                </Button>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
