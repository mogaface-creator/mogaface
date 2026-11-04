"use client";

import { useState, type PointerEvent, type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import "./feature-discovery.css";

const FEATURES=[
 {title:"Your most noticeable feature",description:"Explore a feature up close and see how it contributes to your overall appearance.",label:"Eye detail",image:"female_glow_before.webp"},
 {title:"How features affect your look",description:"See how individual features relate to balance, symmetry, and overall appearance.",label:"Feature relationships",image:"male_jawline_before.webp"},
 {title:"Features with the most potential",description:"Explore the areas highlighted in a personalized improvement plan.",label:"Appearance potential",image:"female_studio_before.webp"},
];

function DiscoveryCard({index}:{index:number}){
 const [position,setPosition]=useState(.5);const [active,setActive]=useState(false);const feature=FEATURES[index];
 const value=Math.round(42+position*38);const secondary=Math.round(82-position*24);
 function explore(event:PointerEvent<HTMLElement>){if(event.pointerType==="touch")return;const bounds=event.currentTarget.getBoundingClientRect();setPosition(Math.max(0,Math.min(1,(event.clientX-bounds.left)/bounds.width)));}
 return <article className="discovery-card"><span className="discovery-number">[{index+1}]</span><h3>{feature.title}</h3><p>{feature.description}</p>
  <div className={`discovery-stage discovery-stage-${index} ${active?"is-exploring":""}`} onPointerMove={explore} onPointerEnter={()=>setActive(true)} onPointerLeave={()=>{setActive(false);setPosition(.5);}} style={{"--feature-position":position,"--feature-light":`${position*100}%`} as CSSProperties}>
   <Image src={`/images/transformations/${feature.image}`} fill alt={`Illustrative ${feature.label.toLowerCase()} study`} sizes="(max-width: 800px) 90vw, 30vw"/>
   <div className="discovery-topline"><span>{feature.label}</span><span>Example</span></div>
   {index===0?<><div className="discovery-eye-frame" aria-hidden="true"/><div className="discovery-spectrum" aria-hidden="true"><i/></div><div className="discovery-glass discovery-eye-data"><span>Feature detail</span><strong>{(.18+position*.12).toFixed(2)}</strong><div className="discovery-scale"><i style={{left:`${position*100}%`}}/></div><small>Illustrative measurement</small></div></>:index===1?<><div className="discovery-score-pair"><div className="discovery-glass"><span>Brows</span><strong>{value}</strong></div><div className="discovery-glass"><span>Definition</span><strong>{secondary}</strong></div></div><div className="discovery-landmarks" aria-hidden="true"><i/><i/><i/><i/></div><div className="discovery-glass discovery-bottom"><span>Feature balance</span><strong>{value}%</strong><div className="discovery-bar"><i style={{width:`${value}%`}}/></div></div></>:<><div className="discovery-glass discovery-ring"><span>Example potential</span><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="40"/><circle cx="50" cy="50" r="40" pathLength="100" strokeDasharray={`${value} 100`}/></svg><strong>{value}</strong></div><div className="discovery-glass discovery-bottom"><span>Explore possible changes</span><svg className="discovery-mini-chart" viewBox="0 0 250 65" aria-hidden="true"><path d="M0 55H250M0 30H250"/><path d={`M0 52Q80 50 125 ${48-position*22}T250 ${35-position*30}`}/></svg></div></>}
  </div>
  <label className="discovery-control">Explore example <output>{Math.round(position*100)}%</output><input type="range" min="0" max="100" value={Math.round(position*100)} aria-label={`Explore ${feature.label.toLowerCase()}`} onChange={event=>setPosition(Number(event.target.value)/100)}/></label>
 </article>;
}

export function FeatureDiscovery(){return <section id="discover-your-features" className="feature-discovery" aria-labelledby="feature-discovery-heading"><header><div><span className="discovery-eyebrow">Learn about your face</span><h2 id="feature-discovery-heading">Discover what <em>makes you, you.</em></h2><p>Understand your features and their impact on your appearance.</p></div><Link href="/assessment">Start my plan <span aria-hidden="true">↗</span></Link></header><div className="discovery-grid">{FEATURES.map((feature,index)=><DiscoveryCard key={feature.title} index={index}/>)}</div><p className="discovery-note">Move across a picture to explore. Example values and guide positions are illustrative, not measured assessments.</p></section>}
