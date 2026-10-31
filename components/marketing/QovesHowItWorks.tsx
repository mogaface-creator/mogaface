import React from "react";

const STEPS = [
  {
    step: "01",
    title: "Upload Your Photos",
    body: "Take or upload photos of your face from your phone or camera. We guide you through simple lighting and angle instructions to ensure pristine measurement accuracy.",
    badge: "Takes 2 Minutes",
  },
  {
    step: "02",
    title: "160+ Facial Assessments",
    body: "Our models place 512 anatomical landmarks, calculate your facial thirds, measure bilateral symmetry, evaluate dermal micro-pores, and identify your highest potential features.",
    badge: "Sub-Millimeter Analysis",
  },
  {
    step: "03",
    title: "Get Your Protocol & Visuals",
    body: "Receive your 25-page Personal Appearance Protocol. If requested, consented to and quality-screened, an illustrative before-and-after preview is included. Clinic options require clinician review.",
    badge: "Compounding Non-Surgical Results",
  },
];

export function QovesHowItWorks() {
  return (
    <section id="how-it-works" className="py-20 sm:py-28 bg-[#ffffff] border-b border-[#e6ebed]">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#71858c]">
            Simple 3-Step Process
          </p>
          <h2 className="mt-4 text-3xl sm:text-5xl font-medium tracking-tight text-[#141e22] leading-[1.12]">
            How it works
          </h2>
          <p className="mt-4 text-base sm:text-lg text-[#556970]">
            From initial photo upload to your personalized facial transformation plan.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {STEPS.map((step, idx) => (
            <div
              key={idx}
              className="relative rounded-2xl border border-[#e2e7e9] bg-[#fafcfc] p-8 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-6">
                  <span className="font-mono text-2xl font-bold text-[#141e22]">
                    {step.step}
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[#73888f] px-2.5 py-1 rounded-full bg-[#edf2f4]">
                    {step.badge}
                  </span>
                </div>
                <h3 className="text-lg font-medium text-[#141e22]">
                  {step.title}
                </h3>
                <p className="mt-3 text-sm text-[#55686f] leading-relaxed">
                  {step.body}
                </p>
              </div>

              <div className="mt-8 pt-4 border-t border-[#e8eded]">
                <span className="text-xs font-semibold text-[#141e22]">
                  Step {idx + 1} of 3
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
