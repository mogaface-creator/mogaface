"use client";

import { useState } from "react";
import Image from "next/image";
import "./personalized-plan.css";

const BENEFITS = ["Get your personalized facial analysis", "Visualize your best looking self", "Get your personalized glow-up protocol", "Track your progress and review changes"];

export function PersonalizedPlan() {
 const [page,setPage]=useState(1);
 return <section id="personalized-plan" className="personalized-plan" aria-labelledby="personalized-plan-heading">
  <div className="plan-editorial"><div className="plan-introduction"><span className="plan-eyebrow">Personalized plan</span><h2 id="personalized-plan-heading">Get your personalized<br/><span>Moga plan</span></h2><p>Understand your facial features and explore a personalized plan designed around your unique features and goals.</p></div>
   <ol className="plan-benefits">{BENEFITS.map((text,index)=><li key={text}><span aria-hidden="true">[{index+1}]</span>{text}</li>)}</ol>
  </div>
  <div className="plan-preview-wrap"><div className="plan-report-viewer"><nav className="plan-page-nav" aria-label="Sample Moga report pages"><span>Sample report</span>{[1,2].map(number=><button key={number} type="button" onClick={()=>setPage(number)} aria-pressed={page===number} aria-label={`View sample report page ${number}`}><Image src={`/images/dossier/dossier_page_${number}.png`} width={90} height={127} alt="" sizes="90px"/><span>Page {number}</span></button>)}</nav><div className="plan-report-paper" aria-live="polite"><div className="plan-paper-toolbar"><span>MOGA / SAMPLE DOSSIER</span><span>PAGE {String(page).padStart(2,"0")} / 02</span></div><Image key={page} src={`/images/dossier/dossier_page_${page}.png`} width={848} height={1200} alt={`Illustrative MogaFace report, page ${page} of 2`} sizes="(max-width: 800px) 80vw, 48vw"/></div></div><p className="plan-preview-note">Illustrative sample report · not a personal assessment</p></div>
 </section>;
}
