import Link from "next/link";

const LINKS = [
  { href: "/#portal", label: "Instant Simulation" },
  { href: "/#transformations", label: "Transformations" },
  { href: "/#dossier", label: "2-Page Dossier" },
  { href: "/#how-it-works", label: "How It Works" },
  { href: "/#faq", label: "FAQ" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl transition-all">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Brand Logo & Medical Geometric Mark */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow-xs group-hover:scale-105 transition-transform">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" opacity="0.4" />
              <line x1="12" y1="3" x2="12" y2="21" strokeDasharray="2 2" />
              <line x1="3" y1="12" x2="21" y2="12" strokeDasharray="2 2" />
              <circle cx="12" cy="12" r="2" fill="currentColor" />
            </svg>
          </div>
          <div className="flex flex-col">
            <span className="font-serif text-lg font-bold tracking-tight text-slate-900 leading-none">
              MogaFace
            </span>
            <span className="text-[10px] uppercase tracking-wider font-semibold text-violet-600 mt-0.5">
              Clinic Next Face
            </span>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-7 text-xs font-semibold text-slate-600">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition-colors hover:text-violet-700 py-1"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Right Action & Live Pulse */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50/80 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>AI Vision Active</span>
          </div>

          <Link
            href="/#portal"
            className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-violet-600 via-indigo-600 to-violet-700 px-4 py-2 text-xs font-semibold text-white shadow-xs shadow-violet-500/20 hover:from-violet-500 hover:to-indigo-500 transition-all active:scale-95"
          >
            <span>Try AI Simulation</span>
            <span className="ml-1 text-[13px]">→</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
