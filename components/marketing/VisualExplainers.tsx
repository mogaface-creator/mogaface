import Image from "next/image";

/** Decorative teaching graphic: never derived from a user's photo or actual measurements. */
export function FaceIllustration({mode="thirds"}:{mode?:string}){
 const points=[[36,39],[42,38],[58,38],[64,39],[50,47],[42,56],[50,58],[58,56],[31,49],[34,62],[42,71],[50,75],[58,71],[66,62],[69,49],[50,25]];
 return <div className={`face-illustration face-mode-${mode}`}><Image src="/images/transformations/female_studio_before.webp" fill sizes="(max-width: 800px) 90vw, 40vw" alt="Example portrait with an illustrative facial feature overlay" /><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
 {mode==="thirds" && <><path d="M20 25H80M20 47H80M20 63H80M20 78H80"/><path d="M76 25V78"/><text x="80" y="36">A</text><text x="80" y="57">B</text><text x="80" y="72">C</text></>}
 {mode==="symmetry" && <><path d="M50 16V84" strokeDasharray="1.2 1.2"/><path d="M29 40Q50 24 71 40M33 58Q50 71 67 58M32 40L50 75L68 40"/><circle cx="50" cy="50" r="28" strokeDasharray=".7 2"/></>}
 {mode==="features" && <><path d="M36 39L42 38L50 47L58 38L64 39M42 56L50 47L58 56L50 58ZM31 49L34 62L42 71L50 75L58 71L66 62L69 49"/>{points.map(([x,y],i)=><circle key={i} cx={x} cy={y} r=".75" className="face-point"/>)}</>}
 </svg><div className="face-corner top-left"/><div className="face-corner bottom-right"/></div>;
}

export function FlowIllustration({step}:{step:number}){
 if(step===0)return <div className="flow-photo-stack"><div className="flow-photo side-left"><Image src="/images/transformations/male_jawline_before.webp" fill sizes="180px" alt="Illustrative portrait input"/></div><div className="flow-photo centre"><Image src="/images/transformations/female_studio_before.webp" fill sizes="220px" alt="Illustrative front portrait"/></div><div className="flow-photo side-right"><Image src="/images/transformations/female_glow_before.webp" fill sizes="180px" alt="Illustrative portrait input"/></div><span className="visual-caption">Example photos · use your own views in the assessment</span></div>;
 if(step===1)return <div className="flow-face"><FaceIllustration mode="features"/><span className="visual-caption">Illustrative feature map</span></div>;
 return <div className="flow-report"><Image src="/images/dossier/dossier_page_1.png" width={320} height={450} alt="Sample report layout"/><div className="flow-report-badge"><span>PDF</span><strong>Your protocol<br />& visuals</strong></div><span className="visual-caption">Sample report · not a personal result</span></div>;
}
