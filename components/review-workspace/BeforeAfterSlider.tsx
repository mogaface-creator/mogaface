"use client";

import { useState, type CSSProperties } from "react";
import Image from "next/image";
import { COMPARE_STYLES } from "@/lib/review-workspace/compareStyles.ts";
import type { ReviewImage } from "@/lib/review-workspace/types.ts";

type ComparisonPhoto = Pick<ReviewImage, "base64" | "mime">;

export function BeforeAfterSlider({ before, after, draft }: { before: ComparisonPhoto; after: ComparisonPhoto; draft: boolean }) {
  const [position, setPosition] = useState(50);
  const beforeSrc = `data:${before.mime};base64,${before.base64}`;
  const afterSrc = `data:${after.mime};base64,${after.base64}`;
  return (
    <figure className="moga-compare">
      <style>{COMPARE_STYLES}</style>
      <div className="moga-compare__frame" style={{ "--reveal": `${position}%` } as CSSProperties}>
        <Image unoptimized src={beforeSrc} alt="" aria-hidden="true" width={1000} height={1333} className="moga-compare__size" />
        <Image unoptimized src={afterSrc} alt="After: AI appearance illustration" width={1000} height={1333} className="moga-compare__after" />
        <Image unoptimized src={beforeSrc} alt="Before: original photograph" width={1000} height={1333} className="moga-compare__before" />
        <span className="moga-compare__divider" aria-hidden="true" />
      </div>
      <input className="moga-compare__slider" type="range" min={0} max={100} value={position} onChange={event => setPosition(event.currentTarget.valueAsNumber)}
        aria-label="Before and after comparison" aria-valuetext={`${position}% original`} />
      <figcaption className="moga-compare__labels"><span>Before · original</span><span>{draft ? "After · revision draft" : "After · AI illustration"}</span></figcaption>
      <p className="moga-compare__hint">Drag the slider below the photo or use the arrow keys to compare.</p>
    </figure>
  );
}
