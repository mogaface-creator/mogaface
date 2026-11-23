"use client";

import { useState } from "react";
import Image from "next/image";
import "./personalized-plan.css";

const BENEFITS = ["Get your personalized facial analysis", "Visualize your best looking self", "Get your personalized glow-up protocol", "Track your progress and review changes"];
const TABS = ["Overview", "Feature map", "Your plan"] as const;
type Tab = (typeof TABS)[number];

function SampleWorkspace({ activeTab }: { activeTab: Tab }) {
  return <div className="plan-workspace-content" aria-live="polite">
    {activeTab === "Overview" && <>
      <div className="plan-workspace-intro">
        <div><span>Your private web plan</span><h3>See your features<br />in context.</h3><p>A clear, personal view of what you shared and what to explore next.</p></div>
        <Image src="/images/transformations/female_character_06_after.png" width={104} height={132} alt="Illustrative sample profile" sizes="104px" />
      </div>
      <div className="plan-workspace-stats"><div><strong>160+</strong><span>assessment areas</span></div><div><strong>1</strong><span>private web plan</span></div><div><strong>0</strong><span>pressure to decide</span></div></div>
      <div className="plan-workspace-summary"><span>YOUR NEXT REVIEW</span><strong>Facial harmony &amp; skin context</strong><p>Explore your report one section at a time, at your own pace.</p></div>
    </>}
    {activeTab === "Feature map" && <>
      <div className="plan-map-heading"><span>FEATURE MAP</span><h3>A connected view,<br />not isolated scores.</h3></div>
      <div className="plan-map-visual"><Image src="/images/transformations/female_character_06_before.png" width={178} height={220} alt="Illustrative facial feature map" sizes="178px" /><i className="map-line line-one" /><i className="map-line line-two" /><i className="map-point point-one" /><i className="map-point point-two" /><i className="map-point point-three" /></div>
      <div className="plan-map-legend"><span><i /> Facial thirds</span><span><i /> Feature relationships</span><span><i /> Overall balance</span></div>
    </>}
    {activeTab === "Your plan" && <>
      <div className="plan-map-heading"><span>YOUR PLAN</span><h3>Practical next steps,<br />kept together.</h3></div>
      <ol className="plan-workspace-timeline"><li><b>01</b><div><strong>Review your features</strong><span>Understand the visual context behind your report.</span></div></li><li><b>02</b><div><strong>Explore your options</strong><span>Compare non-surgical directions at your pace.</span></div></li><li><b>03</b><div><strong>Return and track</strong><span>Keep your progress and notes in one private place.</span></div></li></ol>
    </>}
  </div>;
}

export function PersonalizedPlan() {
 const [activeTab, setActiveTab] = useState<Tab>("Overview");
 return <section id="personalized-plan" className="personalized-plan" aria-labelledby="personalized-plan-heading">
  <div className="plan-editorial"><div className="plan-introduction"><span className="plan-eyebrow">Personalized plan</span><h2 id="personalized-plan-heading">Get your personalized<br/><span>Moga plan</span></h2><p>Understand your facial features and explore a personalized plan designed around your unique features and goals.</p></div>
   <ol className="plan-benefits">{BENEFITS.map((text,index)=><li key={text}><span aria-hidden="true">[{index+1}]</span>{text}</li>)}</ol>
  </div>
  <div className="plan-preview-wrap"><div className="plan-web-preview"><div className="plan-web-toolbar"><div><span className="plan-web-dot" /><span>MOGA / PRIVATE WORKSPACE</span></div><span className="plan-web-status">Saved securely</span></div><div className="plan-web-heading"><div><span>ILLUSTRATIVE WEB PLAN</span><h3>Your personal aesthetic workspace</h3></div><span>Updated today</span></div><div className="plan-web-tabs" role="tablist" aria-label="Sample web plan sections">{TABS.map(tab=><button key={tab} type="button" role="tab" aria-selected={activeTab===tab} onClick={()=>setActiveTab(tab)}>{tab}</button>)}</div><SampleWorkspace activeTab={activeTab} /></div><p className="plan-preview-note">Sample web experience · your actual plan remains private and available in your browser</p></div>
 </section>;
}
