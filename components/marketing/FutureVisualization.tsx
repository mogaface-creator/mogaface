"use client";

import { useState } from "react";
import Image from "next/image";
import { BeforeAfterToggle } from "./BeforeAfterToggle";
import "./future-visualization.css";

const CARDS = [
 {title:"Realistic visualization",description:"Explore subtle appearance changes while keeping your original photo alongside the preview.",before:"dark_skinned_female_before.png",after:"dark_skinned_female_after.png"},
 {title:"Explore non-surgical options",description:"See illustrative changes in skin, hair, and facial definition before considering your next steps.",before:"male_character_06_before.png",after:"male_character_06_after.png"},
 {title:"Your individual features",description:"Keep your unique features and personal preferences at the center of your plan.",before:"female_character_06_before.png",after:"female_character_06_after.png"},
 {title:"Visualize changes before making decisions",description:"Compare the original with an illustrative preview and explore the difference at your own pace.",before:"dark_skinned_male_before.png",after:"dark_skinned_male_after.png"},
];

function PreviewCard({index}:{index:number}) {
 const [active,setActive]=useState(false);
 const card=CARDS[index];
 return <button type="button" className="future-feature-card" aria-pressed={active} onClick={()=>setActive(!active)} aria-label={`${card.title}: toggle image preview`}>
  <span className="future-miniature"><Image src={`/images/transformations/${card.before}`} fill alt="Original example" sizes="(max-width: 800px) 40vw, 260px"/><Image className="future-miniature-after" src={`/images/transformations/${card.after}`} fill alt="Illustrative after preview" sizes="(max-width: 800px) 40vw, 260px"/></span>
  <span className="future-card-copy"><strong>{card.title}</strong><span>{card.description}</span></span>
 </button>;
}

export function FutureVisualization(){return <section id="future-you" className="future-visualization" aria-labelledby="future-you-heading">
 <header className="future-heading"><span>Visualization</span><h2 id="future-you-heading">See your <em>future you</em></h2><p>Explore how small changes could look on your face.</p></header>
 <div className="future-layout"><div className="future-card-column"><PreviewCard index={0}/><PreviewCard index={1}/></div><div className="future-main-preview"><BeforeAfterToggle beforeSrc="/images/transformations/female_character_05_before.png" afterSrc="/images/transformations/female_character_05_after.png"/><p>Drag to compare · illustrative preview</p></div><div className="future-card-column"><PreviewCard index={2}/><PreviewCard index={3}/></div></div>
 <p className="future-disclaimer">Illustrative visualizations, not predictions or guaranteed outcomes. Hover or focus to explore; tap a card to keep its preview visible.</p>
 </section>}
