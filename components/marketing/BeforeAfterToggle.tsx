"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

interface BeforeAfterToggleProps {
  beforeSrc: string;
  afterSrc: string;
  beforeLabel?: string;
  afterLabel?: string;
  aspectRatio?: string;
  className?: string;
  autoPlay?: boolean;
  imageFit?: "cover" | "contain";
}

/** An accessible before/after comparison with an optional animated reveal. */
export function BeforeAfterToggle({beforeSrc,afterSrc,beforeLabel="Before",afterLabel="After preview",aspectRatio="aspect-[4/5]",className="",autoPlay=false,imageFit="cover"}: BeforeAfterToggleProps){
  const [position,setPosition]=useState(50);
  const [isPaused,setIsPaused]=useState(false);
  useEffect(()=>{
    if(!autoPlay||isPaused||window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
    const started=performance.now();
    const interval=window.setInterval(()=>{
      const elapsed=(performance.now()-started)%7000;
      const sweep=(Math.sin((elapsed/7000)*Math.PI*2-Math.PI/2)+1)/2;
      setPosition(Math.round(14+sweep*72));
    },45);
    return()=>window.clearInterval(interval);
  },[autoPlay,isPaused]);
  const takeControl=()=>autoPlay&&setIsPaused(true);
  return <div className={`comparison ${className} ${autoPlay&&!isPaused?"comparison-auto-active":""}`}>
    <div className={`comparison-frame comparison-fit-${imageFit} relative ${aspectRatio}`}>
      <Image src={afterSrc} alt={afterLabel} fill sizes="(max-width: 640px) 90vw, (max-width: 1100px) 45vw, 30vw" className="comparison-image" />
      <div className="comparison-before" style={{clipPath:`inset(0 ${100-position}% 0 0)`}}>
        <Image src={beforeSrc} alt={beforeLabel} fill sizes="(max-width: 640px) 90vw, (max-width: 1100px) 45vw, 30vw" className="comparison-image" />
      </div>
      <div className="comparison-labels" aria-hidden="true"><span>{beforeLabel}</span><span>{afterLabel}</span></div>
      <div className="comparison-divider" style={{left:`${position}%`}} aria-hidden="true"><span><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 8l-4 4 4 4M15 8l4 4-4 4"/></svg></span></div>
      {autoPlay&&<button type="button" className="comparison-motion-toggle" onClick={()=>setIsPaused(value=>!value)} aria-pressed={!isPaused} aria-label={isPaused?"Play animated comparison":"Pause animated comparison"}>{isPaused?"Play":"Pause"}<span aria-hidden="true">{isPaused?"▶":"Ⅱ"}</span></button>}
      <input className="comparison-input" type="range" min="0" max="100" step="1" value={position} onPointerDown={takeControl} onFocus={takeControl} onChange={event=>setPosition(Number(event.target.value))} aria-label="Before and after comparison" aria-valuetext={`${position}% before, ${100-position}% after preview`} />
    </div>
  </div>;
}
