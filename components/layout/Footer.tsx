import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-slate-200/80 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-12 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-serif text-2xl font-bold tracking-tight text-slate-900">MogaFace</span>
            <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700 border border-violet-200">
              Clinic Next Face
            </span>
          </div>
          <p className="mt-3 max-w-sm text-xs leading-5 text-slate-500">
            An illustrative pre-consultation aesthetic intelligence simulation for clinical conversations. Not a medical diagnosis, and not a surgical guarantee.
          </p>
        </div>
        <div className="flex flex-col gap-2.5 text-xs font-semibold text-slate-600 sm:items-end">
          <Link href="/#portal" className="hover:text-violet-700 transition-colors">
            Instant AI Simulation
          </Link>
          <Link href="/#transformations" className="hover:text-violet-700 transition-colors">
            Transformations Showcase
          </Link>
          <Link href="/#how-it-works" className="hover:text-violet-700 transition-colors">
            How It Works
          </Link>
          <Link href="/#faq" className="hover:text-violet-700 transition-colors">
            FAQ
          </Link>
          <p className="pt-2 text-[11px] font-normal text-slate-400">&copy; {new Date().getFullYear()} MogaFace / ClinicNextFace. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
