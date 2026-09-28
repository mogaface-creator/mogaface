"use client";

import { useEffect, useRef, useState } from "react";
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
 *
 * Fixed-positioned elements are taken out of flow, so on their own they
 * cover whatever content is underneath them. Alongside the bar, this also
 * renders an in-flow spacer of the same measured height (including its
 * safe-area padding), so the document always has that much extra scrollable
 * room and nothing ends up permanently hidden behind the bar. The spacer's
 * height is measured from the real DOM node (offsetHeight), not a hardcoded
 * constant, because env(safe-area-inset-bottom) varies by device and can't
 * be read as a plain JS value any other way. See Report.tsx for why this
 * component is placed AFTER next-step-section in the DOM: the spacer must
 * never sit before either sentinel this file measures against, or its own
 * appearance would shift them and feed back into `visible`.
 */
export function StickyMobileCta({ cta }: { cta: ConsultationCta }) {
  const [visible, setVisible] = useState(false);
  const [barHeight, setBarHeight] = useState(0);
  const barRef = useRef<HTMLDivElement>(null);

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
      if (barRef.current) setBarHeight(barRef.current.offsetHeight);
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

  // The bar only exists in the DOM once `visible` is true, so its height
  // can't be measured until after that render commits (a plain scroll/resize
  // event won't necessarily follow). Re-measure right away so the reserved
  // space is correct from the bar's first visible frame, not just after the
  // next scroll.
  useEffect(() => {
    if (visible && barRef.current) setBarHeight(barRef.current.offsetHeight);
  }, [visible]);

  if (!visible) return null;

  const external = /^https?:/i.test(cta.href);

  return (
    <>
      <div
        ref={barRef}
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
      <div aria-hidden style={{ height: barHeight }} className="sm:hidden" />
    </>
  );
}
