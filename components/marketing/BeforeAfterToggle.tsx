"use client";

import { useState } from "react";
import Image from "next/image";

interface BeforeAfterToggleProps {
  beforeSrc: string;
  afterSrc: string;
  beforeLabel?: string;
  afterLabel?: string;
  aspectRatio?: string;
  className?: string;
}

/** One quiet, keyboard-accessible comparison. No competing mode controls. */
export function BeforeAfterToggle({beforeSrc,afterSrc,beforeLabel="Before",afterLabel="After preview",aspectRatio="aspect-[4/5]",className=""}: BeforeAfterToggleProps){
  const [position,setPosition]=useState(50);
  return <div className={`comparison ${className}`}>
    <div className={`comparison-frame relative ${aspectRatio}`}>
      <Image src={afterSrc} alt={afterLabel} fill sizes="(max-width: 640px) 90vw, (max-width: 1100px) 45vw, 30vw" className="comparison-image" />
      <div className="comparison-before" style={{clipPath:`inset(0 ${100-position}% 0 0)`}}>
        <Image src={beforeSrc} alt={beforeLabel} fill sizes="(max-width: 640px) 90vw, (max-width: 1100px) 45vw, 30vw" className="comparison-image" />
      </div>
      <div className="comparison-labels" aria-hidden="true"><span>{beforeLabel}</span><span>{afterLabel}</span></div>
      <div className="comparison-divider" style={{left:`${position}%`}} aria-hidden="true"><span><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 8l-4 4 4 4M15 8l4 4-4 4"/></svg></span></div>
      <input className="comparison-input" type="range" min="0" max="100" step="1" value={position} onChange={event=>setPosition(Number(event.target.value))} aria-label="Before and after comparison" aria-valuetext={`${position}% before, ${100-position}% after preview`} />
    </div>
  </div>;
}
