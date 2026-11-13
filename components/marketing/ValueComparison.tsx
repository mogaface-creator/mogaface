import Link from "next/link";

const PLAN_HIGHLIGHTS = [
  ["Complete facial analysis", "An in-depth view of facial structure, proportional relationships, and visible features."],
  ["Personalized improvement protocol", "A practical, non-surgical plan shaped around your goals and facial context."],
  ["Scores, context, and tracking", "See your features as a connected whole, with a private reference for future progress."],
  ["Illustrative before-and-after previews", "Explore possible visual directions while retaining your identity and natural features."],
  ["Private guidance when you need it", "Keep your plan, questions, and photos in one confidential MOGA experience."],
] as const;

function CheckMark() {
  return (
    <span aria-hidden="true" className="mt-1 flex size-5 shrink-0 items-center justify-center text-[#6e8c95]">
      <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="m3.1 8.1 2.8 2.8 7-6.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function ValueComparison() {
  return (
    <section className="moga-value border-b border-[#e2e8ea] bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-[1440px] px-5 sm:px-8">
        <header className="mx-auto mb-14 max-w-4xl text-center sm:mb-16">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#6d848c]">MOGA membership</p>
          <h2 className="mt-4 text-3xl font-medium leading-[1.08] tracking-[-0.05em] text-[#1b2b31] sm:text-5xl">
            A complete view of your face, before you decide what comes next.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-relaxed text-[#5e7178] sm:text-lg">
            One private analysis brings your features, visual options, and personal plan into a single considered experience.
          </p>
        </header>

        <div className="grid border-y border-[#e1e8ea] lg:grid-cols-2">
          <article className="px-2 py-10 sm:px-10 sm:py-14 lg:border-r lg:px-14">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#6a858e]">Included in your plan</p>
            <ul className="mt-8 space-y-7">
              {PLAN_HIGHLIGHTS.map(([title, description]) => (
                <li key={title} className="group flex gap-3 rounded-xl p-2 transition-colors duration-200 hover:bg-[#f4f8f8]">
                  <CheckMark />
                  <div>
                    <h3 className="text-lg font-medium tracking-[-0.025em] text-[#26383f]">{title}</h3>
                    <p className="mt-1 max-w-xl text-[15px] leading-relaxed text-[#708188] sm:text-base">{description}</p>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-10 border-t border-[#e1e8ea] pt-5 text-xs leading-relaxed text-[#71838a]">
              MOGA supports informed conversations and does not replace professional medical advice or treatment.
            </p>
          </article>

          <article className="flex flex-col justify-center px-2 py-10 sm:px-10 sm:py-14 lg:px-14">
            <div className="moga-membership-card group relative isolate min-h-[390px] overflow-hidden rounded-[22px] border border-[#9fb4ba] p-7 text-white shadow-[0_22px_55px_rgba(43,70,78,.16)] transition duration-500 hover:-translate-y-1 hover:shadow-[0_30px_70px_rgba(43,70,78,.25)] motion-reduce:transform-none motion-reduce:transition-none sm:p-9">
              <div aria-hidden="true" className="absolute -right-24 -top-28 size-[330px] rounded-full bg-[#dce8e9]/35 blur-3xl transition duration-700 group-hover:scale-110" />
              <div aria-hidden="true" className="absolute -bottom-40 left-1/3 size-[360px] rounded-full border border-white/25" />
              <div aria-hidden="true" className="absolute bottom-10 left-10 size-24 rounded-full border border-white/15" />

              <div className="relative flex h-full min-h-[318px] flex-col justify-between">
                <div className="flex items-start justify-between gap-5">
                  <div>
                    <p className="text-2xl font-medium tracking-[-0.04em]">MOGA</p>
                    <p className="text-2xl font-light tracking-[-0.04em] text-white/75">Facial Plan</p>
                  </div>
                  <span className="rounded-full border border-white/35 bg-white/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em]">Private access</span>
                </div>

                <div className="relative mt-12">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/65">Personalized analysis</p>
                  <p className="moga-membership-title mt-3 max-w-md text-3xl font-medium leading-tight tracking-[-0.045em] sm:text-4xl">Your features, connected with clarity.</p>
                  <div className="moga-plan-stats mt-7 grid grid-cols-3 text-xs">
                    <div><span className="block text-lg text-white">160+</span>assessment areas</div>
                    <div><span className="block text-lg text-white">1</span>private plan</div>
                    <div><span className="block text-lg text-white">0</span>pressure to decide</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-7 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2" aria-label="Plan qualities">
                {["From home", "Private", "Evidence-informed"].map((label) => (
                  <span key={label} className="rounded-full border border-[#d7e2e4] px-3 py-1.5 text-xs font-medium text-[#6b8087]">{label}</span>
                ))}
              </div>
              <Link href="/assessment" className="moga-membership-cta inline-flex min-h-11 items-center justify-center rounded-full px-6 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#203239]">
                Begin your analysis
              </Link>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
