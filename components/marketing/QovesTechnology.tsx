"use client";
import { useState } from "react";
const TECH_CARDS = [
  {
    title: "512-Point Precision Facial Analysis",
    subtitle: "Mathematical Rigor",
    body: "We landmark 512 points across your facial thirds, mandibular jawline border, tear troughs, and zygomatic arches, allowing sub-millimeter measurements far beyond standard human observation.",
  },
  {
    title: "Unmatched Personalization",
    subtitle: "Ethnicity & Age Calibrated",
    body: "Standard beauty apps impose one-size-fits-all Western models. Our algorithms dynamically recalibrate based on your demographic heritage, age, sex, and facial bone thickness.",
  },
  {
    title: "The Science of Facial Attractiveness",
    subtitle: "450+ Evidence-Based Methods",
    body: "Every aesthetic recommendation is drawn from 50+ years of peer-reviewed literature in aesthetic surgery, dermatology, facial morphology, and evolutionary psychology.",
  },
  {
    title: "Reviewed by Humans",
    subtitle: "Expert Clinical Oversight",
    body: "AI delivers the diagnostic speed, but human clinical doctors and aesthetic specialists oversee quality validation to ensure every plan is realistic, non-surgical, and safe.",
  },
];


export function QovesTechnology(){const [active,setActive]=useState(0);return <section className="moga-technology visual-technology"><div className="mx-auto max-w-6xl px-4 sm:px-6"><div className="visual-heading"><p className="visual-eyebrow">Proprietary Architecture</p><h2>The technology behind your transformation</h2><p>Combining advanced computer vision landmarking with clinical aesthetic science.</p></div><div className="technology-console"><div className="technology-nodes" aria-label="Explore the technology">{TECH_CARDS.map((card,i)=><button key={card.title} aria-pressed={active===i} onClick={()=>setActive(i)}><span className="technology-symbol" aria-hidden="true">{i===0?<svg viewBox="0 0 40 40"><path d="M8 8h24v24H8zM8 20h24M20 8v24M8 8l24 24M8 32L32 8"/></svg>:i===1?<svg viewBox="0 0 40 40"><circle cx="20" cy="14" r="6"/><path d="M9 33v-5a11 11 0 0122 0v5M5 10h5M30 10h5"/></svg>:i===2?<svg viewBox="0 0 40 40"><path d="M9 6h8v28H9zM23 11h8v23h-8zM5 34h30M12 11h2M26 16h2"/></svg>:<svg viewBox="0 0 40 40"><path d="M20 4L33 10v10c0 8-13 16-13 16S7 28 7 20V10zM13 20l5 5 10-11"/></svg>}</span><small>0{i+1}</small><strong>{card.subtitle}</strong></button>)}</div><div className="technology-detail" aria-live="polite"><span className="visual-eyebrow">Explore layer 0{active+1}</span><h3>{TECH_CARDS[active].title}</h3><p>{TECH_CARDS[active].body}</p><div className="technology-pagination">{TECH_CARDS.map((card,i)=><button key={card.title} aria-label={`Technology layer ${i+1}`} aria-pressed={active===i} onClick={()=>setActive(i)}/>)}</div></div></div></div></section>}
