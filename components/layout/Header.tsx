import Link from "next/link";

export function Header() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
            <circle cx="12" cy="12" r="9.5" fill="none" stroke="var(--accent)" strokeWidth="1.3" />
            <line x1="12" y1="4" x2="12" y2="20" stroke="var(--accent)" strokeWidth="1" opacity="0.5" />
            <line x1="4" y1="12" x2="20" y2="12" stroke="var(--accent)" strokeWidth="1" opacity="0.5" />
            <circle cx="12" cy="12" r="1.6" fill="var(--accent)" />
          </svg>
          <span className="font-serif text-lg tracking-tight">MogaFace</span>
        </Link>
        <nav className="flex items-center gap-6 text-sm text-muted">
          <Link href="/#what-we-measure" className="hidden hover:text-foreground transition-colors sm:inline">
            What we measure
          </Link>
          <Link href="/#how-it-works" className="hidden hover:text-foreground transition-colors sm:inline">
            How it works
          </Link>
          <Link
            href="/analyze"
            className="rounded-full bg-accent px-4 py-2 text-accent-foreground hover:opacity-90 transition-opacity"
          >
            Start analysis
          </Link>
        </nav>
      </div>
    </header>
  );
}
