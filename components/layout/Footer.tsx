import Link from "next/link";
import Image from "next/image";
import "./footer.css";

export function Footer() {
  return (
    <footer className="moga-footer border-t border-[#e6ebed] bg-[#ffffff] py-14 sm:py-18">
      <div className="moga-footer-inner mx-auto max-w-6xl px-4 sm:px-6">
        <div className="moga-footer-primary flex flex-col md:flex-row md:items-start justify-between gap-10">
          <div className="moga-footer-brand">
            <div className="flex items-center gap-3">
              <Image className="moga-brand-emblem" src="/images/brand/mogaface-artwork.png" width={48} height={48} alt="MogaFace emblem" />
              <span className="moga-footer-wordmark font-sans text-xl font-bold tracking-tight">MOGA</span>
              <span className="moga-footer-studio rounded-full px-2.5 py-0.5 text-[10px] font-semibold border">
                Facial Aesthetics Studio
              </span>
            </div>
            <p className="moga-footer-description mt-3 max-w-md text-xs leading-relaxed">
              Science-based facial analysis, objective aesthetic advice, and non-surgical transformation protocols tailored to your unique features. We never use surgery or generic face-swaps.
            </p>
          </div>

          <div className="moga-footer-links grid grid-cols-2 sm:grid-cols-3 gap-8 text-xs font-medium">
            <div className="flex flex-col gap-2.5">
              <span className="moga-footer-heading text-[10px] font-bold uppercase tracking-wider">Navigation</span>
              <Link href="/#why-glowup" className="moga-footer-link transition-colors">Why Glow-up</Link>
              <Link href="/#assessments" className="moga-footer-link transition-colors">160+ Assessments</Link>
              <Link href="/#transformations" className="moga-footer-link transition-colors">Transformations</Link>
              <Link href="/#how-it-works" className="moga-footer-link transition-colors">How It Works</Link>
            </div>
            <div className="flex flex-col gap-2.5">
              <span className="moga-footer-heading text-[10px] font-bold uppercase tracking-wider">Tools</span>
              <Link href="/assessment" className="moga-footer-link transition-colors">Start assessment</Link>
              <Link href="/#faq" className="moga-footer-link transition-colors">FAQ</Link>
            </div>
            <div className="flex flex-col gap-2.5">
              <span className="moga-footer-heading text-[10px] font-bold uppercase tracking-wider">Legal</span>
              <span className="moga-footer-legal-link">Confidential & Encrypted</span>
              <span className="moga-footer-legal-link">Non-Surgical Only</span>
              <span className="moga-footer-legal-link">Doctor Consultation Advised</span>
            </div>
          </div>
        </div>

        <div className="moga-footer-legal mt-12 pt-6 border-t flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px]">
          <p>&copy; {new Date().getFullYear()} MOGA Studio. All rights reserved.</p>
          <p>This is an illustrative aesthetic guidance service. Not a medical prescription or surgical outcome guarantee.</p>
        </div>
      </div>
    </footer>
  );
}
