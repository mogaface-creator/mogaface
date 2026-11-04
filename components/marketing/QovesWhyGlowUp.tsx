"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { RESEARCH_CATEGORIES } from "@/lib/marketing/researchCategories";
import "./research-cards.css";

export function QovesWhyGlowUp() {
 const [active,setActive] = useState(0);
 const tabs = useRef<Array<HTMLButtonElement | null>>([]);
 const category = RESEARCH_CATEGORIES[active];
 function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
  let next = index;
  if(event.key === "ArrowRight") next = (index+1)%RESEARCH_CATEGORIES.length;
  else if(event.key === "ArrowLeft") next = (index-1+RESEARCH_CATEGORIES.length)%RESEARCH_CATEGORIES.length;
  else if(event.key === "Home") next = 0;
  else if(event.key === "End") next = RESEARCH_CATEGORIES.length-1;
  else return;
  event.preventDefault(); setActive(next); tabs.current[next]?.focus();
 }
 function moveGlass(event: PointerEvent<HTMLElement>) {
  if (event.pointerType === "touch") return;
  const card = event.currentTarget;
  const box = card.getBoundingClientRect();
  card.style.setProperty("--glass-x", `${((event.clientX-box.left)/box.width)*100}%`);
  card.style.setProperty("--glass-y", `${((event.clientY-box.top)/box.height)*100}%`);
 }
 return <section id="why-glowup" className="visual-research research-cards-section">
  <div className="research-card-heading"><h2>Studies show your looks influence almost everything, <span>from your career to your romantic life.</span></h2>
   <div className="research-tab-scroll"><div className="research-card-tabs" role="tablist" aria-label="Research categories">{RESEARCH_CATEGORIES.map((item,index)=><button key={item.id} type="button" role="tab" id={`research-tab-${item.id}`} aria-controls={`research-panel-${item.id}`} aria-selected={active===index} tabIndex={active===index?0:-1} ref={node=>{tabs.current[index]=node;}} onClick={()=>setActive(index)} onKeyDown={event=>onKeyDown(event,index)}>{item.label}</button>)}</div></div>
  </div>
  <div className="research-card-grid" key={category.id} role="tabpanel" id={`research-panel-${category.id}`} aria-labelledby={`research-tab-${category.id}`} tabIndex={0} style={{"--research-columns":category.cards.length} as React.CSSProperties}>
   {category.cards.map(card=><div className="research-card-cell" key={card.lead+(card.title||"")}><article className="research-finding-card" tabIndex={0} aria-label={`${card.lead} ${card.title || ""}`.trim()} onPointerMove={moveGlass} onPointerLeave={event=>{event.currentTarget.style.removeProperty("--glass-x");event.currentTarget.style.removeProperty("--glass-y");}}><div><h3><span>{card.lead}</span>{card.title&&<> {card.title}</>}</h3><p>{card.body}</p></div><footer><svg width="13" height="15" viewBox="0 0 16 18" fill="none" stroke="currentColor" strokeWidth="1" aria-hidden="true"><path d="M4 1h6l3 3v12H4zM10 1v4h3M6 8h5M6 11h4"/><circle cx="4" cy="10" r="2.5"/><path d="M2 12l-1 3"/></svg>{card.href?<a href={card.href} target="_blank" rel="noopener noreferrer">{card.citation}<span className="sr-only"> (opens study in a new tab)</span></a>:<cite>{card.citation}</cite>}</footer></article></div>)}
  </div>
  <p className="research-evidence-note">Research summaries describe associations and perception bias, not guaranteed personal outcomes. Appearance does not determine ability, health or worth.</p>
 </section>;
}
