import Image from "next/image";
import { ContextGlassCard } from "./ContextGlassCard";
import "./personal-context.css";

const LESSONS = [
 { title: "Your Moga biometrics", description: "Understand the facial proportions and measurements in your report.", kind: "scores" },
 { title: "How each feature shapes your appearance", description: "Explore individual features and their contribution to your overall appearance.", kind: "features" },
 { title: "The harmony of your face", description: "See how proportions, symmetry, and features relate to one another.", kind: "harmony" },
 { title: "Your features with the most potential", description: "Explore the areas highlighted in your personalized improvement plan.", kind: "potential" },
 { title: "The science behind your protocol", description: "Understand the reasoning and research behind your recommendations.", kind: "science" },
];

function LearningPreview({ kind }: { kind: string }) {
 if (kind === "scores") return <div className="learning-score-preview" aria-hidden="true"><span>FACIAL INDEX</span><strong>82</strong><small>balanced</small><i /></div>;
 if (kind === "features") return <div className="learning-feature-preview" aria-hidden="true">{["female_character_05_before.png", "female_character_06_before.png", "dark_skinned_female_before.png"].map(src => <span key={src} style={{ position: "relative" }}><Image src={`/images/transformations/${src}`} fill sizes="50px" alt="" /></span>)}<b>FEATURE MAP</b></div>;
 if (kind === "harmony") return <div className="learning-harmony-preview" aria-hidden="true"><span style={{ position: "relative" }}><Image src="/images/transformations/dark_skinned_male_before.png" fill sizes="70px" alt="" /></span><i /><b>RELATIONSHIPS</b></div>;
 if (kind === "potential") return <div className="learning-potential-preview" aria-hidden="true"><span>FEATURE SCORE</span><p><i /> Eyes <b>86</b></p><p><i /> Jawline <b>81</b></p><p><i /> Skin tone <b>75</b></p></div>;
 return <div className="learning-science-preview" aria-hidden="true"><span>RESEARCH</span><b>evidence<br/>in context</b><i style={{ position: "relative" }}><Image src="/images/transformations/female_character_05_before.png" fill sizes="40px" alt="" /></i></div>;
}

export function LearningOverview() {
 return <section id="you-will-learn" className="personal-context learning-overview" aria-labelledby="learning-heading">
  <header className="personal-context-heading"><span>Informative</span><h2 id="learning-heading">You will <em>learn..</em></h2></header>
  <ul className="personal-context-list">{LESSONS.map(lesson=><li key={lesson.kind}><ContextGlassCard label={lesson.title}><div className="personal-context-art"><LearningPreview kind={lesson.kind}/></div><div><h3>{lesson.title}</h3><p>{lesson.description}</p></div></ContextGlassCard></li>)}</ul>
 </section>;
}
