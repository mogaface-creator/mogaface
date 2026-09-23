import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/Button";

const STEPS = [
  { number: "01", title: "Upload", body: "Provide one clear, front-facing photo. It never leaves your device." },
  { number: "02", title: "Analyze", body: "Computer vision detects your face and maps its geometry." },
  { number: "03", title: "Understand", body: "Review structured, measurable results — no scores, no verdicts." },
];

const CATEGORIES = [
  "Facial proportions",
  "Geometric symmetry",
  "Eye measurements",
  "Nose measurements",
  "Mouth measurements",
  "Jaw measurements",
  "Facial thirds",
];

export default function Home() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-6 py-28 sm:py-36">
          <p className="text-sm font-medium tracking-wide text-muted uppercase">Computer-vision facial analysis</p>
          <h1 className="mt-4 max-w-2xl font-serif text-5xl leading-tight tracking-tight sm:text-6xl">
            Understand Your Face.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-muted">
            Explore measurable facial proportions, symmetry and features using computer vision.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link href="/analyze">
              <Button>Start Your Analysis</Button>
            </Link>
            <Link href="#how-it-works">
              <Button variant="secondary">How It Works</Button>
            </Link>
          </div>
        </section>

        <section id="how-it-works" className="border-t border-border bg-surface">
          <div className="mx-auto max-w-5xl px-6 py-24">
            <h2 className="font-serif text-3xl tracking-tight">How it works</h2>
            <div className="mt-12 grid gap-10 sm:grid-cols-3">
              {STEPS.map((step) => (
                <div key={step.number}>
                  <span className="font-serif text-4xl text-muted">{step.number}</span>
                  <h3 className="mt-4 text-lg font-medium">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto max-w-5xl px-6 py-24">
            <h2 className="font-serif text-3xl tracking-tight">What we analyze</h2>
            <ul className="mt-10 grid gap-3 sm:grid-cols-2">
              {CATEGORIES.map((category) => (
                <li
                  key={category}
                  className="rounded-xl border border-border bg-surface px-5 py-4 text-sm text-foreground"
                >
                  {category}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-t border-border bg-surface">
          <div className="mx-auto max-w-5xl px-6 py-24">
            <h2 className="font-serif text-3xl tracking-tight">Privacy, by design</h2>
            <p className="mt-6 max-w-2xl text-base leading-7 text-muted">
              Your facial analysis is designed to process your image securely. During the initial prototype,
              analysis runs locally in your browser — your photo is never uploaded to a server.
            </p>
          </div>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto max-w-5xl px-6 py-24 text-center">
            <h2 className="font-serif text-3xl tracking-tight">Ready to explore your facial geometry?</h2>
            <div className="mt-8 flex justify-center">
              <Link href="/analyze">
                <Button>Start Your Analysis</Button>
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
