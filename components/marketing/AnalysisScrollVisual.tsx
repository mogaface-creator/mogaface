"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import "./analysis-scroll.css";

/** Scroll-driven example plots. These values never enter an assessment or report. */
export function AnalysisScrollVisual() {
  const stage = useRef<HTMLDivElement>(null);
  const [activeRegion, setActiveRegion] = useState("all");

  useEffect(() => {
    const node = stage.current;
    if (!node) return;
    const section = node.closest<HTMLElement>(".analysis-scroll-showcase")!;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let visible = true;
    const draw = () => {
      frame = 0;
      const rect = node.getBoundingClientRect();
      // The reveal follows the stage through the viewport: scrolling down moves
      // from the reference portrait to the illustrative direction; scrolling up
      // retraces it. Keeping this value on the stage avoids re-rendering the
      // whole illustration on every scroll frame.
      const travelStart = window.innerHeight * .82;
      const travelEnd = window.innerHeight * .12 - rect.height;
      const progress = reduced.matches ? .65 : Math.max(0, Math.min(1, (travelStart - rect.top) / (travelStart - travelEnd)));
      section.style.setProperty("--analysis-progress", progress.toFixed(4));
      section.style.setProperty("--analysis-reveal", `${(progress * 100).toFixed(2)}%`);
      section.style.setProperty("--analysis-scan-y", `${(progress * 83).toFixed(2)}%`);
      section.style.setProperty("--analysis-dash", (1 - progress).toFixed(4));
      node.dataset.progress = progress.toFixed(4);
      node.querySelectorAll<HTMLElement>("[data-sample-counter]").forEach(label => {
        label.textContent = `${Math.round(36 + progress * 30)}%`;
      });
    };
    const schedule = () => { if (visible && !frame) frame = requestAnimationFrame(draw); };
    const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; if (visible) schedule(); }, { rootMargin: "150px" });
    observer.observe(node);
    draw();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    reduced.addEventListener("change", schedule);
    return () => {
      cancelAnimationFrame(frame); observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      reduced.removeEventListener("change", schedule);
      section.style.removeProperty("--analysis-progress");
      section.style.removeProperty("--analysis-reveal");
      section.style.removeProperty("--analysis-scan-y");
      section.style.removeProperty("--analysis-dash");
    };
  }, []);
  const activate = (region: string) => ({
    onPointerEnter: () => setActiveRegion(region),
    onPointerLeave: () => setActiveRegion("all"),
    onFocus: () => setActiveRegion(region),
    onBlur: () => setActiveRegion("all"),
  });
  return <div className="analysis-scroll-stage" ref={stage} data-active-region={activeRegion}>
    <svg className="analysis-measurement-overlay" viewBox="0 0 1000 520" preserveAspectRatio="none" aria-hidden="true">
      <circle className="measurement-ring measurement-ring-large" cx="500" cy="270" r="195" />
      <circle className="measurement-ring measurement-ring-small" cx="500" cy="270" r="128" />
      <path className="measurement-axis" pathLength="1" d="M500 64V474M305 270H695" />
      <path className="measurement-arc" pathLength="1" d="M324 189C371 88 629 88 676 189" />
      <g className="measurement-ticks">
        {[0, 1, 2, 3, 4].map((index) => <path key={index} d={`M${340 + index * 80} 259v22`} />)}
      </g>
    </svg>
    <div className="analysis-plots">
      <div className="analysis-plot plot-matrix"><span className="plot-title">Feature relationships</span><div className="plot-matrix-dots">{Array.from({length:100},(_,i)=><i key={i} style={{opacity:.18 + ((i*17)%9)/13,transform:`scale(calc(.6 + var(--analysis-progress) * ${.35+(i%4)*.12}))`}} />)}</div><span className="plot-footer">Explore balance across the centre of the face.</span></div>
      <div className="plot-left-stack">
        <button type="button" className="analysis-plot analysis-interactive-card plot-density" aria-label="Illustrative eyebrow density visual" {...activate("brows")}><span className="plot-title">Eyebrow density</span><svg viewBox="0 0 280 150"><path className="plot-grid" d="M15 20H265M15 55H265M15 90H265M15 125H265M35 10V135M85 10V135M135 10V135M185 10V135M235 10V135"/><path className="plot-curve" pathLength="1" d="M12 124C52 124 61 115 84 80S117 16 140 17 176 63 195 91 230 124 268 124"/><path className="plot-axis" d="M12 125H268"/><g className="plot-marker"><path d="M60 12V125"/><circle cx="60" cy="125" r="3"/></g><text x="12" y="144">LOW</text><text x="119" y="144">MEDIUM</text><text x="241" y="144">HIGH</text></svg><span className="plot-footer">Illustrative eyebrow relationship.</span></button>
        <button type="button" className="analysis-plot analysis-interactive-card plot-smoothness" aria-label="Illustrative skin texture visual" {...activate("skin")}><span className="plot-title">Skin texture</span><strong data-sample-counter>56%</strong><div className="plot-scale"><i/><span className="plot-scale-marker">Example</span></div><span className="plot-footer">Illustrative texture range</span></button>
      </div>
    </div>
    <div className="analysis-spectrum-plot analysis-plot" aria-hidden="true"><span className="plot-title">Feature relationships</span><div className="spectrum-track"><i/><span className="spectrum-marker">Example</span><small>Light</small><small>Medium</small><small>Deep</small></div><span className="plot-footer">Individual features. A connected picture.</span></div>
    <div className="analysis-side-plots">
      <button type="button" className="analysis-plot analysis-interactive-card plot-thirds" aria-label="Illustrative facial thirds visual" {...activate("thirds")}><span className="plot-title">Facial thirds</span><div className="thirds-bars">{[.65,.85,.65].map((height,i)=><div key={i}><i style={{height:`${height*100}%`,transform:`scaleY(calc(.35 + var(--analysis-progress) * ${.8-i*.08}))`}}/><span>{["Upper","Middle","Lower"][i]}</span></div>)}</div><span className="plot-footer">Upper, middle and lower facial zones.</span></button>
      <button type="button" className="analysis-plot analysis-interactive-card plot-symmetry" aria-label="Illustrative bilateral symmetry visual" {...activate("symmetry")}><span className="plot-title">Bilateral symmetry</span><svg viewBox="0 0 280 145"><path className="plot-grid" d="M20 25H260M20 60H260M20 95H260M20 130H260M30 15V130M75 15V130M120 15V130M165 15V130M210 15V130M255 15V130"/>{[0,1,2].map((i)=><g className={`symmetry-line symmetry-line-${i}`} key={i}><path d={`M20 ${40+i*35}H260`}/><rect x={180-i*50} y={33+i*35} width="37" height="14" rx="2"/><text x={184-i*50} y={43+i*35}>{["IDEAL","YOU","RANGE"][i]}</text></g>)}</svg><span className="plot-footer">Illustrative centre-line relationship.</span></button>
    </div>
    <div className="analysis-scroll-portrait"><Image className="analysis-portrait-image" src="/images/transformations/female_character_06_before_cutout.png" width={1083} height={1453} sizes="(max-width: 800px) 90vw, 540px" alt="Example before-and-after portrait used for an illustrative scanning preview" /><div className="portrait-after-reveal" aria-hidden="true"><Image className="analysis-portrait-image" src="/images/transformations/female_character_06_after_cutout.png" width={1083} height={1453} sizes="(max-width: 800px) 90vw, 540px" alt="" /></div><span className="portrait-scan" aria-hidden="true" /><span className="portrait-map-label" aria-hidden="true">Scroll to compare</span></div>
    <p className="analysis-scroll-caption">Illustrative plots · example values, not a measured assessment</p>
  </div>;
}
