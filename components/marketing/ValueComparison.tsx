"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";

export function ValueComparison() {
  return (
    <section className="border-t border-border bg-surface py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="text-center max-w-2xl mx-auto">
          <p className="eyebrow text-[11px]">Objective Clarity First</p>
          <h2 className="mt-4 font-serif text-4xl leading-[1.05] tracking-tight sm:text-5xl">
            Why start with an AI simulation
            <span className="block font-light italic text-accent">before walking into a clinic?</span>
          </h2>
          <div aria-hidden="true" className="mx-auto mt-6 h-px w-16 bg-accent" />
          <p className="mt-6 text-base leading-7 text-body-text">
            Consultations without visual alignment lead to unmet expectations. MogaFace gives you and your
            practitioner an objective photographic baseline before any procedure is scheduled.
          </p>
        </div>

        <div className="mt-16 grid gap-8 lg:grid-cols-2">
          {/* Traditional Clinic Path Card */}
          <div className="rounded-3xl border border-border/80 bg-background p-8 sm:p-10 shadow-subtle">
            <div className="flex items-center justify-between border-b border-border/80 pb-6">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted">The Traditional Way</span>
                <h3 className="mt-1 font-heading text-2xl font-bold text-foreground">In-Person Consultation</h3>
              </div>
              <span className="rounded-full bg-surface-subtle px-3 py-1 text-xs font-semibold text-secondary-text">
                $350 – $600 Fee
              </span>
            </div>

            <ul className="mt-8 space-y-4">
              {[
                { title: "Long Booking Delays", desc: "Average 3–6 week wait time for top aesthetic dermatologists." },
                { title: "Verbal Descriptions Only", desc: "Doctors explain with hand gestures — no visual proof of how your face will respond." },
                { title: "High-Pressure Environment", desc: "Pressure to commit to injectable syringes or surgical packages on the spot." },
                { title: "Subjective Opinions", desc: "Every clinic sells the specific machine or product brand they carry." },
              ].map((item) => (
                <li key={item.title} className="flex items-start gap-3 text-sm text-body-text">
                  <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 text-xs font-bold">
                    ✕
                  </span>
                  <div>
                    <strong className="text-foreground">{item.title}:</strong> {item.desc}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* MogaFace Intelligence Path Card */}
          <div className="relative rounded-3xl border-2 border-accent bg-dark-surface p-8 sm:p-10 text-dark-foreground shadow-heavy">
            <span className="absolute -top-3.5 right-8 rounded-full bg-accent px-4 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-md">
              Recommended First Step
            </span>

            <div className="flex items-center justify-between border-b border-dark-body/20 pb-6">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-gold">The MogaFace Path</span>
                <h3 className="mt-1 font-heading text-2xl font-bold text-white">Digital Aesthetic Intelligence</h3>
              </div>
              <span className="rounded-full bg-accent/20 px-3 py-1 text-xs font-semibold text-gold">
                Immediate in 60s
              </span>
            </div>

            <ul className="mt-8 space-y-4">
              {[
                { title: "Instant 60-Second Turnaround", desc: "No weeks of waiting. Upload your photos and receive your simulation immediately." },
                { title: "Photographic Evidence Before Committing", desc: "See your actual face harmonized beside your original baseline photo." },
                { title: "Confidential 2-Page Clinical Dossier", desc: "Delivered to your email as a medical-grade PDF to review in total privacy." },
                { title: "Objective Golden Ratio Mapping", desc: "Identifies specific mandibular vectors, tear troughs, and symmetry balance." },
              ].map((item) => (
                <li key={item.title} className="flex items-start gap-3 text-sm text-dark-body">
                  <span className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold">
                    ✓
                  </span>
                  <div>
                    <strong className="text-white">{item.title}:</strong> {item.desc}
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-8 pt-6 border-t border-dark-body/20">
              <Link href="/assessment">
                <Button className="w-full justify-center">
                  Start Your 60-Second Assessment
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
