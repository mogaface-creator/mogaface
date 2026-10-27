import React from "react";

const DEMOGRAPHIC_FACTORS = [
  {
    title: "Ethnic background",
    desc: "Every demographic possesses unique skull architecture, soft-tissue thickness, and melanin profiles. Our algorithms adjust for your ancestry, preventing generic Western-only standards.",
  },
  {
    title: "Personal preferences",
    desc: "Whether you favor ultra-conservative natural refinement or razor-sharp mandibular sculpting, your plan is calibrated to your exact comfort zone and daily routine.",
  },
  {
    title: "Lifestyle factors",
    desc: "Sleep architecture, hydration, facial posture (tongue posture and resting mouth state), nutrition, and sun exposure patterns are directly incorporated into your non-surgical timeline.",
  },
  {
    title: "Natural aging patterns",
    desc: "We analyze deep fat pad repositioning, collagen degradation rates, and bone resorption to target enhancements that age gracefully over years rather than fading in weeks.",
  },
  {
    title: "Cultural beauty standards",
    desc: "Balancing objective facial thirds with authentic personal aesthetics ensures you look like the most attractive, vibrant version of yourself—never an artificial stranger.",
  },
];

const LEARNING_OUTCOMES = [
  {
    number: "01",
    title: "Your Biometric Scores",
    desc: "Exact proportions: facial thirds, midface ratio, mandibular angle, and bilateral symmetry calculated with sub-millimeter precision.",
  },
  {
    number: "02",
    title: "Feature Impact Hierarchy",
    desc: "A mathematical breakdown ranking which specific features (e.g. tear troughs vs jawline border) exert the greatest influence on your facial balance.",
  },
  {
    number: "03",
    title: "Features With Highest Potential",
    desc: "Clear identification of the 'low-hanging fruit'—the subtle, high-yield non-surgical adjustments that yield the most dramatic aesthetic glow-up.",
  },
  {
    number: "04",
    title: "The Underlying Science",
    desc: "Complete medical transparency. Every recommendation links directly to peer-reviewed dermatological and plastic surgery studies explaining exactly why it works.",
  },
];

export function QovesCompleteAnalysis() {
  return (
    <section className="py-20 sm:py-28 bg-[#fafcfc] border-b border-[#e6ebed]">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Section Top Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#71858c]">
            A New Way to Glow-Up
          </p>
          <h2 className="mt-4 text-3xl sm:text-5xl font-medium tracking-tight text-[#141e22] leading-[1.12]">
            Your complete facial analysis
          </h2>
          <p className="mt-4 text-base sm:text-lg text-[#556970]">
            We analyze 512 anatomical facial landmarks, evaluating your features holistically rather than in isolation.
          </p>
        </div>

        {/* 2 Column Layout: "Taking into account..." vs "You will learn..." */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14">
          {/* Left Column: Taking into account your... */}
          <div className="rounded-2xl border border-[#e2e7e9] bg-[#ffffff] p-8 sm:p-10 shadow-xs">
            <h3 className="text-xl sm:text-2xl font-medium text-[#141e22]">
              Taking into account your...
            </h3>
            <p className="mt-2 text-sm text-[#677b82]">
              No two faces are alike. Your analysis is strictly customized across 5 individualized dimensions:
            </p>

            <div className="mt-8 space-y-6">
              {DEMOGRAPHIC_FACTORS.map((factor, idx) => (
                <div key={idx} className="flex gap-4">
                  <span className="flex-shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-[#1b2529] text-white text-[10px] font-semibold mt-0.5">
                    ✓
                  </span>
                  <div>
                    <h4 className="text-sm font-semibold text-[#141e22]">
                      {factor.title}
                    </h4>
                    <p className="mt-1 text-xs sm:text-sm text-[#55686f] leading-relaxed">
                      {factor.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: You will learn... */}
          <div className="rounded-2xl border border-[#e2e7e9] bg-[#ffffff] p-8 sm:p-10 shadow-xs flex flex-col justify-between">
            <div>
              <h3 className="text-xl sm:text-2xl font-medium text-[#141e22]">
                You will learn...
              </h3>
              <p className="mt-2 text-sm text-[#677b82]">
                Direct, objective findings backed by measurable biometric markers:
              </p>

              <div className="mt-8 space-y-6">
                {LEARNING_OUTCOMES.map((item, idx) => (
                  <div key={idx} className="flex gap-4">
                    <span className="flex-shrink-0 font-mono text-xs font-bold text-[#7a8f96] mt-0.5">
                      {item.number}
                    </span>
                    <div>
                      <h4 className="text-sm font-semibold text-[#141e22]">
                        {item.title}
                      </h4>
                      <p className="mt-1 text-xs sm:text-sm text-[#55686f] leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 p-4 rounded-xl bg-[#f0f4f6] border border-[#e2e8ea]">
              <p className="text-xs text-[#3f5258] leading-relaxed font-medium">
                🎯 <strong>Zero Surgery Required:</strong> Every single recommendation is 100% non-surgical, structured so small changes compound into a noticeable, natural transformation.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
