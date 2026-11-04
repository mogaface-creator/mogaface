import { ContextGlassCard } from "./ContextGlassCard";
import "./personal-context.css";

const LESSONS = [
 { title: "Your Moga biometrics", description: "Understand the facial proportions and measurements in your report.", kind: "scores" },
 { title: "How each feature shapes your appearance", description: "Explore individual features and their contribution to your overall appearance.", kind: "features" },
 { title: "The harmony of your face", description: "See how proportions, symmetry, and features relate to one another.", kind: "harmony" },
 { title: "Your features with the most potential", description: "Explore the areas highlighted in your personalized improvement plan.", kind: "potential" },
 { title: "The science behind your protocol", description: "Understand the reasoning and research behind your recommendations.", kind: "science" },
];

function LearningIllustration({ kind }: { kind: string }) {
 return <svg viewBox="0 0 112 78" fill="none" aria-hidden="true">
  <rect width="112" height="78" rx="7" fill="currentColor" opacity=".08"/>
  <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
   {kind === "scores" ? <><circle cx="56" cy="39" r="25" opacity=".35"/><path d="M34 51a25 25 0 1 1 43-2" strokeWidth="3"/><path d="m56 39 12-13M44 56h24"/><circle cx="56" cy="39" r="3"/></> : kind === "features" ? <>{[27,56,85].map(x=><g key={x} transform={`translate(${x},0)`}><ellipse cy="33" rx="10" ry="15"/><path d="M-6 31h3m6 0h3m-6 10h6M-17 64q0-16 17-16t17 16"/></g>)}</> : kind === "harmony" ? <><ellipse cx="56" cy="38" rx="20" ry="27"/><path d="M56 8v62M29 29h54M29 47h54M42 29v18m28-18v18M49 56h14" strokeDasharray="3 3"/><circle cx="43" cy="33" r="2"/><circle cx="69" cy="33" r="2"/></> : kind === "potential" ? <><path d="M18 59h77M26 59V45h12v14m12 0V33h12v26m12 0V20h12v39M25 31l23-12 17 4L88 9m-10 0h10v10"/></> : <><rect x="29" y="11" width="48" height="56" rx="4"/><path d="M40 23h26M40 30h18M40 52h26M40 58h20M44 39l5 5 11-10"/><circle cx="76" cy="52" r="10"/><path d="m83 60 8 8"/></>}
  </g>
 </svg>;
}

export function LearningOverview() {
 return <section id="you-will-learn" className="personal-context learning-overview" aria-labelledby="learning-heading">
  <header className="personal-context-heading"><span>Informative</span><h2 id="learning-heading">You will <em>learn..</em></h2></header>
  <ul className="personal-context-list">{LESSONS.map(lesson=><li key={lesson.kind}><ContextGlassCard label={lesson.title}><div className="personal-context-art"><LearningIllustration kind={lesson.kind}/></div><div><h3>{lesson.title}</h3><p>{lesson.description}</p></div></ContextGlassCard></li>)}</ul>
 </section>;
}
