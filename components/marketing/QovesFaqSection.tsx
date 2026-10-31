"use client";

import { useState } from "react";

interface FaqItem {
  q: string;
  a: string;
}

const FAQS: FaqItem[] = [
  {
    q: "What is MOGA?",
    a: "MOGA is the world’s leading platform for understanding your unique facial morphology and achieving a real aesthetic transformation without surgery. From the comfort of your home, you receive an objective, science-based facial analysis and personalized non-surgical protocol tailored to your unique features.",
  },
  {
    q: "Can’t I just do this with ChatGPT or Claude?",
    a: "ChatGPT and other general LLMs can offer general advice, but generic is all they can provide. General AI models cannot place 512 anatomical landmarks on your face, measure skin pore texture, or perform the 160+ aesthetic diagnostic tests that form the foundation of our analysis. Most importantly, when general LLMs attempt to edit a face, they subtly alter eye shape, nose bridge, skull width, and skin melanin—causing severe identity loss. Our system locks 100% of your authentic bone structure and natural melanin while illustrating only verified, achievable non-surgical improvements.",
  },
  {
    q: "What exactly will I receive?",
    a: "You receive a 25-page Personal Appearance Protocol based on your assessment answers and submitted photographs, with guidance on hair, grooming, skin, lifestyle and style. An illustrative before-and-after preview is included only when requested, consented to and quality-screened. You can download the PDF and receive it by email if you supplied an address. Clinic options require a qualified clinician’s review.",
  },
  {
    q: "What makes this different from beauty apps or filters?",
    a: "We never use filters, airbrush blur, or fantasy caricature effects. Our models are trained for clinical precision in three specific areas: (1) Measurements—512 landmark points; (2) Realistic Visualizations—preserving authentic skin pore micro-texture and skull geometry; and (3) Recommendations—drawn from 450+ evidence-based, non-surgical dermatological and aesthetic methods.",
  },
  {
    q: "Can I really get visible results without surgery?",
    a: "Yes. Every recommendation in your protocol is non-surgical (dermal clarification, targeted neuromodulators, micro-volumization, jawline tightening, posture correction, and follicular density). Each individual change is conservative by design, but sequenced so they compound into a substantial, noticeable transformation over 1 to 4 months.",
  },
  {
    q: "Does it work for all ethnicities?",
    a: "Yes. We specifically account for demographic bone morphology, soft-tissue distribution, and melanin characteristics. Every assessment dynamically calibrates to your ancestry, age, and sex to ensure natural, harmonious improvements rather than imposing one-size-fits-all standards.",
  },
  {
    q: "Will analyzing my face make me insecure?",
    a: "Most insecurity comes from uncertainty and not knowing whether concerns are real or imagined. Our analysis provides clarity on what is truly unique and positive about your face, shows that minor asymmetry is completely normal in all humans, and gives you a clear, science-backed roadmap for the specific areas that can actually be improved.",
  },
  {
    q: "Will my photos and data be kept private?",
    a: "Yes. Everything is encrypted in transit and at rest. Your photos are used exclusively for processing your analysis and generating your personal dossier. Your images are never made public, never sold, and never shared with external third-party advertisers.",
  },
];

export function QovesFaqSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(1); // second question open by default (the ChatGPT comparison)

  return (
    <section id="faq" className="py-20 sm:py-28 bg-[#fafcfc] border-b border-[#e6ebed]">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#71858c]">
            Got Questions?
          </p>
          <h2 className="mt-4 text-3xl sm:text-5xl font-medium tracking-tight text-[#141e22] leading-[1.12]">
            Frequently asked questions
          </h2>
          <p className="mt-4 text-base text-[#556970]">
            Everything you need to know about our facial analysis, identity lock, and non-surgical protocol.
          </p>
        </div>

        <div className="space-y-4">
          {FAQS.map((faq, idx) => {
            const isOpen = openIdx === idx;
            return (
              <div
                key={idx}
                className="rounded-2xl border border-[#e2e7e9] bg-[#ffffff] transition-all overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setOpenIdx(isOpen ? null : idx)}
                  className="w-full text-left px-6 sm:px-8 py-5 sm:py-6 flex items-center justify-between gap-4"
                >
                  <span className="text-base sm:text-lg font-medium text-[#141e22]">
                    {faq.q}
                  </span>
                  <span className="flex-shrink-0 w-8 h-8 rounded-full border border-[#e0e6e8] bg-[#f8fafb] flex items-center justify-center text-sm font-semibold text-[#141e22] transition-transform">
                    {isOpen ? "−" : "+"}
                  </span>
                </button>

                {isOpen && (
                  <div className="px-6 sm:px-8 pb-6 sm:pb-8 pt-0 border-t border-[#f0f4f6]">
                    <p className="mt-4 text-sm sm:text-base text-[#556970] leading-relaxed">
                      {faq.a}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
