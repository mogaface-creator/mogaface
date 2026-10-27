"use client";

import { useState } from "react";

interface AssessmentZone {
  id: string;
  name: string;
  testsCount: number;
  highlight: string;
  measurements: string[];
  protocolExample: string;
  expectedOutcome: string;
}

const ZONES: AssessmentZone[] = [
  {
    id: "jaw",
    name: "Jaw & Mandible",
    testsCount: 22,
    highlight: "Gonial Angle, Ramus Height & Submental Definition",
    measurements: [
      "Intergonial width vs Bizygomatic cheekbone ratio",
      "Mandibular plane angle (steepness of jawline)",
      "Submental adipose volume & platysma muscle banding",
      "Jaw-to-neck transition crispness and shadow depth",
    ],
    protocolExample: "HIFU focused ultrasound tightening, targeted masseter neuromodulation, and submental contouring.",
    expectedOutcome: "Sculpted separation between jaw and neck with razor-sharp lateral silhouette while retaining bone width.",
  },
  {
    id: "skin",
    name: "Skin & Pores",
    testsCount: 28,
    highlight: "Dermal Pore Texture, Melanin Uniformity & Blemish Clear",
    measurements: [
      "Active inflammatory papules and comedone density",
      "Post-inflammatory hyperpigmentation (PIH) depth",
      "Epidermal micro-pore diameter across cheek and forehead zones",
      "Sebum production balance and natural light reflection index",
    ],
    protocolExample: "Picosecond laser resurfacing, Azelaic Acid 10-15%, clinical chemical peels, and barrier repair lipids.",
    expectedOutcome: "Clean, radiant complexion with authentic human pore texture—zero plastic doll blur or fake filter look.",
  },
  {
    id: "eyes",
    name: "Eyes & Tear Troughs",
    testsCount: 19,
    highlight: "Infraorbital Volume, Canthal Tilt & Palpebral Fissure",
    measurements: [
      "Canthal tilt angle (positive vs neutral vs negative)",
      "Infraorbital hollowing depth and dark vascular fatigue circles",
      "Upper eyelid hooding and tarsal platform visibility",
      "Scleral whiteness and contrast against iris pigment",
    ],
    protocolExample: "Micro-cannula tear trough filler or PRF platelet-rich fibrin, caffeine eye serum, red-light periorbital therapy.",
    expectedOutcome: "Rested, energized gaze with restored infraorbital volume and preserved natural eyelid geometry.",
  },
  {
    id: "cheeks",
    name: "Cheeks & Midface",
    testsCount: 16,
    highlight: "Malar Apex Projection & Youthful Anterior Light",
    measurements: [
      "Anterior malar cheek projection (Hinderer's lines)",
      "Midface ratio (interpupillary distance vs mouth line)",
      "Submalar hollowing and buccal fat prominence",
      "Zygomatic arch width vs lower face harmony",
    ],
    protocolExample: "Deep supraperiosteal micro-volumization or bio-stimulatory PLLA for subtle anterior cheek elevation.",
    expectedOutcome: "Youthful anterior light reflection without artificial overfilled 'chipmunk' cheek distortion.",
  },
  {
    id: "eyebrows",
    name: "Eyebrows",
    testsCount: 12,
    highlight: "Brow Apex Position, Arch Angle & Medial Spacing",
    measurements: [
      "Brow apex height relative to supraorbital rim",
      "Medial brow distance vs nasal bridge width",
      "Dynamic frontalis muscle tension creases",
      "Follicular density and horizontal tail length",
    ],
    protocolExample: "Targeted frontalis neuromodulator, precision grooming, strategic brow shading to increase perceived contrast.",
    expectedOutcome: "Clean, relaxed brow positioning with open, alert gaze and balanced masculine/feminine framing.",
  },
  {
    id: "nose",
    name: "Nose",
    testsCount: 18,
    highlight: "Nasolabial Angle, Dorsal Line & Tip Projection",
    measurements: [
      "Nasolabial angle (90°-95° men, 95°-105° women)",
      "Dorsal bridge symmetry and radix depth",
      "Alar base width relative to intercanthal distance",
      "Nasal tip rotation and supra-tip break definition",
    ],
    protocolExample: "Non-surgical liquid rhinoplasty (micro-droplet HA filler) to smooth dorsal bumps or refine tip balance.",
    expectedOutcome: "Straight, harmonious profile transition aligned with golden ratio facial thirds.",
  },
  {
    id: "lips",
    name: "Lips & Philtrum",
    testsCount: 14,
    highlight: "Philtrum Column Height, Vermilion Ratio & Cupid's Bow",
    measurements: [
      "Philtrum length vs lower chin proportion (1:2 golden ratio)",
      "Upper-to-lower lip volume ratio (1:1.6 ideal aesthetic balance)",
      "Oral commissure angle (upturned vs resting down-turn)",
      "Vermilion border crispness and Cupid's bow symmetry",
    ],
    protocolExample: "Micro-droplet lip hydration, philtrum column definition, and DAO neuromodulator to elevate resting mouth posture.",
    expectedOutcome: "Naturally hydrated, proportionate lip contours without duck-bill or shelf protrusion.",
  },
  {
    id: "chin",
    name: "Chin",
    testsCount: 11,
    highlight: "Pogonion Projection & Ricketts' E-Line Balance",
    measurements: [
      "Anteroposterior chin projection relative to lower lip",
      "Vertical chin height vs middle third",
      "Mentalis muscle hyper-contraction (orange-peel chin texture)",
      "Labiomental sulcus depth and curve",
    ],
    protocolExample: "Structural chin apex dermal filler, mentalis Botox relaxation, and resting tongue posture correction.",
    expectedOutcome: "Balanced profile projection that brings the chin precisely in line with Ricketts' aesthetic plane.",
  },
  {
    id: "smile",
    name: "Smile & Dentition",
    testsCount: 9,
    highlight: "Buccal Corridors, Incisal Display & Gingival Show",
    measurements: [
      "Incisal edge display at resting state and full smile",
      "Gingival (gum) display during dynamic smiling",
      "Buccal corridor negative space width",
      "Enamel shade value and brightness contrast",
    ],
    protocolExample: "Clinical teeth whitening, Gummy smile neuromodulator relaxation, and oral posture alignment.",
    expectedOutcome: "Broad, luminous smile filling buccal corridors with optimal tooth-to-lip harmony.",
  },
  {
    id: "neck",
    name: "Neck & Posture",
    testsCount: 8,
    highlight: "Cervicomedullary Angle & Sternocleidomastoid Tone",
    measurements: [
      "Cervico-mental angle (ideal: 105°-120°)",
      "Platysma neck band tension during animation",
      "Forward head posture angle (ear-to-shoulder alignment)",
      "Trapezius muscle hypertrophy vs neck elongation",
    ],
    protocolExample: "Nefertiti neck lift (platysma Botox), cervical postural alignment drills, and submental skin firming.",
    expectedOutcome: "Long, distinct neck silhouette with improved jawline separation and elegant resting posture.",
  },
  {
    id: "hair",
    name: "Hair & Hairline",
    testsCount: 10,
    highlight: "Norwood/Ludwig Classification & Temporal Framing",
    measurements: [
      "Frontotemporal hairline recession depth",
      "Follicular shaft diameter and crown miniaturization",
      "Hairline height relative to upper facial third",
      "Facial hair density and jawline contour integration",
    ],
    protocolExample: "Topical minoxidil, micro-needling, scalp PRP, precision hairline shaping, or beard trimming for jawline width.",
    expectedOutcome: "Dense, youthfully framed hairline that balances upper facial thirds and complements skull shape.",
  },
];

export function QovesAssessmentsExplorer() {
  const [activeId, setActiveId] = useState("jaw");
  const current = ZONES.find((z) => z.id === activeId) || ZONES[0];

  return (
    <section id="assessments" className="py-20 sm:py-28 bg-[#ffffff] border-b border-[#e6ebed]">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        {/* Section Header */}
        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#71858c]">
            Comprehensive Diagnostic Precision
          </p>
          <h2 className="mt-4 text-3xl sm:text-5xl font-medium tracking-tight text-[#141e22] leading-[1.12]">
            160+ Aesthetic Assessments
          </h2>
          <p className="mt-4 text-base sm:text-lg text-[#556970]">
            Explore how each feature is measured with sub-millimeter precision and translated into actionable non-surgical protocols:
          </p>
        </div>

        {/* Feature Tabs Selector */}
        <div className="mt-10 flex flex-wrap gap-2 pb-2">
          {ZONES.map((zone) => {
            const isActive = zone.id === activeId;
            return (
              <button
                key={zone.id}
                onClick={() => setActiveId(zone.id)}
                className={`px-4 py-2 rounded-full text-xs font-medium transition-all ${
                  isActive
                    ? "bg-[#182327] text-white shadow-xs"
                    : "bg-[#f5f8f9] text-[#55686f] hover:bg-[#eaf0f2] hover:text-[#182327]"
                }`}
              >
                <span>{zone.name}</span>
                <span className={`ml-1.5 text-[10px] ${isActive ? "text-slate-300" : "text-[#87999f]"}`}>
                  ({zone.testsCount})
                </span>
              </button>
            );
          })}
        </div>

        {/* Active Zone Detail Card */}
        <div className="mt-8 rounded-2xl border border-[#e2e7e9] bg-[#fafcfc] p-7 sm:p-10 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-[#e8eded] gap-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#73888f]">
                Feature Deep Dive ({current.testsCount} Automated Tests)
              </span>
              <h3 className="text-2xl sm:text-3xl font-medium text-[#141e22] mt-1">
                {current.name} Assessment
              </h3>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#eef3f5] border border-[#dce5e8] text-xs font-semibold text-[#28383e]">
              <span>Key Focus:</span>
              <span className="text-[#141e22]">{current.highlight}</span>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left: Measurements */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#697d84] mb-4">
                What We Measure:
              </h4>
              <ul className="space-y-3">
                {current.measurements.map((m, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-[#45585f]">
                    <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-[#182327] mt-2" />
                    <span>{m}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right: Protocol & Outcome */}
            <div className="rounded-xl border border-[#e2e7e9] bg-[#ffffff] p-6 flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-[#697d84] mb-2">
                  Sample Non-Surgical Protocol:
                </h4>
                <p className="text-sm font-medium text-[#182327] leading-relaxed">
                  {current.protocolExample}
                </p>

                <h4 className="text-xs font-bold uppercase tracking-wider text-[#697d84] mt-6 mb-2">
                  Targeted Outcome:
                </h4>
                <p className="text-sm text-[#556970] leading-relaxed">
                  {current.expectedOutcome}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-[#f0f4f6] flex items-center justify-between text-xs text-[#71858c]">
                <span>✓ 100% Identity-Locked</span>
                <span>✓ Evidence-Based</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
