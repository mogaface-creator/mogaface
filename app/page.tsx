import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/Button";
import { BeforeAfterToggle } from "@/components/marketing/BeforeAfterToggle";
import { TransformationShowcase } from "@/components/marketing/TransformationShowcase";
import { DossierPreview } from "@/components/marketing/DossierPreview";
import { ValueComparison } from "@/components/marketing/ValueComparison";

const TRUST_METRICS = [
  { value: "60s", label: "Fast AI Processing", sub: "Delivered to your inbox" },
  { value: "1:1.618", label: "Golden Ratio Mapping", sub: "Multi-vector facial balance" },
  { value: "2-Page", label: "Medical-Grade Dossier", sub: "Printable consultation PDF" },
  { value: "100%", label: "Identity Preserved", sub: "Natural anatomy, never artificial" },
];

const STEPS = [
  {
    number: "01",
    title: "Select Your Aesthetic Focus",
    body: "Tell us what areas you care about — jawline contour, tear troughs, midface volume, or skin tone. Everything is confidential.",
  },
  {
    number: "02",
    title: "Capture 3 Diagnostic Angles",
    body: "Upload a front perspective, plus optional left and right 45° views. Natural lighting gives our computer vision engine the highest accuracy.",
  },
  {
    number: "03",
    title: "AI Simulation & Harmonization",
    body: "Our facial architecture engine analyzes your unique landmarks and projects targeted structural enhancements in exactly 60 seconds.",
  },
  {
    number: "04",
    title: "Receive Your Clinical Dossier",
    body: "Open your email to find your branded 2-page PDF report with side-by-side photographic evidence to present at your clinic consultation.",
  },
];

const QUESTIONS = [
  {
    q: "How does MogaFace create the before and after simulation?",
    a: "MogaFace uses advanced computer vision and medical-grade facial modeling. It maps facial landmarks, measures Golden Ratio symmetry, and applies targeted soft-tissue harmonizations (such as tear trough volume restoration and mandibular sharpening) while preserving 100% of your authentic bone structure and identity.",
  },
  {
    q: "How fast do I receive my results?",
    a: "In approximately 60 seconds. Our async job runner processes your photos, generates the high-resolution simulation, compiles the clinical interpretation, builds the 2-page PDF Dossier, and sends it directly to your email address.",
  },
  {
    q: "What is included in the 2-Page Clinical Dossier?",
    a: "Page 1 features your side-by-side photographic baseline versus targeted simulation and executive clinical summary. Page 2 details your identified anatomical opportunities, stated priorities, and direct consultation scheduling access.",
  },
  {
    q: "Are my photos kept private and secure?",
    a: "Yes. All photographic data is encrypted and processed strictly for generating your personal dossier. Your data is never sold, shared with third parties, or used for public AI training.",
  },
  {
    q: "Is this a medical prescription or guarantee of outcome?",
    a: "No. MogaFace is an illustrative pre-consultation communication tool designed to help you and your aesthetic practitioner visualize potential harmonization. All actual clinical procedures require an in-person physical assessment by a licensed medical practitioner.",
  },
  {
    q: "Can I take this PDF report to my doctor or aesthetician?",
    a: "Absolutely. In fact, that is the primary goal. Your dossier includes a confidential reference ID and structured anatomical findings that help your doctor understand exactly what aesthetic balance you are targeting.",
  },
];

export default function Home() {
  return (
    <>
      <Header />
      <main className="flex-1">
        {/* ========================================================= */}
        {/* HERO SECTION WITH INTERACTIVE BEFORE/AFTER SPOTLIGHT      */}
        {/* ========================================================= */}
        <section className="relative overflow-hidden bg-gradient-to-b from-surface-warm/60 via-background to-background pt-8 pb-14 sm:pt-20 sm:pb-24 lg:pt-24 lg:pb-28">
          {/* Subtle Ambient Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[350px] sm:h-[500px] w-full max-w-[800px] rounded-full bg-accent/8 blur-[100px] sm:blur-[120px] pointer-events-none" />

          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="grid gap-8 lg:gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              {/* Hero Copy */}
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/5 px-3 py-1 sm:px-3.5 sm:py-1.5 text-[11px] sm:text-xs font-semibold text-accent backdrop-blur-xs">
                  <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
                  AI Clinical Facial Architecture
                </div>

                <h1 className="mt-4 sm:mt-6 font-serif text-3xl sm:text-5xl lg:text-7xl leading-[1.05] sm:leading-[0.98] tracking-tight text-balance">
                  See your targeted aesthetic potential.
                  <span className="mt-1 sm:mt-2 block font-light italic text-accent">
                    On your own face, in 60 seconds.
                  </span>
                </h1>

                <div aria-hidden className="mt-4 sm:mt-8 h-px w-16 sm:w-20 bg-accent" />

                <p className="mt-4 sm:mt-8 max-w-xl text-sm sm:text-lg leading-6 sm:leading-8 text-body-text">
                  Upload your photos and discover your bespoke facial symmetry, contour harmonization,
                  and 3D aesthetic simulation. Delivered as a confidential <strong>2-page Clinical Dossier</strong>{" "}
                  straight to your email.
                </p>

                {/* Trust Badges */}
                <div className="mt-5 sm:mt-6 flex flex-wrap items-center gap-y-2 gap-x-4 sm:gap-x-6 text-xs font-medium text-secondary-text">
                  <span className="flex items-center gap-1.5">
                    <svg className="h-4 w-4 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    60-Second Turnaround
                  </span>
                  <span className="flex items-center gap-1.5">
                    <svg className="h-4 w-4 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    2-Page PDF Dossier
                  </span>
                  <span className="flex items-center gap-1.5">
                    <svg className="h-4 w-4 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    100% Confidential
                  </span>
                </div>

                {/* CTAs */}
                <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-5">
                  <Link href="/assessment" className="w-full sm:w-auto">
                    <Button size="lg" className="w-full sm:w-auto justify-center shadow-elevated">
                      Start Your Facial Assessment
                    </Button>
                  </Link>
                  <a
                    href="#transformations"
                    className="inline-flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:text-accent"
                  >
                    View Transformations
                    <span aria-hidden>↓</span>
                  </a>
                </div>
              </div>

              {/* Hero Spotlight: Interactive Before/After Slider */}
              <div className="relative mx-auto w-full max-w-md lg:max-w-none">
                <div className="relative rounded-2xl sm:rounded-3xl border border-border/80 bg-surface-warm p-3 sm:p-4 shadow-elevated">
                  <div className="mb-2.5 flex items-center justify-between px-1 sm:px-2">
                    <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-accent">
                      Live Comparison Simulation
                    </span>
                    <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-[10px] font-bold text-accent">
                      Interactive
                    </span>
                  </div>

                  <BeforeAfterToggle
                    beforeSrc="/images/transformations/female_studio_before.webp"
                    afterSrc="/images/transformations/female_studio_after.webp"
                    beforeLabel="Baseline Profile"
                    afterLabel="Targeted Simulation"
                    aspectRatio="aspect-[4/5]"
                    className="w-full"
                  />

                  <div className="mt-3 sm:mt-4 flex items-center justify-between rounded-xl bg-background/80 p-2.5 sm:p-3 text-xs">
                    <div>
                      <p className="font-bold text-foreground text-xs sm:text-sm">Targeted Vector:</p>
                      <p className="text-muted text-[11px] sm:text-xs">Tear Trough &amp; Midface Harmony</p>
                    </div>
                    <span className="font-serif font-bold text-accent text-xs sm:text-sm">+35% Volume Lift</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* TRUST METRICS RIBBON                                      */}
        {/* ========================================================= */}
        <section aria-label="Key Performance Metrics" className="border-y border-border bg-surface">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 sm:gap-8 px-4 sm:px-6 py-8 sm:py-10 lg:grid-cols-4">
            {TRUST_METRICS.map((metric) => (
              <div key={metric.label} className="text-center sm:text-left p-2">
                <p className="font-serif text-2xl sm:text-4xl font-bold tracking-tight text-foreground">
                  {metric.value}
                </p>
                <p className="mt-0.5 sm:mt-1 font-heading text-xs sm:text-sm font-bold text-foreground">{metric.label}</p>
                <p className="text-[11px] sm:text-xs text-muted">{metric.sub}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ========================================================= */}
        {/* TRANSFORMATION SHOWCASE (iMorph-style rich gallery)       */}
        {/* ========================================================= */}
        <TransformationShowcase />

        {/* ========================================================= */}
        {/* THE 2-PAGE CLINICAL DOSSIER PREVIEW                       */}
        {/* ========================================================= */}
        <DossierPreview />

        {/* ========================================================= */}
        {/* VALUE & FRICTION COMPARISON                               */}
        {/* ========================================================= */}
        <ValueComparison />

        {/* ========================================================= */}
        {/* HOW IT WORKS (4 Step Pathway)                             */}
        {/* ========================================================= */}
        <section id="how-it-works" className="scroll-mt-20 border-t border-border bg-background py-16 sm:py-24 lg:py-32">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <p className="eyebrow text-[11px]">The Pathway</p>
              <h2 className="mt-3 font-serif text-3xl sm:text-5xl leading-[1.05] tracking-tight">
                Four simple steps, from your photos
                <span className="block font-light italic text-accent">to a tangible clinical dossier.</span>
              </h2>
            </div>

            <ol className="mt-10 sm:mt-16 grid gap-4 sm:gap-8 md:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step) => (
                <li
                  key={step.number}
                  className="relative flex flex-col justify-between rounded-2xl sm:rounded-3xl border border-border bg-surface-warm p-5 sm:p-8 shadow-subtle transition-all hover:shadow-medium"
                >
                  <div>
                    <span className="font-serif text-2xl sm:text-3xl font-bold text-accent/40 tabular-nums">
                      {step.number}
                    </span>
                    <h3 className="mt-3 sm:mt-4 font-heading text-lg sm:text-xl font-bold text-foreground">
                      {step.title}
                    </h3>
                    <p className="mt-2 sm:mt-3 text-xs leading-5 sm:leading-6 text-body-text">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ========================================================= */}
        {/* MEDICAL INTEGRITY STATEMENT                               */}
        {/* ========================================================= */}
        <section className="bg-dark-surface py-14 sm:py-20 text-dark-foreground">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 text-center">
            <p className="eyebrow text-gold text-[11px]">Clinical Standards</p>
            <h2 className="mt-2 sm:mt-3 font-serif text-2xl sm:text-4xl text-balance">
              Designed for clinical alignment, not unrealistic fantasy.
            </h2>
            <p className="mx-auto mt-3 sm:mt-4 max-w-2xl text-xs sm:text-sm leading-6 sm:leading-7 text-dark-body">
              MogaFace does not distort your skull, change your ethnicity, or generate plastic cartoon faces.
              Every vector calculation is grounded in real surgical and dermatological tissue mechanics to give
              you an achievable, elegant visual communication tool.
            </p>
          </div>
        </section>

        {/* ========================================================= */}
        {/* FREQUENTLY ASKED QUESTIONS                                */}
        {/* ========================================================= */}
        <section id="faq" className="scroll-mt-20 border-t border-border bg-surface py-16 sm:py-24 lg:py-32">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="text-center max-w-xl mx-auto">
              <p className="eyebrow text-[11px]">Questions &amp; Answers</p>
              <h2 className="mt-3 font-serif text-3xl sm:text-5xl leading-[1.05] tracking-tight">
                Frequently asked questions.
              </h2>
            </div>

            <div className="mx-auto mt-8 sm:mt-12 max-w-3xl divide-y divide-border">
              {QUESTIONS.map((item) => (
                <details key={item.q} className="group py-4 sm:py-6">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-4 font-heading text-base sm:text-lg font-semibold text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <span aria-hidden className="font-serif text-xl sm:text-2xl leading-none text-accent transition-transform group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 sm:mt-4 text-xs sm:text-sm leading-6 sm:leading-7 text-body-text">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* FINAL CONVERSION CALL TO ACTION                           */}
        {/* ========================================================= */}
        <section className="border-t border-border bg-gradient-to-b from-background to-surface-warm py-16 sm:py-24 lg:py-32">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 text-center">
            <h2 className="font-serif text-3xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-tight text-balance">
              Ready to see your targeted aesthetic potential?
            </h2>
            <div aria-hidden className="mx-auto mt-6 sm:mt-8 h-px w-16 sm:w-20 bg-accent" />
            <p className="mx-auto mt-6 sm:mt-8 max-w-xl text-sm sm:text-lg leading-6 sm:leading-7 text-body-text">
              Take the 60-second assessment today. Discover your Golden Ratio balance and receive your
              confidential 2-page Medical Dossier directly in your inbox.
            </p>
            <div className="mt-8 sm:mt-10 flex justify-center">
              <Link href="/assessment" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto justify-center shadow-elevated">
                  Start Your Free Assessment
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
