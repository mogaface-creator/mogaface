"use client";
import { useState } from "react";
import Image from "next/image";
import { FaceIllustration } from "./VisualExplainers";
import { AnalysisScrollVisual } from "./AnalysisScrollVisual";
const DEMOGRAPHIC_FACTORS = [
  {
    title: "Ethnic background",
    desc: "Every demographic possesses unique skull architecture, soft-tissue thickness, and melanin profiles. Our algorithms adjust for your ancestry, preventing generic Western-only standards.",
  },
  {
    title: "Personal preferences",
    desc: "Whether you favor ultra-conservative natural refinement or razor-sharp mandibular sculpting, your plan is calibrated to your exact comfort zone and daily routine.",
  },
  {
    title: "Lifestyle factors",
    desc: "Sleep architecture, hydration, facial posture (tongue posture and resting mouth state), nutrition, and sun exposure patterns are directly incorporated into your non-surgical timeline.",
  },
  {
    title: "Natural aging patterns",
    desc: "We analyze deep fat pad repositioning, collagen degradation rates, and bone resorption to target enhancements that age gracefully over years rather than fading in weeks.",
  },
  {
    title: "Cultural beauty standards",
    desc: "Balancing objective facial thirds with authentic personal aesthetics ensures you look like the most attractive, vibrant version of yourself—never an artificial stranger.",
  },
];

const LEARNING_OUTCOMES = [
  {
    number: "01",
    title: "Your Biometric Scores",
    desc: "Exact proportions: facial thirds, midface ratio, mandibular angle, and bilateral symmetry calculated with sub-millimeter precision.",
  },
  {
    number: "02",
    title: "Feature Impact Hierarchy",
    desc: "A mathematical breakdown ranking which specific features (e.g. tear troughs vs jawline border) exert the greatest influence on your facial balance.",
  },
  {
    number: "03",
    title: "Features With Highest Potential",
    desc: "Clear identification of the 'low-hanging fruit'—the subtle, high-yield non-surgical adjustments that yield the most dramatic aesthetic glow-up.",
  },
  {
    number: "04",
    title: "The Underlying Science",
    desc: "Complete medical transparency. Every recommendation links directly to peer-reviewed dermatological and plastic surgery studies explaining exactly why it works.",
  },
];


export function QovesCompleteAnalysis() {
 const [view,setView]=useState("features");
 const [factor,setFactor]=useState(0);
 const [outcome,setOutcome]=useState(0);
 const [mode,setMode]=useState("thirds");
 const [page,setPage]=useState(1);
 return <section className="moga-analysis visual-analysis" id="analysis"><div className="analysis-scroll-showcase">
  <div className="visual-heading"><p className="visual-eyebrow">A New Way to Glow-Up</p><h2>Your complete facial analysis</h2><p>Explore your features, the context behind them, and the report you receive.</p></div>
  <AnalysisScrollVisual /></div><div className="analysis-content mx-auto max-w-6xl px-4 sm:px-6"><div className="visual-switch" aria-label="Explore your analysis">{[["features","Your features"],["context","Your context"],["report","Your report"]].map(([key,label])=><button key={key} aria-pressed={view===key} onClick={()=>setView(key)}>{label}</button>)}</div>
  {view==="features" && <div className="visual-two-column visual-stage">
   <div className="visual-face-stage"><FaceIllustration mode={mode} /><span className="visual-caption">Illustrative overlay · not a measured assessment</span></div>
   <div className="visual-story"><span className="visual-eyebrow">A closer look</span><h3>One face.<br />A connected picture.</h3><p>We analyze 512 anatomical facial landmarks, evaluating your features holistically rather than in isolation.</p>
    <div className="visual-option-list">{[["thirds","Facial thirds","See how the upper, middle and lower face relate."],["symmetry","Bilateral symmetry","Explore balance across the centre of the face."],["features","Feature relationships","See individual features as part of the whole."]].map(([key,title,desc],i)=><button key={key} aria-pressed={mode===key} onClick={()=>setMode(key)}><span>0{i+1}</span><div><strong>{title}</strong><small>{desc}</small></div><span aria-hidden="true">↗</span></button>)}</div>
   </div></div>}
  {view==="context" && <div className="visual-two-column visual-stage"><div className="context-orbit"><div className="orbit-ring" /><div className="orbit-ring inner" /><div className="orbit-centre"><span>YOUR</span><strong>unique<br />context</strong></div>{DEMOGRAPHIC_FACTORS.map((item,i)=><button key={item.title} className={`orbit-node orbit-${i}`} aria-pressed={factor===i} onClick={()=>setFactor(i)}><span>0{i+1}</span>{item.title}</button>)}</div><div className="visual-story" aria-live="polite"><span className="visual-eyebrow">Taking into account your...</span><h3>{DEMOGRAPHIC_FACTORS[factor].title}</h3><p>{DEMOGRAPHIC_FACTORS[factor].desc}</p><p className="visual-note">No two faces are alike. Select a factor to explore the context behind a personalized plan.</p></div></div>}
  {view==="report" && <div className="visual-two-column visual-stage"><div className="report-viewer"><div className="report-toolbar"><span>SAMPLE DOSSIER</span><div><button aria-label="Previous sample page" disabled={page===1} onClick={()=>setPage(1)}>←</button><span>{page} / 2</span><button aria-label="Next sample page" disabled={page===2} onClick={()=>setPage(2)}>→</button></div></div><div className="report-paper"><Image src={`/images/dossier/dossier_page_${page}.png`} width={720} height={1000} alt={`Sample MogaFace dossier page ${page}`} /></div></div><div className="visual-story"><span className="visual-eyebrow">You will learn...</span><h3>Clarity you<br />can come back to.</h3><div className="visual-option-list">{LEARNING_OUTCOMES.map((item,i)=><button key={item.number} aria-pressed={outcome===i} onClick={()=>setOutcome(i)}><span>{item.number}</span><strong>{item.title}</strong><span aria-hidden="true">↗</span></button>)}</div><p className="visual-note" aria-live="polite">{LEARNING_OUTCOMES[outcome].desc}</p><details className="visual-details"><summary>Zero Surgery Required</summary><p>Every single recommendation is 100% non-surgical, structured so small changes compound into a noticeable, natural transformation.</p></details></div></div>}
 </div></section>;
}
