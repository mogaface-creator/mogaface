import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-12 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-serif text-2xl tracking-tight">MogaFace</p>
          <p className="mt-3 max-w-sm text-sm leading-6 text-muted">
            An illustrative preview for a clinic conversation. Not a diagnosis, and not a treatment plan.
          </p>
        </div>
        <div className="flex flex-col gap-3 text-sm text-secondary-text sm:items-end">
          <Link href="/#how-it-works" className="hover:text-foreground">
            How it works
          </Link>
          <Link href="/#faq" className="hover:text-foreground">
            FAQ
          </Link>
          <Link href="/assessment" className="hover:text-foreground">
            Start
          </Link>
          <p className="pt-2 text-xs text-muted">&copy; {new Date().getFullYear()} MogaFace</p>
        </div>
      </div>
    </footer>
  );
}
