import Link from "next/link";

export function Header() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <Link href="/" className="font-serif text-xl tracking-tight">
          MogaFace
        </Link>
        <nav className="flex items-center gap-6 text-sm text-muted">
          <Link href="/#how-it-works" className="hover:text-foreground transition-colors">
            How it works
          </Link>
          <Link
            href="/analyze"
            className="rounded-full bg-accent px-4 py-2 text-accent-foreground hover:opacity-90 transition-opacity"
          >
            Start Your Analysis
          </Link>
        </nav>
      </div>
    </header>
  );
}
