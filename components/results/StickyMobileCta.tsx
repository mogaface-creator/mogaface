"use client";

import { useEffect, useState } from "react";
import type { ConsultationCta } from "@/lib/results/config.ts";

/**
 * Mobile-only shortcut to the same consultation CTA the report already ends
 * with (see Report.tsx's "next-step" section) — never a second booking
 * system, just the same ConsultationCta config rendered a second time.
 *
 * Hidden entirely at sm: and up: on a wide screen the full CTA at the bottom
 * of the report is already close enough that a permanent floating bar would
 * just be clutter.
 *
 * On mobile, visible only BETWEEN the summary's own CTA and the full report's
 * final CTA section — hidden while the summary's CTA hasn't been scrolled
 * past yet (including on first load, when the summary alone can be taller
 * than the viewport) and hidden again once the final CTA section scrolls
 * into view, so the person is never shown two "book/discuss" buttons at
 * once. Not rendered at all while hidden (rather than translated off-screen):
 * `visible` starts false, so there is nothing to cover content with before
 * the first position check has even run.
 *
 * A plain scroll listener (rAF-throttled), not IntersectionObserver: the
 * two sentinels need a DIRECTIONAL check ("has this scrolled above the
 * viewport", not just "is this currently intersecting"), which
 * IntersectionObserver's isIntersecting can't distinguish from "hasn't been
 * reached yet" — getBoundingClientRect() can.
 */
export function StickyMobileCta({ cta }: { cta: ConsultationCta }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const summaryCta = document.getElementById("summary-cta");
    const finalCta = document.getElementById("next-step-section");
    if (!summaryCta || !finalCta) return;

    let ticking = false;
    const update = () => {
      ticking = false;
      const pastSummary = summaryCta.getBoundingClientRect().bottom < 0;
      const reachedFinal = finalCta.getBoundingClientRect().top < window.innerHeight;
      setVisible(pastSummary && !reachedFinal);
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  if (!visible) return null;

  const external = /^https?:/i.test(cta.href);

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 pt-3 backdrop-blur sm:hidden"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <a
        href={cta.href}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className="flex w-full items-center justify-center rounded-full bg-accent px-6 py-3.5 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {cta.label}
      </a>
    </div>
  );
}
