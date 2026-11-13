"use client";

import { useState, type PointerEvent, type CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import "./feature-discovery.css";

const FEATURES=[
 {title:"Your most noticeable feature",description:"Explore a feature up close and see how it contributes to your overall appearance.",label:"Eye detail",image:"female_character_05_before.png"},
 {title:"How features affect your look",description:"See how individual features relate to balance, symmetry, and overall appearance.",label:"Feature relationships",image:"dark_skinned_male_before.png"},
 {title:"Features with the most potential",description:"Explore the areas highlighted in a personalized improvement plan.",label:"Appearance potential",image:"female_character_06_before.png"},
];

function DiscoveryCard({index}:{index:number}){
 const [position,setPosition]=useState(.5);const [active,setActive]=useState(false);const feature=FEATURES[index];
 function explore(event:PointerEvent<HTMLElement>){if(event.pointerType==="touch")return;const bounds=event.currentTarget.getBoundingClientRect();setPosition(Math.max(0,Math.min(1,(event.clientX-bounds.left)/bounds.width)));}
 return <article className="discovery-card"><span className="discovery-number">[{index+1}]</span><h3>{feature.title}</h3><p>{feature.description}</p>
  <div className={`discovery-stage discovery-stage-${index} ${active?"is-exploring":""}`} onPointerMove={explore} onPointerEnter={()=>setActive(true)} onPointerLeave={()=>{setActive(false);setPosition(.5);}} style={{"--feature-position":position,"--feature-light":`${position*100}%`} as CSSProperties}>
   <Image src={`/images/transformations/${feature.image}`} fill alt={`Illustrative ${feature.label.toLowerCase()} study`} sizes="(max-width: 800px) 90vw, 30vw"/>
   <div className="discovery-topline"><span>{feature.label}</span><span>Illustrative guide</span></div>
   {index===0?<><div className="discovery-eye-frame" aria-hidden="true"/><div className="discovery-spectrum" aria-hidden="true"><i/></div><div className="discovery-glass discovery-eye-data"><span>What this view shows</span><strong className="discovery-story">Eye area in context</strong><small>Placement, openness, and the surrounding skin are considered together.</small></div></>:index===1?<><div className="discovery-score-pair"><div className="discovery-glass"><span>Consider together</span><strong className="discovery-story">Brow line</strong></div><div className="discovery-glass"><span>Consider together</span><strong className="discovery-story">Eye spacing</strong></div></div><div className="discovery-landmarks" aria-hidden="true"><i/><i/><i/><i/></div><div className="discovery-glass discovery-bottom"><span>Connected view</span><strong className="discovery-story">Balance is a relationship.</strong><small>Brows, eyes, and lower face are read as one composition.</small></div></>:<><div className="discovery-glass discovery-ring"><span>Potential means</span><strong className="discovery-story">Options to explore</strong><small>Not a promise or a score.</small></div><div className="discovery-glass discovery-bottom"><span>Start with clarity</span><strong className="discovery-story">Compare a few directions before deciding.</strong></div></>}
  </div>
  <label className="discovery-control">Move across the view<input type="range" min="0" max="100" value={Math.round(position*100)} aria-label={`Explore ${feature.label.toLowerCase()}`} onChange={event=>setPosition(Number(event.target.value)/100)}/></label>
 </article>;
}

export function FeatureDiscovery(){return <section id="discover-your-features" className="feature-discovery" aria-labelledby="feature-discovery-heading"><header><div><span className="discovery-eyebrow">Learn about your face</span><h2 id="feature-discovery-heading">Discover what <em>makes you, you.</em></h2><p>Understand your features and their impact on your appearance.</p></div><Link href="/assessment">Start my plan <span aria-hidden="true">↗</span></Link></header><div className="discovery-grid">{FEATURES.map((feature,index)=><DiscoveryCard key={feature.title} index={index}/>)}</div><p className="discovery-note">Move across a picture or use the control to explore how each illustration is organized. These are visual guides, not personal measurements or predictions.</p></section>}
