import Image from "next/image";
import { ContextGlassCard } from "./ContextGlassCard";
import "./personal-context.css";

const FACTORS = [
 { title: "Ethnic background", description: "Context for the diversity of facial features, proportions, and skin tones.", kind: "globe" },
 { title: "Personal preferences", description: "Your individual style, appearance goals, and comfort with change.", kind: "preferences" },
 { title: "Lifestyle factors", description: "The everyday context of sleep, hydration, nutrition, and sun exposure.", kind: "lifestyle" },
 { title: "Natural aging patterns", description: "How facial features and skin appearance can change over time.", kind: "aging" },
 { title: "Cultural beauty standards", description: "Personal aesthetics in the context of regional and cultural preferences.", kind: "culture" },
];

function ContextPreview({ kind }: { kind: string }) {
 if (kind === "globe") return <div className="context-globe-preview" aria-hidden="true"><svg viewBox="0 0 150 100" fill="none"><circle cx="75" cy="50" r="35"/><ellipse cx="75" cy="50" rx="17" ry="35"/><path d="M40 50h70M46 31h58M46 69h58M75 15v70"/><path className="context-continent" d="m56 31 15 6-5 13 17 4 6 16 11-11-5-17 11-9"/></svg><span>GLOBAL CONTEXT</span></div>;
 if (kind === "preferences") return <div className="context-portrait-strip" aria-hidden="true">{["female_character_05_before.png","female_character_06_before.png","dark_skinned_female_before.png"].map(src => <span key={src} style={{ position: "relative" }}><Image src={`/images/transformations/${src}`} fill sizes="50px" alt="" /></span>)}</div>;
 if (kind === "lifestyle") return <div className="context-lifestyle-preview" aria-hidden="true"><div><span>Sleep</span><strong>8.1<small>hrs</small></strong></div><div><span>Rhythm</span><b>83</b><i /></div></div>;
 if (kind === "aging") return <div className="context-aging-preview" aria-hidden="true"><span>SKIN / TIME</span><svg viewBox="0 0 150 100" fill="none"><path d="M15 78H140M25 78V61M58 78V49M91 78V35M124 78V20M20 58C53 56 91 39 130 19"/><circle cx="25" cy="61" r="3"/><circle cx="58" cy="49" r="3"/><circle cx="91" cy="35" r="3"/><circle cx="124" cy="20" r="3"/></svg></div>;
 return <div className="context-feature-preview" aria-hidden="true"><span style={{ position: "relative" }}><Image src="/images/transformations/dark_skinned_male_before.png" fill sizes="70px" alt="" /></span><span style={{ position: "relative" }}><Image src="/images/transformations/female_character_05_before.png" fill sizes="70px" alt="" /></span><i>FEATURE<br/>CONTEXT</i></div>;
}

export function PersonalContext() {
 return <section id="personal-context" className="personal-context" aria-labelledby="personal-context-heading">
  <header className="personal-context-heading"><span>Personalized analysis</span><h2 id="personal-context-heading">Taking into <em>account your...</em></h2></header>
  <ul className="personal-context-list">{FACTORS.map(factor=><li key={factor.kind}><ContextGlassCard label={factor.title}><div className="personal-context-art"><ContextPreview kind={factor.kind}/></div><div><h3>{factor.title}</h3><p>{factor.description}</p></div></ContextGlassCard></li>)}</ul>
 </section>;
}
