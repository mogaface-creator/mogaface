import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export const metadata = {
  title: "We're preparing your results — MogaFace",
  description: "Your personalized before & after report is being prepared and will be emailed to you shortly.",
};

export default function SubmittedPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-2xl px-6 py-24 sm:py-32">
          {/* Icon */}
          <div className="flex justify-center">
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-accent/10">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="h-10 w-10 text-accent"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                />
              </svg>
            </span>
          </div>

          {/* Heading */}
          <div className="mt-10 text-center">
            <p className="eyebrow text-[11px]">Assessment received</p>
            <h1 className="mt-5 font-serif text-4xl leading-[1.05] tracking-tight text-balance sm:text-5xl">
              Your results are being prepared.
            </h1>
            <div aria-hidden className="mx-auto mt-8 h-px w-16 bg-accent" />
            <p className="mx-auto mt-8 max-w-md text-base leading-7 text-body-text">
              We&apos;re analyzing your photos and building your personalized before &amp; after report. You&apos;ll
              receive it by email in around <strong>30 minutes</strong>.
            </p>
          </div>

          {/* What to expect */}
          <div className="mt-16 rounded-2xl border border-border bg-surface p-8">
            <p className="eyebrow text-[11px]">What&apos;s in your email</p>
            <ul className="mt-6 space-y-4">
              {[
                "Your original front photo alongside the AI-generated after",
                "A plain-words summary of the areas you selected",
                "The treatment areas your photos and answers pointed to",
                "How to get in touch with the clinic to discuss next steps",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 border-t border-border pt-4 text-sm leading-6 text-body-text">
                  <span className="mt-0.5 flex-shrink-0 text-accent" aria-hidden>—</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Small reassurance */}
          <p className="mt-8 text-center text-sm text-muted">
            Didn&apos;t get the email after 30 minutes? Check your spam folder, or{" "}
            <Link href="/" className="underline decoration-accent underline-offset-4 hover:text-accent">
              start a new assessment
            </Link>
            .
          </p>

          <div className="mt-12 flex justify-center">
            <Link href="/">
              <Button variant="secondary">Back to home</Button>
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
