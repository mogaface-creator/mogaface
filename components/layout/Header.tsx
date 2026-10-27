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
            <defs>
              <mask id="nav-icon-mask">
                <rect width="32" height="32" fill="black" />
                <circle cx="14" cy="14" r="12" fill="none" stroke="white" strokeWidth="24" pathLength="100" />
              </mask>
            </defs>
            <g mask="url(#nav-icon-mask)">
              <path fillRule="evenodd" clipRule="evenodd" d="M9.11495 19.1086C5.42092 12.6972 5.16924 5.91332 8.55161 3.9569C11.934 1.9993 17.6708 5.61043 21.3649 12.0218C22.8785 14.65 23.8146 17.3407 24.1592 19.7356C25.2647 17.9984 25.9021 15.9571 25.9021 13.7744C25.9021 7.43368 20.5299 2.29395 13.9015 2.29395C7.27441 2.29395 1.90213 7.43368 1.90213 13.7744C1.90213 20.1139 7.27441 25.2536 13.9015 25.2536C14.0039 25.2536 14.1062 25.2524 14.2085 25.2501C12.3715 23.7604 10.5827 21.6554 9.11495 19.1086Z" fill="#182327" />
              <path fillRule="evenodd" clipRule="evenodd" d="M24.1592 19.7354C22.1023 22.9658 18.4259 25.1485 14.2085 25.2499C16.9946 27.5104 19.8889 28.353 21.9282 27.1733C23.924 26.0195 24.6543 23.1838 24.1592 19.7354Z" fill="#182327" />
            </g>
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
