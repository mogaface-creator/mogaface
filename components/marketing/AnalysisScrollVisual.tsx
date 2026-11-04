"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import "./analysis-scroll.css";

/** Scroll-driven example plots. These values never enter an assessment or report. */
export function AnalysisScrollVisual() {
  const stage = useRef<HTMLDivElement>(null);

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
      const progress = reduced.matches ? .65 : Math.max(0, Math.min(1, (window.innerHeight - rect.top) / (window.innerHeight + rect.height * .4)));
      section.style.setProperty("--analysis-progress", progress.toFixed(4));
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
    };
  }, []);
  return <div className="analysis-scroll-stage" ref={stage}>
    <div className="analysis-plots" aria-hidden="true">
      <div className="analysis-plot plot-matrix"><span className="plot-title">Feature relationships</span><div className="plot-matrix-dots">{Array.from({length:100},(_,i)=><i key={i} style={{opacity:.18 + ((i*17)%9)/13,transform:`scale(calc(.6 + var(--analysis-progress) * ${.35+(i%4)*.12}))`}} />)}</div><span className="plot-footer">Explore balance across the centre of the face.</span></div>
      <div className="plot-left-stack">
        <div className="analysis-plot plot-density"><span className="plot-title">Eyebrow density</span><svg viewBox="0 0 280 150"><path className="plot-grid" d="M15 20H265M15 55H265M15 90H265M15 125H265M35 10V135M85 10V135M135 10V135M185 10V135M235 10V135"/><path className="plot-curve" pathLength="1" d="M12 124C52 124 61 115 84 80S117 16 140 17 176 63 195 91 230 124 268 124"/><path className="plot-axis" d="M12 125H268"/><g className="plot-marker"><path d="M60 12V125"/><circle cx="60" cy="125" r="3"/></g><text x="12" y="144">LOW</text><text x="119" y="144">MEDIUM</text><text x="241" y="144">HIGH</text></svg><span className="plot-footer">See individual features as part of the whole.</span></div>
        <div className="analysis-plot plot-smoothness"><span className="plot-title">Skin texture</span><strong data-sample-counter>56%</strong><div className="plot-scale"><i/><span className="plot-scale-marker">Sample</span></div><span className="plot-footer">Illustrative texture range</span></div>
      </div>
      <div className="analysis-plot plot-spectrum"><span className="plot-title">Feature relationships</span><div className="spectrum-track"><i/><span className="spectrum-marker">Example</span><small>Light</small><small>Medium</small><small>Deep</small></div><span className="plot-footer">Individual features. A connected picture.</span></div>
      <div className="plot-right-stack">
        <div className="analysis-plot plot-thirds"><span className="plot-title">Facial thirds</span><div className="thirds-bars">{[.65,.85,.65].map((height,i)=><div key={i}><i style={{height:`${height*100}%`,transform:`scaleY(calc(.35 + var(--analysis-progress) * ${.8-i*.08}))`}}/><span>{["Upper","Middle","Lower"][i]}</span></div>)}</div><span className="plot-footer">See how the upper, middle and lower face relate.</span></div>
        <div className="analysis-plot plot-symmetry"><span className="plot-title">Bilateral symmetry</span><svg viewBox="0 0 280 145"><path className="plot-grid" d="M20 25H260M20 60H260M20 95H260M20 130H260M30 15V130M75 15V130M120 15V130M165 15V130M210 15V130M255 15V130"/>{[0,1,2].map((i)=><g className={`symmetry-line symmetry-line-${i}`} key={i}><path d={`M20 ${40+i*35}H260`}/><rect x={180-i*50} y={33+i*35} width="37" height="14" rx="2"/><text x={184-i*50} y={43+i*35}>{["IDEAL","YOU","RANGE"][i]}</text></g>)}</svg><span className="plot-footer">Balance across the centre of the face.</span></div>
      </div>
    </div>
    <div className="analysis-scroll-portrait"><Image src="/images/transformations/female_studio_cutout.png" width={1254} height={1254} sizes="(max-width: 800px) 90vw, 540px" alt="Example portrait surrounded by illustrative facial analysis plots" /></div>
    <p className="analysis-scroll-caption">Illustrative plots · example values, not a measured assessment</p>
  </div>;
}
