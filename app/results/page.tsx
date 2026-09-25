import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { ResultsExperience } from "@/components/results/ResultsExperience";

// The consumer results experience. The original measurement view (developer
// output from /analyze) is still available as a fallback inside
// ResultsExperience; it is not what a person completing an assessment sees.
export default function ResultsPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-6 py-16 sm:py-24">
          <ResultsExperience />
        </div>
      </main>
      <Footer />
    </>
  );
}
