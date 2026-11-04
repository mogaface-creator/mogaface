"use client";
import { useState } from "react";
import { BeforeAfterToggle } from "./BeforeAfterToggle";
interface CaseStudy {
  id: string;
  category: "jawline" | "eyes" | "skin" | "all";
  name: string;
  age: string;
  focusArea: string;
  beforeSrc: string;
  afterSrc: string;
  metrics: { label: string; value: string }[];
  clinicalFinding: string;
}

const CASES: CaseStudy[] = [
  {
    id: "case-1",
    category: "eyes",
    name: "Elena R.",
    age: "32",
    focusArea: "Tear Trough & Midface Harmony",
    beforeSrc: "/images/transformations/female_studio_before.webp",
    afterSrc: "/images/transformations/female_studio_after.webp",
    metrics: [
      { label: "Periorbital Volume", value: "+35% Lift" },
      { label: "Tear Trough Shadow", value: "Restored" },
      { label: "Facial Symmetry", value: "96% Index" },
    ],
    clinicalFinding:
      "Tear trough hollowing softened with gentle anterior cheek volume restoration, establishing natural youthful light reflection without surgery.",
  },
  {
    id: "case-2",
    category: "jawline",
    name: "Lucas M.",
    age: "32",
    focusArea: "Mandibular Angle & Jawline Definition",
    beforeSrc: "/images/transformations/male_jawline_before.webp",
    afterSrc: "/images/transformations/male_jawline_after.webp",
    metrics: [
      { label: "Jaw-to-Neck Separation", value: "+28% Definition" },
      { label: "Cervical Angle", value: "112° Sculpted" },
      { label: "Submental Volume", value: "Streamlined" },
    ],
    clinicalFinding:
      "Crisp lower mandibular definition and submental soft-tissue contouring, eliminating fatigue signals while preserving authentic bone structure.",
  },
  {
    id: "case-3",
    category: "skin",
    name: "Sofia V.",
    age: "28",
    focusArea: "Midface Contour & Complexion Radiance",
    beforeSrc: "/images/transformations/female_glow_before.webp",
    afterSrc: "/images/transformations/female_glow_after.webp",
    metrics: [
      { label: "Complexion Luminosity", value: "Hydrated Glow" },
      { label: "Cheek Apex Vector", value: "Elevated" },
      { label: "Blemish Clarity", value: "Cleared" },
    ],
    clinicalFinding:
      "Luminous complexion enhancement paired with midface malar contouring, softening nasolabial shadows with authentic dermal pore micro-texture.",
  },
  {
    id: "case-4",
    category: "all",
    name: "Marcus D.",
    age: "35",
    focusArea: "Full Facial Balancing & Forehead Architecture",
    beforeSrc: "/images/transformations/male_lifestyle_before.webp",
    afterSrc: "/images/transformations/male_lifestyle_after.webp",
    metrics: [
      { label: "Forehead Line Depth", value: "-45% Softened" },
      { label: "Periorbital Rest", value: "Energized" },
      { label: "Profile Balance", value: "Harmonious" },
    ],
    clinicalFinding:
      "Integrated forehead line relaxation and under-eye hollow restoration, translating tired baseline into an energized, confident clinical projection.",
  },
];


const CATEGORIES=[{id:"all",label:"All cases"},{id:"eyes",label:"Tear troughs & eyes"},{id:"jawline",label:"Jawline & mandible"},{id:"skin",label:"Skin & tone"}];
export function TransformationShowcase(){
 const [category,setCategory]=useState("all");
 const [page,setPage]=useState(0);
 const filtered=category==="all"?CASES:CASES.filter(item=>item.category===category);
 const pageCount=Math.ceil(filtered.length/2);
 const visible=filtered.slice(page*2,page*2+2);
 return <section id="transformations" className="transformation-showcase"><div className="transformation-layout mx-auto">
  <div className="case-intro"><p className="visual-eyebrow">A closer look</p><h2>Life-changing<br/><span>Transformations</span></h2><p>Explore the original and illustrative preview side by side. Move the divider to see the difference.</p></div>
  <nav className="case-filters" aria-label="Transformation categories">{CATEGORIES.map((item,i)=><button key={item.id} aria-pressed={category===item.id} onClick={()=>{setCategory(item.id);setPage(0)}}><span className="case-filter-index" aria-hidden="true">0{i+1}</span>{item.label}<span className="case-filter-arrow" aria-hidden="true">↗</span></button>)}</nav>
  <div className="case-gallery"><div className="case-grid">{visible.map(item=><article className="case-card" key={item.id}>
   <BeforeAfterToggle beforeSrc={item.beforeSrc} afterSrc={item.afterSrc} beforeLabel="Before" afterLabel="After preview" aspectRatio="aspect-[4/5]"/>
   <div className="case-caption"><div><h3>{item.name}<span>, {item.age}</span></h3><p>{item.focusArea}</p></div><details className="case-more"><summary aria-label={`Details for ${item.name}`}>Details <span aria-hidden="true">+</span></summary><div className="case-expanded"><p>{item.clinicalFinding}</p><dl>{item.metrics.map(metric=><div key={metric.label}><dt>{metric.label}</dt><dd>{metric.value}</dd></div>)}</dl><p className="case-disclaimer">Illustrative example. Individual outcomes vary.</p></div></details></div>
  </article>)}</div>
  {pageCount>1&&<div className="case-pagination"><span>0{page+1} <span>/ 0{pageCount}</span></span><div><button type="button" aria-label="Previous transformations" disabled={page===0} onClick={()=>setPage(value=>value-1)}>←</button><button type="button" aria-label="Next transformations" disabled={page===pageCount-1} onClick={()=>setPage(value=>value+1)}>→</button></div></div>}
  </div>
 </div></section>;
}
