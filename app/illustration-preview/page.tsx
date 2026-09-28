import { LiveIllustrationPreview } from "@/components/illustration-preview/LiveIllustrationPreview";

// TEMPORARY, production-accessible page for testers with a valid access
// code — see lib/image-generation/livePreviewHandler.ts. The security
// boundary is entirely server-side (the /api/illustration-preview route);
// this page itself renders in every environment, including production.
export default function IllustrationPreviewPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <p className="text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">Developer / clinic testing only</p>
      <h1 className="mt-1 font-serif text-3xl tracking-tight">Illustration preview</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        This is a temporary visualization preview. It is not part of the normal consumer experience.
      </p>
      <div className="mt-8">
        <LiveIllustrationPreview />
      </div>
    </main>
  );
}
