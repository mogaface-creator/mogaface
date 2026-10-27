import React from "react";

const TECH_CARDS = [
  {
    title: "512-Point Precision Facial Analysis",
    subtitle: "Mathematical Rigor",
    body: "We landmark 512 points across your facial thirds, mandibular jawline border, tear troughs, and zygomatic arches, allowing sub-millimeter measurements far beyond standard human observation.",
  },
  {
    title: "Unmatched Personalization",
    subtitle: "Ethnicity & Age Calibrated",
    body: "Standard beauty apps impose one-size-fits-all Western models. Our algorithms dynamically recalibrate based on your demographic heritage, age, sex, and facial bone thickness.",
  },
  {
    title: "The Science of Facial Attractiveness",
    subtitle: "450+ Evidence-Based Methods",
    body: "Every aesthetic recommendation is drawn from 50+ years of peer-reviewed literature in aesthetic surgery, dermatology, facial morphology, and evolutionary psychology.",
  },
  {
    title: "Reviewed by Humans",
    subtitle: "Expert Clinical Oversight",
    body: "AI delivers the diagnostic speed, but human clinical doctors and aesthetic specialists oversee quality validation to ensure every plan is realistic, non-surgical, and safe.",
  },
];

export function QovesTechnology() {
  return (
    <section className="py-20 sm:py-28 bg-[#fafcfc] border-b border-[#e6ebed]">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#71858c]">
            Proprietary Architecture
          </p>
          <h2 className="mt-4 text-3xl sm:text-5xl font-medium tracking-tight text-[#141e22] leading-[1.12]">
            The technology behind your transformation
          </h2>
          <p className="mt-4 text-base sm:text-lg text-[#556970]">
            Combining advanced computer vision landmarking with clinical aesthetic science.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {TECH_CARDS.map((card, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-[#e2e7e9] bg-[#ffffff] p-8 sm:p-9 shadow-xs hover:border-[#ccd6da] transition-all"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#73888f]">
                  {card.subtitle}
                </span>
                <span className="font-mono text-xs text-[#87999f]">
                  0{idx + 1}
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-medium text-[#141e22]">
                {card.title}
              </h3>
              <p className="mt-3 text-sm text-[#55686f] leading-relaxed">
                {card.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
