import Link from "next/link";
import Image from "next/image";
import "./qoves-inspired.css";
import "./art-brand.css";
import "./palette-2.css";
import "./palette-3.css";
import "./qoves-reference.css";
import { AnatomyDiagram, AnatomyOverview } from "@/components/marketing/AnatomyDiagram";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { AsSeenInMarquee } from "@/components/marketing/AsSeenInMarquee";

import { TransformationShowcase } from "@/components/marketing/TransformationShowcase";
import { QovesWhyGlowUp } from "@/components/marketing/QovesWhyGlowUp";
import { ApproachComparison } from "@/components/marketing/ApproachComparison";
import { FeatureDiscovery } from "@/components/marketing/FeatureDiscovery";
import { AssessmentDirectory } from "@/components/marketing/AssessmentDirectory";
import { ProgressDashboard } from "@/components/marketing/ProgressDashboard";
import { FutureVisualization } from "@/components/marketing/FutureVisualization";
import { PersonalizedPlan } from "@/components/marketing/PersonalizedPlan";
import { LearningOverview } from "@/components/marketing/LearningOverview";
import { PersonalContext } from "@/components/marketing/PersonalContext";
import { QovesCompleteAnalysis } from "@/components/marketing/QovesCompleteAnalysis";
import { QovesAssessmentsExplorer } from "@/components/marketing/QovesAssessmentsExplorer";
import { QovesTechnology } from "@/components/marketing/QovesTechnology";
import { QovesHowItWorks } from "@/components/marketing/QovesHowItWorks";
import { ValueComparison } from "@/components/marketing/ValueComparison";
import { QovesFaqSection } from "@/components/marketing/QovesFaqSection";

export default function Home() {
  return (
    <div className="moga-site moga-art-brand">
      <Header immersive />
      <main className="moga-home flex-1 bg-white">
        <section className="moga-hero" aria-labelledby="hero-heading">
          <div className="moga-hero-photo">
            <Image src="/images/transformations/female_studio_before.webp" alt="Natural portrait showing individual facial features" fill priority sizes="(max-width: 800px) 100vw, 70vw" />
          </div>
          <div className="moga-hero-shade" />
          <div className="hero-anatomy-profile" aria-hidden="true"><AnatomyDiagram view="profile"/></div>
          <div className="moga-hero-index" aria-hidden="true">MOGA / AESTHETICS STUDIO</div>
          <div className="moga-hero-content">
            <p className="moga-hero-proof"><span className="moga-proof-avatars" aria-hidden="true"><Image src="/images/transformations/female_glow_before.webp" width={28} height={28} alt="" /><Image src="/images/transformations/male_jawline_before.webp" width={28} height={28} alt="" /><Image src="/images/transformations/female_studio_before.webp" width={28} height={28} alt="" /></span> Join <strong>80,000+</strong> people</p>
            <h1 id="hero-heading">Improve your<br />{" "}looks. <span>Without<br />{" "}surgery.</span></h1>
            <p className="moga-hero-description">Get your personalized facial analysis and transformation plan based on your unique features.</p>
            <div className="moga-hero-actions">
              <Link href="/assessment" className="moga-pill moga-pill-light">Start my plan <span aria-hidden="true">↗</span></Link>
              <Link href="/#how-it-works" className="moga-pill moga-pill-glass">How it works</Link>
            </div>
          </div>
          <div className="moga-hero-highlights">
            <div><p>Based on science</p><span>Using the latest research</span></div>
            <div><p>Personalized</p><span>Based on your demographics</span></div>
            <div><p>Without surgery</p><span>Non-surgical changes</span></div>
          </div>
          <a href="#transformations" className="moga-hero-scroll" aria-label="Explore transformations">↓</a>
        </section>

        {/* Media Coverage / As Seen In Marquee */}
        <AsSeenInMarquee />

        {/* Life-changing Transformations Showcase */}
        <TransformationShowcase />

        {/* Scientific Evidence: Why Glow-up */}
        <QovesWhyGlowUp />
        <ApproachComparison />

        {/* Complete Facial Analysis & Demographics */}
        <QovesCompleteAnalysis />
        <PersonalContext />
        <LearningOverview />
        <PersonalizedPlan />
        <FutureVisualization />
        <ProgressDashboard />

        <AnatomyOverview />

        {/* 160+ Aesthetic Assessments Diagnostic Explorer */}
        <AssessmentDirectory />
        <QovesAssessmentsExplorer />
        <FeatureDiscovery />

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
    </div>
  );
}
