import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/Button";
import { MeasurementDiagram } from "@/components/marketing/MeasurementDiagram";
import {
  ArrowsLeftRight,
  Eye,
  Rows,
  Ruler,
  ShieldCheck,
  SmileyBlank,
  Triangle,
  TriangleDashed,
} from "@phosphor-icons/react/ssr";

const STEPS = [
  { number: "01", title: "Upload", body: "Provide one clear, front-facing photo. It never leaves your device." },
  { number: "02", title: "Analyze", body: "Computer vision detects your face and maps its geometry." },
  { number: "03", title: "Understand", body: "Review structured, measurable results. No scores, no verdicts." },
];

const CATEGORIES = [
  { label: "Facial proportions", icon: Ruler },
  { label: "Geometric symmetry", icon: ArrowsLeftRight },
  { label: "Facial thirds", icon: Rows },
  { label: "Eye measurements", icon: Eye },
  { label: "Nose measurements", icon: Triangle },
  { label: "Mouth measurements", icon: SmileyBlank },
  { label: "Jaw measurements", icon: TriangleDashed },
];

const STATS = [
  { value: CATEGORIES.length.toString(), label: "measurement categories" },
  { value: "1", label: "photo needed to start" },
  { value: "0", label: "photos sent to a server" },
];

export default function Home() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pt-16 pb-20 sm:pt-20 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:pb-28">
          <div>
            <h1 className="max-w-xl font-serif text-5xl leading-tight tracking-tight sm:text-6xl">
              Understand Your Face.
            </h1>
            <p className="mt-6 max-w-md text-lg leading-8 text-muted">
              Explore measurable facial proportions, symmetry and features using computer vision.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link href="/assessment">
                <Button>Start analysis</Button>
              </Link>
              <Link href="#what-we-measure">
                <Button variant="secondary">See what&apos;s measured</Button>
              </Link>
            </div>
          </div>
          <div className="rounded-3xl border border-border bg-surface p-10">
            <div className="mx-auto aspect-[10/13] max-w-[220px]">
              <MeasurementDiagram />
            </div>
          </div>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto grid max-w-6xl grid-cols-3 gap-6 px-6 py-10">
            {STATS.map((stat) => (
              <div key={stat.label}>
                <p className="font-serif text-4xl tracking-tight sm:text-5xl">{stat.value}</p>
                <p className="mt-1 text-sm text-muted">{stat.label}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="what-we-measure" className="border-t border-border bg-surface">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <h2 className="font-serif text-3xl tracking-tight">What we analyze</h2>

            <div className="mt-10 flex flex-col items-center gap-6 rounded-2xl border border-border bg-background p-8 sm:flex-row sm:gap-10">
              <div className="aspect-[10/13] w-full max-w-[140px] shrink-0">
                <MeasurementDiagram />
              </div>
              <p className="text-sm leading-6 text-muted sm:max-w-md">
                Every category below is derived from the same landmark map, giving consistent, comparable
                measurements across your face.
              </p>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
              {CATEGORIES.slice(0, 3).map(({ label, icon: Icon }) => (
                <div
                  key={label}
                  className="rounded-2xl border border-border bg-background px-5 py-6 text-sm font-medium text-foreground"
                >
                  <Icon size={22} weight="light" className="text-accent" />
                  <p className="mt-4">{label}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {CATEGORIES.slice(3).map(({ label, icon: Icon }) => (
                <div
                  key={label}
                  className="rounded-2xl border border-border bg-background px-5 py-6 text-sm font-medium text-foreground"
                >
                  <Icon size={22} weight="light" className="text-accent" />
                  <p className="mt-4">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="border-t border-border">
          <div className="mx-auto max-w-6xl px-6 py-24">
            <h2 className="font-serif text-3xl tracking-tight">How it works</h2>
            <div className="mt-14 grid gap-10 sm:grid-cols-3">
              {STEPS.map((step) => (
                <div key={step.number} className="border-t border-border pt-6">
                  <span className="font-serif text-4xl text-muted">{step.number}</span>
                  <h3 className="mt-4 text-lg font-medium">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted">{step.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-border bg-accent text-accent-foreground">
          <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-6 py-20 sm:flex-row sm:items-center">
            <ShieldCheck size={40} weight="light" className="shrink-0" />
            <div>
              <h2 className="font-serif text-3xl tracking-tight">Privacy, by design</h2>
              <p className="mt-4 max-w-2xl text-base leading-7 opacity-90">
                Your facial analysis is designed to process your image securely. During the initial prototype,
                analysis runs locally in your browser. Your photo is never uploaded to a server.
              </p>
            </div>
          </div>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto max-w-6xl px-6 py-28 text-center">
            <h2 className="mx-auto max-w-lg font-serif text-3xl tracking-tight sm:text-4xl">
              Ready to explore your facial geometry?
            </h2>
            <div className="mt-8 flex justify-center">
              <Link href="/assessment">
                <Button>Start analysis</Button>
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
