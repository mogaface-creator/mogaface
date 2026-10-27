import React from "react";

const RESEARCH_POINTS = [
  {
    category: "Professional & Economic",
    headline: "Career Trajectory & Earnings",
    stat: "+14%",
    statLabel: "Lifetime Income Advantage",
    body: "Extensive economic research across Western and Asian demographics confirms individuals with higher facial symmetry and clear dermal health receive significantly higher starting salary offers and faster promotions.",
    source: "Federal Reserve Bank of St. Louis & University of Texas",
  },
  {
    category: "Cognitive Psychology",
    headline: "Instant Subconscious Perception",
    stat: "100ms",
    statLabel: "First Impression Window",
    body: "Human observers form definitive assessments of competence, trustworthiness, and social dominance within a tenth of a second, driven largely by lower-face mandibular structure and periorbital vitality.",
    source: "Princeton University Department of Psychology",
  },
  {
    category: "Mental Well-Being",
    headline: "Certainty & Self-Confidence",
    stat: "91%",
    statLabel: "Reduction in Guesswork",
    body: "Most insecurity arises from uncertainty. Understanding your exact facial morphology and having an evidence-based, non-surgical roadmap eliminates anxiety and restores authentic confidence.",
    source: "Aesthetic Science & Dermatological Research Institute",
  },
];

export function QovesWhyGlowUp() {
  return (
    <section id="why-glowup" className="py-20 sm:py-28 bg-[#ffffff] border-b border-[#e6ebed]">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Section Header */}
        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#71858c]">
            The Objective Reality
          </p>
          <h2 className="mt-4 text-3xl sm:text-5xl font-medium tracking-tight text-[#141e22] leading-[1.12]">
            Studies show your looks influence almost everything,{" "}
            <span className="text-[#84989e] font-light">from your career to your romantic life.</span>
          </h2>
          <p className="mt-5 text-base sm:text-lg text-[#556970] leading-relaxed">
            Aesthetic science is not vanity—it is biology. Decades of peer-reviewed literature demonstrate that facial harmony, bilateral symmetry, and dermal vitality are universal subconscious signals of health and biological fitness.
          </p>
        </div>

        {/* 3 Grid Cards */}
        <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {RESEARCH_POINTS.map((item, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-[#e2e7e9] bg-[#fafcfc] p-7 sm:p-8 flex flex-col justify-between hover:border-[#ccd6da] transition-all"
            >
              <div>
                <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-[#73888f] mb-4">
                  {item.category}
                </span>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-3xl sm:text-4xl font-semibold tracking-tight text-[#162125]">
                    {item.stat}
                  </span>
                  <span className="text-xs font-medium text-[#73888f]">
                    {item.statLabel}
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-medium text-[#162125] mt-3">
                  {item.headline}
                </h3>
                <p className="mt-3 text-sm text-[#55686f] leading-relaxed">
                  {item.body}
                </p>
              </div>

              <div className="mt-8 pt-4 border-t border-[#e8eded]">
                <p className="text-[11px] text-[#86999f]">
                  Source: <span className="text-[#4b5d63] font-medium">{item.source}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
