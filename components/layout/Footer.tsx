import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-[#e6ebed] bg-[#ffffff] py-14 sm:py-18">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-10">
          <div>
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 flex-shrink-0" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="16" cy="16" r="16" fill="#182327" />
                <path d="M8.5 21.5V10.5L16 17.5L23.5 10.5V21.5" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="font-sans text-xl font-bold tracking-tight text-[#162125]">MOGA</span>
              <span className="rounded-full bg-[#f0f4f6] px-2.5 py-0.5 text-[10px] font-semibold text-[#50636a] border border-[#e0e6e8]">
                Facial Aesthetics Studio
              </span>
            </div>
            <p className="mt-3 max-w-md text-xs leading-relaxed text-[#6d8087]">
              Science-based facial analysis, objective aesthetic advice, and non-surgical transformation protocols tailored to your unique features. We never use surgery or generic face-swaps.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 text-xs font-medium text-[#50636a]">
            <div className="flex flex-col gap-2.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#90a2a8]">Navigation</span>
              <Link href="/#why-glowup" className="hover:text-[#162125] transition-colors">Why Glow-up</Link>
              <Link href="/#assessments" className="hover:text-[#162125] transition-colors">160+ Assessments</Link>
              <Link href="/#transformations" className="hover:text-[#162125] transition-colors">Transformations</Link>
              <Link href="/#how-it-works" className="hover:text-[#162125] transition-colors">How It Works</Link>
            </div>
            <div className="flex flex-col gap-2.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#90a2a8]">Tools</span>
              <Link href="/assessment" className="hover:text-[#162125] transition-colors">Start assessment</Link>
              <Link href="/#faq" className="hover:text-[#162125] transition-colors">FAQ</Link>
            </div>
            <div className="flex flex-col gap-2.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#90a2a8]">Legal</span>
              <span className="text-[#84979e]">Confidential & Encrypted</span>
              <span className="text-[#84979e]">Non-Surgical Only</span>
              <span className="text-[#84979e]">Doctor Consultation Advised</span>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-[#f0f4f6] flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-[#86999f]">
          <p>&copy; {new Date().getFullYear()} MOGA Studio. All rights reserved.</p>
          <p>This is an illustrative aesthetic guidance service. Not a medical prescription or surgical outcome guarantee.</p>
        </div>
      </div>
    </footer>
  );
}
