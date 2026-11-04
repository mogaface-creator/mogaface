import { ContextGlassCard } from "./ContextGlassCard";
import "./personal-context.css";

const FACTORS = [
 { title: "Ethnic background", description: "Context for the diversity of facial features, proportions, and skin tones.", kind: "globe" },
 { title: "Personal preferences", description: "Your individual style, appearance goals, and comfort with change.", kind: "preferences" },
 { title: "Lifestyle factors", description: "The everyday context of sleep, hydration, nutrition, and sun exposure.", kind: "lifestyle" },
 { title: "Natural aging patterns", description: "How facial features and skin appearance can change over time.", kind: "aging" },
 { title: "Cultural beauty standards", description: "Personal aesthetics in the context of regional and cultural preferences.", kind: "culture" },
];

function ContextIllustration({ kind }: { kind: string }) {
 return <svg viewBox="0 0 112 78" fill="none" aria-hidden="true">
  <rect width="112" height="78" rx="7" fill="currentColor" opacity=".1"/>
  {kind === "globe" ? <g stroke="currentColor" strokeWidth="1"><circle cx="56" cy="39" r="28"/><ellipse cx="56" cy="39" rx="13" ry="28"/><path d="M28 39h56M32 25h48M32 53h48M56 11v56"/><path d="m40 20 12 6-4 10 12 5 3 15 9-9-3-13 7-6" strokeWidth="2"/></g> : kind === "preferences" || kind === "culture" ? <g stroke="currentColor" strokeWidth="1.3">{[25,56,87].map((x,i)=><g key={x} transform={`translate(${x}, 0)`}><path d={i===1?"M-12 34C-16 8 16 8 12 34":"M-11 35C-17 13 17 13 11 35"}/><ellipse cy="33" rx="10" ry="14"/><path d="M-6 33h3m6 0h3m-7 8h4M-18 65q0-18 18-18t18 18"/></g>)}</g> : kind === "lifestyle" ? <g stroke="currentColor" strokeWidth="1.4"><rect x="12" y="15" width="40" height="48" rx="5"/><rect x="59" y="15" width="40" height="48" rx="5"/><path d="M22 26h20M22 33h13M22 52h20M70 52h18M81 24a10 10 0 1 0 8 16 11 11 0 0 1-8-16Z"/><path d="M26 44h4m4 0h4"/></g> : <g stroke="currentColor" strokeWidth="1.2"><path d="M17 58h78M24 58V45m21 13V36m21 22V27m21 31V18M21 37q35-2 66-25"/><circle cx="24" cy="45" r="3"/><circle cx="45" cy="36" r="3"/><circle cx="66" cy="27" r="3"/><circle cx="87" cy="18" r="3"/></g>}
 </svg>;
}

export function PersonalContext() {
 return <section id="personal-context" className="personal-context" aria-labelledby="personal-context-heading">
  <header className="personal-context-heading"><span>Personalized analysis</span><h2 id="personal-context-heading">Taking into <em>account your...</em></h2></header>
  <ul className="personal-context-list">{FACTORS.map(factor=><li key={factor.kind}><ContextGlassCard label={factor.title}><div className="personal-context-art"><ContextIllustration kind={factor.kind}/></div><div><h3>{factor.title}</h3><p>{factor.description}</p></div></ContextGlassCard></li>)}</ul>
 </section>;
}
