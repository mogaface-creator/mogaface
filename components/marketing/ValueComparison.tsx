import React from "react";
import Link from "next/link";

const INCLUDED_BENEFITS = [
  "Complete 512-point facial analysis across all facial thirds",
  "Personalized non-surgical facial improvement protocol",
  "Biometric scores: symmetry index & golden ratio facial harmony",
  "Realistic before-and-after visualizations with 100% identity lock",
  "Executive 2-Page Clinical Consultation Dossier (PDF)",
  "Access to our care team whenever you need advice",
  "Encrypted & confidential: photos never shared publicly",
];

export function ValueComparison() {
  return (
    <section className="border-b border-[#e6ebed] bg-[#ffffff] py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#71858c]">
            Unmatched Value & Transparency
          </p>
          <h2 className="mt-4 text-3xl sm:text-5xl font-medium tracking-tight text-[#141e22] leading-[1.12]">
            What could cost you $10,000 in clinic consultations
          </h2>
          <p className="mt-4 text-base sm:text-lg text-[#556970]">
            Get objective, science-based clarity from home before spending thousands on trial-and-error procedures.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-stretch">
          {/* Traditional Clinic Consultations */}
          <div className="rounded-2xl border border-[#e2e7e9] bg-[#fafcfc] p-8 sm:p-10 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-6 border-b border-[#e8eded]">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#73888f]">The Old Way</span>
                  <h3 className="text-xl sm:text-2xl font-medium text-[#141e22] mt-1">In-Person Clinic Visits</h3>
                </div>
                <span className="rounded-full bg-[#f0f4f6] px-3 py-1 text-xs font-semibold text-[#50636a] border border-[#dce4e7]">
                  $500 – $10,000+
                </span>
              </div>

              <ul className="mt-8 space-y-4">
                {[
                  "3–6 week waiting list just for an initial verbal consultation",
                  "No visual preview: doctors explain changes with hand gestures",
                  "Clinics push the specific brands or machines they own",
                  "High pressure to commit to expensive, invasive procedures immediately",
                  "Zero continuous biometric tracking or progress metrics",
                ].map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-sm text-[#55686f]">
                    <span className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-[#fee2e2] text-[#991b1b] text-xs font-bold mt-0.5">
                      ✕
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-8 pt-4 border-t border-[#e8eded] text-xs text-[#73888f]">
              High financial risk and uncertainty without visual proof.
            </div>
          </div>

          {/* MOGA Clinical Plan */}
          <div className="rounded-2xl border-2 border-[#182327] bg-[#ffffff] p-8 sm:p-10 shadow-lg flex flex-col justify-between relative">
            <span className="absolute -top-3.5 right-6 rounded-full bg-[#182327] px-4 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-xs">
              Instant Online Access
            </span>

            <div>
              <div className="flex items-center justify-between pb-6 border-b border-[#e8eded]">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#73888f]">The MOGA Standard</span>
                  <h3 className="text-xl sm:text-2xl font-medium text-[#141e22] mt-1">Full Clinical Plan</h3>
                </div>
                <span className="rounded-full bg-[#edf2f4] px-3.5 py-1 text-xs font-bold text-[#182327]">
                  Instant ~60s
                </span>
              </div>

              <ul className="mt-8 space-y-3.5">
                {INCLUDED_BENEFITS.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3 text-sm text-[#182327]">
                    <span className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-[#182327] text-white text-[10px] font-bold mt-0.5">
                      ✓
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-8 pt-6 border-t border-[#edf2f4]">
              <Link
                href="/#portal"
                className="w-full inline-flex items-center justify-center rounded-full bg-[#182327] hover:bg-[#28383f] text-white text-sm font-semibold py-3.5 px-6 transition-all shadow-xs"
              >
                Start my plan now
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
