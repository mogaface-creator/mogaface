"use client";

import type { PointerEvent, ReactNode } from "react";

/** Shared pointer reflection for the context and learning cards. */
export function ContextGlassCard({ children, label }: { children: ReactNode; label: string }) {
 function moveLight(event: PointerEvent<HTMLElement>) {
  if (event.pointerType === "touch") return;
  const card = event.currentTarget;
  const bounds = card.getBoundingClientRect();
  card.style.setProperty("--glass-x", `${100 * (event.clientX - bounds.left) / bounds.width}%`);
  card.style.setProperty("--glass-y", `${100 * (event.clientY - bounds.top) / bounds.height}%`);
 }
 return <article className="personal-context-card" tabIndex={0} aria-label={label} onPointerMove={moveLight} onPointerLeave={event => {
  event.currentTarget.style.removeProperty("--glass-x");
  event.currentTarget.style.removeProperty("--glass-y");
 }}>{children}</article>;
}
