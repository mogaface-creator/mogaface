import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/Button";
import { HeroConsultationPortal } from "@/components/marketing/HeroConsultationPortal";
import { TransformationShowcase } from "@/components/marketing/TransformationShowcase";
import { DossierPreview } from "@/components/marketing/DossierPreview";
import { ValueComparison } from "@/components/marketing/ValueComparison";

const TRUST_METRICS = [
  { value: "60s", label: "Instant AI Processing", sub: "Live on screen & inbox" },
  { value: "1:1.618", label: "Golden Ratio Mapping", sub: "468-point multi-vector balance" },
  { value: "2-Page", label: "Medical-Grade Dossier", sub: "Printable consultation PDF" },
  { value: "100%", label: "Identity Preserved", sub: "Bone structure & melanin locked" },
];

const STEPS = [
  {
    number: "01",
    title: "Instant Upload or Archetype",
    body: "Upload a front-facing selfie, take a camera snapshot, or select a pre-computed clinical archetype. Zero long forms required.",
  },
  {
    number: "02",
    title: "AI Anatomical Scan",
    body: "GPT-4o Vision scans bilateral facial symmetry, tear troughs, mandibular jawline angles, and dermal micro-pores.",
  },
  {
    number: "03",
    title: "Identity-Locked Simulation",
    body: "Our engine applies realistic non-surgical enhancements (Botox, fillers, skin resurfacing) while preserving 100% of your authentic bone structure.",
  },
  {
    number: "04",
    title: "Interactive Slider & PDF Dossier",
    body: "Inspect your simulation using the interactive wipe visualizer and download your luxury 2-page Medical Consultation Dossier immediately.",
  },
];

const QUESTIONS = [
  {
    q: "How does MogaFace create the before and after simulation?",
    a: "MogaFace uses advanced computer vision and medical-grade generative modeling (GPT-4o Vision and chatgpt-image-latest). It maps 468 anatomical facial landmarks, measures Golden Ratio symmetry, and applies targeted soft-tissue harmonizations (such as tear trough volume restoration and mandibular contouring) while strictly locking 100% of your authentic bone structure, eye shape, nose geometry, and natural melanin.",
  },
  {
    q: "How fast do I receive my simulation results?",
    a: "In approximately 60 seconds. Our async pipeline scans your photo, generates the high-resolution simulation, compiles the clinical interpretation, builds the 2-page PDF Dossier, and presents it live on screen with a download link.",
  },
  {
    q: "What is included in the 2-Page Clinical Consultation Dossier?",
    a: "Page 1 features your side-by-side photographic baseline versus targeted simulation, plus your executive clinical summary and symmetry score. Page 2 details your identified anatomical opportunities, target non-surgical modalities (fillers, neuromodulators, peels), and clinic scheduling access.",
  },
  {
    q: "Are my photos kept private and secure?",
    a: "Yes. All photographic data is encrypted and processed strictly for generating your personal dossier. Your data is never sold, shared with third parties, or used for public AI training datasets.",
  },
  {
    q: "Is this a medical prescription or guarantee of outcome?",
    a: "No. MogaFace is an illustrative pre-consultation visual alignment tool designed to help you and your aesthetic doctor visualize potential harmonization. All actual clinical procedures require an in-person physical assessment by a licensed medical practitioner.",
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
        {/* HERO SECTION WITH INSTANT CLINICAL CONSULTATION PORTAL    */}
        {/* ========================================================= */}
        <section className="relative overflow-hidden bg-gradient-to-b from-slate-50/70 via-white to-white pt-8 pb-14 sm:pt-16 sm:pb-24 lg:pt-20 lg:pb-28">
          {/* Subtle Ambient Violet Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[380px] sm:h-[520px] w-full max-w-[900px] rounded-full bg-violet-500/5 blur-[120px] pointer-events-none" />

          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            {/* Hero Header Copy */}
            <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-14">
              <div className="inline-flex items-center gap-2 rounded-full border border-violet-200 bg-violet-50/80 px-3.5 py-1.5 text-xs font-semibold text-violet-700 shadow-2xs">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Next-Generation Clinical AI Aesthetic Engine</span>
              </div>

              <h1 className="mt-4 sm:mt-6 font-serif text-3xl sm:text-5xl lg:text-7xl leading-[1.05] sm:leading-[0.98] tracking-tight text-slate-900 text-balance">
                See your targeted aesthetic potential.
                <span className="mt-1 sm:mt-2 block font-light italic text-violet-700">
                  On your own face, in 60 seconds.
                </span>
              </h1>

              <div aria-hidden className="mx-auto mt-4 sm:mt-6 h-1 w-14 bg-violet-600 rounded-full" />

              <p className="mt-4 sm:mt-6 text-sm sm:text-lg leading-6 sm:leading-8 text-slate-600">
                Snap or upload your photo below. Our clinical AI scans 468 anatomical vectors,
                identifies non-surgical opportunities, and projects an <strong>identity-locked simulation</strong>{" "}
                paired with an executive 2-page Clinical Dossier PDF.
              </p>

              {/* Trust Badges */}
              <div className="mt-5 flex flex-wrap items-center justify-center gap-y-2 gap-x-6 text-xs font-semibold text-slate-600">
                <span className="flex items-center gap-1.5">
                  <svg className="h-4 w-4 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  Instant 60s Processing
                </span>
                <span className="flex items-center gap-1.5">
                  <svg className="h-4 w-4 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  Zero Generic Face-Swaps
                </span>
                <span className="flex items-center gap-1.5">
                  <svg className="h-4 w-4 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  2-Page Dossier PDF
                </span>
                <span className="flex items-center gap-1.5">
                  <svg className="h-4 w-4 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  100% Confidential
                </span>
              </div>
            </div>

            {/* THE INSTANT HERO CONSULTATION PORTAL */}
            <div className="mx-auto max-w-4xl">
              <HeroConsultationPortal />
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* TRUST METRICS RIBBON                                      */}
        {/* ========================================================= */}
        <section aria-label="Key Performance Metrics" className="border-y border-slate-200/80 bg-white">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 sm:gap-8 px-4 sm:px-6 py-8 sm:py-10 lg:grid-cols-4">
            {TRUST_METRICS.map((metric) => (
              <div key={metric.label} className="text-center sm:text-left p-2">
                <p className="font-serif text-2xl sm:text-4xl font-bold tracking-tight text-slate-900">
                  {metric.value}
                </p>
                <p className="mt-0.5 sm:mt-1 font-heading text-xs sm:text-sm font-bold text-slate-800">{metric.label}</p>
                <p className="text-[11px] sm:text-xs text-slate-500">{metric.sub}</p>
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
        <section id="how-it-works" className="scroll-mt-20 border-t border-slate-200/80 bg-white py-16 sm:py-24 lg:py-32">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <p className="eyebrow text-xs">The Pathway</p>
              <h2 className="mt-3 font-serif text-3xl sm:text-5xl leading-[1.05] tracking-tight text-slate-900">
                Four simple steps, from your photo
                <span className="block font-light italic text-violet-700">to a tangible clinical dossier.</span>
              </h2>
            </div>

            <ol className="mt-10 sm:mt-16 grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((step) => (
                <li
                  key={step.number}
                  className="relative flex flex-col justify-between rounded-3xl border border-slate-200/90 bg-slate-50/60 p-6 shadow-xs hover:shadow-md hover:border-slate-300 transition-all"
                >
                  <div>
                    <span className="font-serif text-2xl sm:text-3xl font-bold text-violet-600/40 tabular-nums">
                      {step.number}
                    </span>
                    <h3 className="mt-3 sm:mt-4 font-heading text-lg sm:text-xl font-bold text-slate-900">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-xs leading-5 sm:leading-6 text-slate-600">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ========================================================= */}
        {/* MEDICAL INTEGRITY STATEMENT                               */}
        {/* ========================================================= */}
        <section className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 py-14 sm:py-20 text-white">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 text-center">
            <p className="eyebrow text-violet-300 text-xs">Clinical Standards</p>
            <h2 className="mt-2 sm:mt-3 font-serif text-2xl sm:text-4xl text-balance">
              Designed for clinical alignment, not unrealistic fantasy.
            </h2>
            <p className="mx-auto mt-3 sm:mt-4 max-w-2xl text-xs sm:text-sm leading-6 sm:leading-7 text-slate-300">
              MogaFace does not distort your skull, change your ethnicity, or generate plastic cartoon faces.
              Every vector calculation is grounded in real surgical and dermatological tissue mechanics to give
              you an achievable, elegant visual communication tool.
            </p>
          </div>
        </section>

        {/* ========================================================= */}
        {/* FREQUENTLY ASKED QUESTIONS                                */}
        {/* ========================================================= */}
        <section id="faq" className="scroll-mt-20 border-t border-slate-200/80 bg-slate-50/50 py-16 sm:py-24 lg:py-32">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="text-center max-w-xl mx-auto">
              <p className="eyebrow text-xs">Questions &amp; Answers</p>
              <h2 className="mt-3 font-serif text-3xl sm:text-5xl leading-[1.05] tracking-tight text-slate-900">
                Frequently asked questions.
              </h2>
            </div>

            <div className="mx-auto mt-8 sm:mt-12 max-w-3xl divide-y divide-slate-200">
              {QUESTIONS.map((item) => (
                <details key={item.q} className="group py-4 sm:py-6">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-4 font-heading text-base sm:text-lg font-semibold text-slate-900 marker:content-none [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <span aria-hidden className="font-serif text-xl sm:text-2xl leading-none text-violet-700 transition-transform group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 sm:mt-4 text-xs sm:text-sm leading-6 sm:leading-7 text-slate-600">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* FINAL CONVERSION CALL TO ACTION                           */}
        {/* ========================================================= */}
        <section className="border-t border-slate-200/80 bg-white py-16 sm:py-24 lg:py-32">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 text-center">
            <h2 className="font-serif text-3xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-tight text-slate-900 text-balance">
              Ready to see your targeted aesthetic potential?
            </h2>
            <div aria-hidden className="mx-auto mt-6 sm:mt-8 h-1 w-16 bg-violet-600 rounded-full" />
            <p className="mx-auto mt-6 sm:mt-8 max-w-xl text-sm sm:text-lg leading-6 sm:leading-7 text-slate-600">
              Try the instant AI consultation today. Discover your Golden Ratio balance and receive your
              confidential 2-page Medical Dossier directly on screen and in your inbox.
            </p>
            <div className="mt-8 sm:mt-10 flex justify-center">
              <a href="#portal" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto justify-center shadow-elevated">
                  Try AI Simulation Now
                </Button>
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
