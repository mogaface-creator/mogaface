"use client";

import Image from "next/image";
import { useState } from "react";
import { AssessmentIcon } from "./AssessmentIcon";
import { ASSESSMENT_CATALOG, ASSESSMENT_TOTAL } from "./assessment-catalog";
import "./assessment-directory.css";

export function AssessmentDirectory() {
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  return (
    <section id="assessments" className="assessment-directory" aria-labelledby="assessment-directory-heading">
      <header className="assessment-directory-heading">
        <Image src="/images/brand/mogaface-artwork.png" width={40} height={40} alt="Moga" />
        <h2 id="assessment-directory-heading"><span>160+</span> Aesthetic assessments</h2>
        <p>{ASSESSMENT_TOTAL} visual assessment areas, organized by feature. Open a section to review every area included.</p>
        <div className="assessment-directory-badges" aria-label="Assessment service details">
          <span>Personalized insights</span><span>From home</span>
        </div>
      </header>

      <div className="assessment-directory-list">
        {ASSESSMENT_CATALOG.map((category) => (
          <details
            key={category.id}
            className="assessment-category"
            open={openCategory === category.id}
            onToggle={(event) => setOpenCategory(event.currentTarget.open ? category.id : null)}
          >
            <summary>
              <span className="assessment-category-icon" aria-hidden="true"><AssessmentIcon category={category.id} /></span>
              <span className="assessment-summary-copy"><strong>{category.name}</strong><small>{category.summary}</small></span>
              <span className="assessment-category-count">{category.items.length} assessments</span>
              <span className="assessment-expand" aria-hidden="true" />
            </summary>
            <div className="assessment-category-content">
              <ul>
                {category.items.map((item) => <li key={item.title}><strong>{item.title}</strong><span>{item.description}</span></li>)}
              </ul>
              <p className="assessment-directory-disclaimer">This directory describes what can be reviewed from suitable photos. It is not a diagnosis, medical advice, or a promise that every item can be measured from every upload.</p>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
