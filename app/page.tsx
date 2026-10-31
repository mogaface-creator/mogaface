import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { AsSeenInMarquee } from "@/components/marketing/AsSeenInMarquee";
import { TransformationShowcase } from "@/components/marketing/TransformationShowcase";
import { QovesWhyGlowUp } from "@/components/marketing/QovesWhyGlowUp";
import { QovesCompleteAnalysis } from "@/components/marketing/QovesCompleteAnalysis";
import { QovesAssessmentsExplorer } from "@/components/marketing/QovesAssessmentsExplorer";
import { QovesTechnology } from "@/components/marketing/QovesTechnology";
import { QovesHowItWorks } from "@/components/marketing/QovesHowItWorks";
import { ValueComparison } from "@/components/marketing/ValueComparison";
import { QovesFaqSection } from "@/components/marketing/QovesFaqSection";

export default function Home() {
  return (
    <>
      <Header />
      <main className="flex-1 bg-white">
        {/* ========================================================= */}
        {/* HERO SECTION — EXACT QOVES AESTHETIC & COPY               */}
        {/* ========================================================= */}
        <section className="relative overflow-hidden bg-white pt-12 pb-16 sm:pt-20 sm:pb-24">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="text-center max-w-3xl mx-auto">
              {/* Type pill: Join 80,000+ people */}
              <div className="inline-flex items-center gap-2 rounded-full border border-[#e2e7e9] bg-[#f5f8f9] px-4 py-1.5 text-xs font-medium text-[#46575d]">
                <span className="h-2 w-2 rounded-full bg-[#182327]" />
                <span>Join <strong>80,000+</strong> people</span>
              </div>

              {/* Main Headline */}
              <h1 className="mt-6 text-4xl sm:text-6xl lg:text-7xl font-medium tracking-tight text-[#141e22] leading-[1.08]">
                <span>Improve your looks</span>{" "}
                <span className="block font-light text-[#84979e]">without surgery</span>
              </h1>

              {/* Subtitle */}
              <p className="mt-5 text-base sm:text-lg text-[#556970] max-w-2xl mx-auto leading-relaxed">
                Get your personalized facial analysis and transformation plan based on your unique features.
              </p>

              {/* Primary Dual CTAs */}
              <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                <Link
                  href="/assessment"
                  className="rounded-full bg-[#182327] px-8 py-3.5 text-sm font-semibold text-white hover:bg-[#28383f] transition-all shadow-xs"
                >
                  Start my plan
                </Link>
                <Link
                  href="/#how-it-works"
                  className="rounded-full border border-[#d2dcdf] bg-white px-8 py-3.5 text-sm font-semibold text-[#182327] hover:bg-[#f6f9fa] transition-all"
                >
                  How it works
                </Link>
              </div>

              {/* 3-Column Hero Highlights with Hairline Dividers */}
              <div className="mt-14 sm:mt-18 pt-8 border-t border-[#edf2f4] grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-4 text-center">
                <div className="sm:border-r sm:border-[#e6ebed] sm:pr-4">
                  <p className="text-sm font-semibold text-[#141e22]">Based on science</p>
                  <p className="text-xs text-[#71858c] mt-0.5">Using the latest research</p>
                </div>
                <div className="sm:border-r sm:border-[#e6ebed] sm:px-4">
                  <p className="text-sm font-semibold text-[#141e22]">Personalized</p>
                  <p className="text-xs text-[#71858c] mt-0.5">Based on your demographics</p>
                </div>
                <div className="sm:pl-4">
                  <p className="text-sm font-semibold text-[#141e22]">Without surgery</p>
                  <p className="text-xs text-[#71858c] mt-0.5">Non-surgical changes</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Media Coverage / As Seen In Marquee */}
        <AsSeenInMarquee />

        {/* Life-changing Transformations Showcase */}
        <TransformationShowcase />

        {/* Scientific Evidence: Why Glow-up */}
        <QovesWhyGlowUp />

        {/* Complete Facial Analysis & Demographics */}
        <QovesCompleteAnalysis />

        {/* 160+ Aesthetic Assessments Diagnostic Explorer */}
        <QovesAssessmentsExplorer />

        {/* Technology Behind Your Transformation */}
        <QovesTechnology />

        {/* How It Works (3-step roadmap) */}
        <QovesHowItWorks />

        {/* Value Comparison */}
        <ValueComparison />

        {/* FAQ Section */}
        <QovesFaqSection />
      </main>
      <Footer />
    </>
  );
}
