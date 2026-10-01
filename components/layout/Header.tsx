import Link from "next/link";

const LINKS = [
  { href: "/#why", label: "Why MogaFace" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#faq", label: "FAQ" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/90 backdrop-blur-md">
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
        <nav className="flex items-center gap-8 text-sm text-secondary-text">
          {LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="hidden transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent md:inline">
              {link.label}
            </Link>
          ))}
          <Link
            href="/assessment"
            className="rounded-full bg-[image:var(--gradient-regal)] px-4 py-2 text-sm font-medium text-accent-foreground shadow-[var(--shadow-subtle)] transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.98]"
          >
            Start
          </Link>
        </nav>
      </div>
    </header>
  );
}
