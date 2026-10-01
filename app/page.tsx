import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/Button";
import { MeasurementDiagram } from "@/components/marketing/MeasurementDiagram";

const FACTS = [
  { title: "Your answers", body: "You name the places. The picture follows those places." },
  { title: "Your photos", body: "Front, left, and right. The after is the same person in the same photo." },
  { title: "A clinician", body: "The preview starts the conversation. A clinician decides the next step." },
];

const STEPS = [
  {
    number: "01",
    title: "Tell us what you notice",
    body: "A short set of questions about the places you care about. You can be specific, or leave a place general. Nothing here is a diagnosis.",
  },
  {
    number: "02",
    title: "Share three photos",
    body: "A front view, then a left and a right three-quarter view. A short video is optional. The front photo is the one that becomes the pair.",
  },
  {
    number: "03",
    title: "See an illustrative after",
    body: "Same person, same pose, same room. Only the places you named are changed, and each change is meant to be easy to see beside the original.",
  },
  {
    number: "04",
    title: "The clinic follows up",
    body: "Your name, phone, email, and city are how they reach you. The illustration is not a promise, and it does not name a procedure.",
  },
];

const AREAS = ["Expression lines", "Facial contour", "Under-eye", "Skin", "Hair"];

const RECEIVE = [
  "A before and after of your own front photo",
  "The places you selected, named in plain words",
  "A short written summary of what you told us",
  "A way for the clinic to reach you",
];

const DOES_NOT = [
  "Diagnose a condition",
  "Name a procedure",
  "Promise an outcome",
  "Score your face or guess your age",
];

const QUESTIONS = [
  {
    q: "What is MogaFace?",
    a: "A way to see an illustrative after of the places you care about, made from your own front photo, before you sit down with the clinic.",
  },
  {
    q: "What do I need to start?",
    a: "Your name, phone, email, and city. Answers about what you notice. Three photos: front, left three-quarter, and right three-quarter. A short video is optional.",
  },
  {
    q: "What will I receive?",
    a: "An illustrative before and after of your front photo, and a short summary of what you told us. The clinic uses your details to follow up.",
  },
  {
    q: "Is this a diagnosis or a treatment plan?",
    a: "No. It does not name a procedure and it does not promise a result. A clinician decides what, if anything, comes next.",
  },
  {
    q: "How long does it take?",
    a: "The illustration is prepared once your answers and photos are in. It is not a report that takes weeks to write.",
  },
  {
    q: "Where do my photos go?",
    a: "Reading the photo for facial landmarks stays in your browser. Creating the illustrative after sends the front photo to the image service. Your name, phone, email, and city are saved so the clinic can reach you.",
  },
];

export default function Home() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-6 pt-20 pb-16 sm:pt-28 sm:pb-20">
          <p className="eyebrow text-[11px]">Before the visit</p>
          <h1 className="mt-6 max-w-4xl font-serif text-6xl leading-[0.92] tracking-tight text-balance sm:text-7xl lg:text-8xl">
            See the change
            <span className="mt-1 block font-light italic">on your own face.</span>
          </h1>
          <div aria-hidden className="mt-8 h-px w-16 bg-accent" />
          <p className="mt-8 max-w-xl text-lg leading-8 text-body-text">
            A few questions and three photos. Then an illustrative after of the places you named, in the same pose and the same room. A clinician decides what comes next.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-6">
            <Link href="/assessment">
              <Button>Start</Button>
            </Link>
            <Link href="#how-it-works" className="text-sm text-foreground underline decoration-accent decoration-1 underline-offset-4 hover:text-accent">
              How it works
            </Link>
          </div>
        </section>

        <section aria-label="What this uses" className="border-t border-border">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 sm:grid-cols-3 sm:gap-8">
            {FACTS.map((fact) => (
              <div key={fact.title}>
                <p className="font-heading text-lg">{fact.title}</p>
                <p className="mt-2 max-w-xs text-sm leading-6 text-muted">{fact.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="why" className="scroll-mt-20 border-t border-border bg-surface-warm">
          <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 py-24 lg:grid-cols-[0.9fr_1.1fr] lg:py-28">
            <div>
              <p className="eyebrow text-[11px]">The pair</p>
              <h2 className="mt-5 max-w-md font-serif text-4xl leading-[1.05] tracking-tight text-balance sm:text-5xl">
                The same photo, with the places you named easy to see.
              </h2>
              <p className="mt-6 max-w-md text-base leading-7 text-body-text">
                Identity, pose, lighting, clothing, and background stay as they are. The after is an illustration of selected places. It is not a new face, and it is not a result you have been promised.
              </p>
            </div>
            <figure>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {["Before", "Illustrative after"].map((label) => (
                  <div key={label} className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-border bg-background">
                    <div className="absolute inset-x-8 top-6 bottom-16">
                      <MeasurementDiagram />
                    </div>
                    <span className="absolute bottom-3 left-3 rounded-full bg-dark-surface/92 px-3 py-1 text-[11px] tracking-wide text-dark-foreground">
                      {label}
                    </span>
                  </div>
                ))}
              </div>
              <figcaption className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-dark-surface text-dark-foreground sm:grid-cols-5">
                {AREAS.map((area) => (
                  <p key={area} className="px-3 py-3 text-center text-[11px] leading-4 tracking-wide">
                    {area}
                  </p>
                ))}
              </figcaption>
            </figure>
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-20 border-t border-border">
          <div className="mx-auto max-w-6xl px-6 py-24 lg:py-28">
            <p className="eyebrow text-[11px]">How it works</p>
            <h2 className="mt-5 max-w-xl font-serif text-4xl leading-[1.05] tracking-tight text-balance sm:text-5xl">
              Four steps, from your answers to a picture the clinic can talk through.
            </h2>
            <ol className="mt-16 border-t border-border">
              {STEPS.map((step) => (
                <li key={step.number} className="grid gap-3 border-b border-border py-8 sm:grid-cols-[6rem_1fr] sm:gap-10 sm:py-10">
                  <span className="font-sans text-sm tracking-[0.22em] text-muted tabular-nums">{step.number}</span>
                  <div className="max-w-xl">
                    <h3 className="font-heading text-2xl">{step.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-body-text">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-t border-border bg-surface">
          <div className="mx-auto grid max-w-6xl gap-16 px-6 py-24 lg:grid-cols-2 lg:py-28">
            <div>
              <p className="eyebrow text-[11px]">What you receive</p>
              <h2 className="mt-5 font-serif text-4xl leading-[1.05] tracking-tight">A preview, then a conversation.</h2>
              <ul className="mt-10 space-y-4">
                {RECEIVE.map((item) => (
                  <li key={item} className="border-t border-border pt-4 text-sm leading-6 text-body-text">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="eyebrow text-[11px]">What this is not</p>
              <h2 className="mt-5 font-serif text-4xl leading-[1.05] tracking-tight">No scores. No verdict.</h2>
              <ul className="mt-10 space-y-4">
                {DOES_NOT.map((item) => (
                  <li key={item} className="border-t border-border pt-4 text-sm leading-6 text-body-text">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="bg-dark-surface text-dark-foreground">
          <div className="mx-auto max-w-6xl px-6 py-24 lg:py-28">
            <p className="font-label text-[11px] uppercase tracking-[0.32em] text-gold">The next step</p>
            <h2 className="mt-5 max-w-2xl font-serif text-4xl leading-[1.05] tracking-tight text-balance sm:text-5xl">
              A clinician still decides.
            </h2>
            <p className="mt-6 max-w-xl text-base leading-7 text-dark-body">
              The after image is a way to look at the places you named. It is not a treatment plan, and it is not a guarantee of how you will look.
            </p>
          </div>
        </section>

        <section id="faq" className="scroll-mt-20 border-t border-border">
          <div className="mx-auto max-w-6xl px-6 py-24 lg:py-28">
            <p className="eyebrow text-[11px]">Questions</p>
            <h2 className="mt-5 max-w-md font-serif text-4xl leading-[1.05] tracking-tight sm:text-5xl">Before you start.</h2>
            <div className="mt-12 max-w-3xl border-b border-border">
              {QUESTIONS.map((item) => (
                <details key={item.q} className="group border-t border-border py-5">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-6 font-heading text-lg marker:content-none [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <span aria-hidden className="font-serif text-2xl leading-none text-muted transition-transform group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-body-text">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto max-w-6xl px-6 py-28">
            <h2 className="max-w-xl font-serif text-5xl leading-[0.95] tracking-tight text-balance sm:text-6xl">
              Start with your own face.
            </h2>
            <div aria-hidden className="mt-8 h-px w-16 bg-accent" />
            <div className="mt-8">
              <Link href="/assessment">
                <Button>Start</Button>
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
