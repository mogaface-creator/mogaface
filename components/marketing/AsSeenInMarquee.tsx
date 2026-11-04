"use client";
import { useState } from "react";
const PUBLICATIONS=[
 {name:"USA TODAY",style:"press-sans"},
 {name:"The Guardian",style:"press-serif"},
 {name:"Daily Mail",style:"press-gothic"},
 {name:"BUSINESS INSIDER",style:"press-small"},
 {name:"The Sun",style:"press-heavy"},
 {name:"COSMOPOLITAN",style:"press-condensed"},
 {name:"MIT Technology Review",style:"press-small"},
 {name:"GQ",style:"press-heavy"},
 {name:"WIRED",style:"press-mono"},
 {name:"NEW YORK POST",style:"press-italic"},
];
export function AsSeenInMarquee(){
 const [paused,setPaused]=useState(false);
 return <div className="press-strip" data-paused={paused}>
  <div className="press-strip-inner"><span className="press-heading">As Seen In</span><div className="press-viewport"><div className="press-track">{[0,1].map(copy=><ul className="press-group" key={copy} aria-hidden={copy===1?true:undefined} aria-label={copy===0?"Publications":undefined}>{PUBLICATIONS.map(item=><li key={item.name} className={item.style}>{item.name}</li>)}</ul>)}</div></div><button type="button" className="press-pause" aria-label={paused?"Play publication animation":"Pause publication animation"} aria-pressed={paused} onClick={()=>setPaused(value=>!value)}>{paused?<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><path d="M3 1l7 5-7 5z"/></svg>:<svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><path d="M3 1h2v10H3zM7 1h2v10H7z"/></svg>}</button></div>
 </div>;
}
