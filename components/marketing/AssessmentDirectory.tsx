"use client";

import Image from "next/image";
import { ZONES } from "./QovesAssessmentsExplorer";
import "./assessment-directory.css";

const GENERAL = ["First impression", "Facial proportions", "Bilateral symmetry", "Face shape", "Feature relationships", "Upper, middle and lower facial thirds", "Overall facial balance", "Appearance goals and priorities"];

export function AssessmentDirectory(){
 const categories=[{id:"general",name:"General Analysis",testsCount:GENERAL.length,measurements:GENERAL,highlight:"Your face as a connected whole"},...ZONES];
 return <section id="assessment-directory" className="assessment-directory" aria-labelledby="assessment-directory-heading"><header className="assessment-directory-heading"><Image src="/images/brand/mogaface-artwork.png" width={40} height={40} alt="Moga"/><h2 id="assessment-directory-heading"><span>160+</span> Aesthetic Assessments</h2><p>Explore the assessment areas in your Moga analysis.</p><div className="assessment-directory-badges"><span>◇ Personalized insights</span><span>⌂ From home</span></div></header>
 <div className="assessment-directory-list">{categories.map((category,index)=><details key={category.id} className="assessment-category" name="moga-assessment-directory"><summary><span className="assessment-category-icon" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none"><ellipse cx="24" cy="22" rx="12" ry="17"/><path d="M18 19h4m4 0h4M24 21l-2 8h4m-7 5h10M13 44l5-7m17 7-5-7"/><path className="assessment-icon-highlight" d={index===0?"M10 14h28M10 29h28M24 4v36":category.id==="eyes"?"M13 20q7-10 12 0 7-10 12 0":category.id==="brows"?"M14 15l8-2m4 0 8 2":category.id==="jaw"?"M12 25q2 14 12 17 10-3 12-17":"M12 25h24M24 6v35"}/></svg></span><strong>{category.name}</strong><span className="assessment-category-count">{category.testsCount} assessments</span><span className="assessment-expand" aria-hidden="true"/></summary><div className="assessment-category-content"><p>{category.highlight}</p><ul>{category.measurements.map(measurement=><li key={measurement}>{measurement}</li>)}</ul><a href="#assessments">Explore the interactive feature map <span aria-hidden="true">↗</span></a></div></details>)}</div></section>;
}
