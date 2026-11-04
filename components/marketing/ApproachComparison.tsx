import Image from "next/image";
import "./approach-comparison.css";

const OLD_STEPS = ["Fixate on one feature", "Visit a clinic", "No assessment", "Unnecessary surgery", "Poor results"];
const NEW_STEPS = ["Consider your face holistically", "Moga Analysis", "See your future self", "Personalized protocol", "Make informed choices"];

export function ApproachComparison() {
 return <section id="our-approach" className="approach-comparison" aria-labelledby="approach-heading">
  <div className="approach-heading"><span className="approach-eyebrow">Personalized analysis</span><h2 id="approach-heading">A new way to <span>glow-up</span></h2><p>The beauty industry is broken, with companies and doctors giving “one size fits all” advice,<br className="approach-desktop-break"/> and many people undergoing unnecessary procedures they don’t need.</p></div>
  <div className="approach-row-shell"><div className="approach-row approach-old"><div className="approach-row-label"><span className="approach-symbol" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M5 19L19 5"/></svg></span><h3>The old way</h3></div><ol className="approach-steps" aria-label="The old way">{OLD_STEPS.map((text,index)=><li key={text}><span className="approach-step-dot" aria-hidden="true"/><span className="approach-step-number">Step {index+1}</span><p>{text}</p></li>)}</ol></div></div>
  <div className="approach-row-shell"><div className="approach-row approach-new"><div className="approach-row-label"><span className="approach-symbol"><Image src="/images/brand/mogaface-artwork.png" width={24} height={24} alt="Moga"/></span><h3>The new way</h3></div><ol className="approach-steps" aria-label="The Moga way">{NEW_STEPS.map((text,index)=><li key={text}><span className="approach-step-dot" aria-hidden="true"/><span className="approach-step-number">Step {index+1}</span><p>{text}</p></li>)}</ol></div></div>
 </section>;
}
