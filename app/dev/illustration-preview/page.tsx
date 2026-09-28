import { notFound } from "next/navigation";
import { IllustrationPreviewWorkbench } from "@/components/dev/IllustrationPreviewWorkbench";

// Development tool only: production builds render a 404 here. Nothing on
// this page is consumer-facing; the chosen photo is never stored, and the
// generation call still independently requires the server to have
// NODE_ENV=development AND DEV_ILLUSTRATION_TEST=1 (see devTestHandler.ts) —
// this page cannot bypass that on its own.
export default function IllustrationPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <p className="text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">Development only — not part of the consumer product</p>
      <h1 className="mt-1 font-serif text-3xl tracking-tight">Illustration preview</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        A developer-only Before → Illustrative After preview using a real, locally-chosen photo and the real image-generation pipeline (see{" "}
        <a href="/dev/calibration" className="underline">
          /dev/calibration
        </a>{" "}
        for the engineering calibration tools).
      </p>
      <div className="mt-8">
        <IllustrationPreviewWorkbench />
      </div>
    </main>
  );
}
