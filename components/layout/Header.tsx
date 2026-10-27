import Link from "next/link";

const LINKS = [
  { href: "/#why-glowup", label: "Why Glow-up" },
  { href: "/#assessments", label: "Assessments" },
  { href: "/#transformations", label: "Transformations" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#faq", label: "FAQ" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-[#e6ebed] bg-white/90 backdrop-blur-md transition-all">
      <div className="mx-auto flex h-18 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Brand Logo with MOGA Geometric Mark */}
        <Link href="/" className="flex items-center gap-3 group" aria-label="MOGA Home">
          <svg className="w-8 h-8 flex-shrink-0 transition-transform group-hover:scale-105" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="16" cy="16" r="16" fill="#182327" />
            <path d="M8.5 21.5V10.5L16 17.5L23.5 10.5V21.5" stroke="#ffffff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div className="flex flex-col">
            <span className="font-sans text-xl font-bold tracking-tight text-[#162125] leading-none">
              MOGA
            </span>
            <span className="text-[10px] uppercase tracking-widest font-semibold text-[#788b91] mt-0.5">
              Facial Aesthetics Intelligence
            </span>
          </div>
        </Link>

        {/* Center Navigation Links */}
        <nav className="hidden md:flex items-center gap-8 text-[13px] font-medium text-[#50636a]">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition-colors hover:text-[#162125]"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right Actions */}
        <div className="flex items-center gap-4 sm:gap-6">
          <Link
            href="/test-lab"
            className="hidden sm:inline-block text-xs font-semibold text-[#50636a] hover:text-[#162125] transition-colors"
          >
            Testing Lab
          </Link>

          <Link
            href="/#portal"
            className="inline-flex items-center justify-center rounded-full bg-[#182327] px-5 py-2.5 text-xs font-medium text-white hover:bg-[#2c3c42] transition-all shadow-xs active:scale-98"
          >
            Start my plan
          </Link>
        </div>
      </div>
    </header>
  );
}
