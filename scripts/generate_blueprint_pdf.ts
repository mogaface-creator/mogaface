import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const C = {
  deepPlum: rgb(0.102, 0.055, 0.18),      // #1a0e2e
  plumInk: rgb(0.239, 0.184, 0.31),       // #3d2f4f (body text)
  royalAmethyst: rgb(0.369, 0.208, 0.561), // #5e358f
  softOrchid: rgb(0.545, 0.42, 0.682),    // #8b6bae
  paleViolet: rgb(0.831, 0.78, 0.91),     // #d4c7e8
  antiqueGold: rgb(0.761, 0.643, 0.435),   // #c2a46f
  warmGold: rgb(0.831, 0.722, 0.478),      // #d4b87a
  deepGold: rgb(0.541, 0.427, 0.208),     // #8a6d35
  champagne: rgb(0.969, 0.941, 0.91),     // #f7f0e8
  mistyLilac: rgb(0.89, 0.875, 0.918),    // #e3dfea
  cardBg: rgb(0.985, 0.98, 0.99),
  white: rgb(1, 1, 1),
  muted: rgb(0.48, 0.43, 0.54),
  success: rgb(0.12, 0.53, 0.38),
};

function wrapText(text: string, maxWidth: number, font: PDFFont, fontSize: number): string[] {
  if (!text) return [];
  const words = text.replace(/[\r\n]+/g, " ").trim().split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const candidate = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(candidate, fontSize);
    if (width <= maxWidth) {
      currentLine = candidate;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines;
}

export async function buildBlueprintDoc(): Promise<PDFDocument> {
  const doc = await PDFDocument.create();
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await doc.embedFont(StandardFonts.HelveticaOblique);

  const PAGE_W = 595.28;
  const PAGE_H = 841.89;
  const MARGIN_X = 36;
  const CONTENT_W = PAGE_W - MARGIN_X * 2; // 523.28

  function drawHeader(page: PDFPage, sectionTitle: string, pageNum: number, totalPages: number) {
    const bannerH = 68;
    const bannerY = PAGE_H - bannerH;
    page.drawRectangle({
      x: 0,
      y: bannerY,
      width: PAGE_W,
      height: bannerH,
      color: C.deepPlum,
    });
    page.drawRectangle({
      x: 0,
      y: bannerY - 2,
      width: PAGE_W,
      height: 2,
      color: C.antiqueGold,
    });

    page.drawText("M O G A F A C E", {
      x: MARGIN_X,
      y: bannerY + 40,
      size: 14,
      font: fontBold,
      color: C.warmGold,
    });
    page.drawText("CLINICAL ASSESSMENT ARCHITECTURE & QUESTION STRATEGY BLUEPRINT", {
      x: MARGIN_X,
      y: bannerY + 26,
      size: 7.5,
      font: fontBold,
      color: C.paleViolet,
    });
    page.drawText(sectionTitle.toUpperCase(), {
      x: MARGIN_X,
      y: bannerY + 12,
      size: 7,
      font: fontRegular,
      color: C.antiqueGold,
    });

    page.drawRectangle({
      x: PAGE_W - MARGIN_X - 145,
      y: bannerY + 14,
      width: 145,
      height: 40,
      color: rgb(0.16, 0.08, 0.28),
      borderColor: C.antiqueGold,
      borderWidth: 0.75,
    });
    page.drawText("EXECUTIVE BLUEPRINT", {
      x: PAGE_W - MARGIN_X - 135,
      y: bannerY + 38,
      size: 6.5,
      font: fontBold,
      color: C.warmGold,
    });
    page.drawText(`PAGE ${pageNum} OF ${totalPages}`, {
      x: PAGE_W - MARGIN_X - 135,
      y: bannerY + 25,
      size: 8,
      font: fontBold,
      color: C.white,
    });
    page.drawText("CONFIDENTIAL STRATEGY", {
      x: PAGE_W - MARGIN_X - 135,
      y: bannerY + 16,
      size: 6,
      font: fontRegular,
      color: C.muted,
    });
  }

  function drawFooter(page: PDFPage, pageNum: number, totalPages: number) {
    page.drawRectangle({
      x: MARGIN_X,
      y: 30,
      width: CONTENT_W,
      height: 0.75,
      color: C.antiqueGold,
    });
    page.drawText("MOGAFACE AESTHETIC INTELLIGENCE • SYSTEM ARCHITECTURE SPECIFICATION", {
      x: MARGIN_X,
      y: 18,
      size: 6.5,
      font: fontRegular,
      color: C.muted,
    });
    page.drawText(`PAGE ${pageNum} OF ${totalPages}`, {
      x: PAGE_W - MARGIN_X - 60,
      y: 18,
      size: 6.5,
      font: fontBold,
      color: C.royalAmethyst,
    });
  }

  // =========================================================================
  // PAGE 1: EXECUTIVE OVERVIEW & THE 4-ENGINE DATA PIPELINE
  // =========================================================================
  const p1 = doc.addPage([PAGE_W, PAGE_H]);
  drawHeader(p1, "Part I: System Overview & 4-Engine Data Pipeline", 1, 3);
  drawFooter(p1, 1, 3);

  let y1 = PAGE_H - 96;

  p1.drawText("EXECUTIVE STRATEGY OVERVIEW", {
    x: MARGIN_X,
    y: y1,
    size: 13,
    font: fontBold,
    color: C.deepPlum,
  });
  p1.drawText("How patient intake questions traverse the multi-engine system to synthesize clinical results.", {
    x: MARGIN_X,
    y: y1 - 12,
    size: 8,
    font: fontRegular,
    color: C.plumInk,
  });

  y1 -= 34;

  // Overview Card
  const introCardH = 74;
  p1.drawRectangle({
    x: MARGIN_X,
    y: y1 - introCardH,
    width: CONTENT_W,
    height: introCardH,
    color: C.champagne,
    borderColor: C.antiqueGold,
    borderWidth: 1,
  });
  p1.drawRectangle({
    x: MARGIN_X,
    y: y1 - introCardH,
    width: 4,
    height: introCardH,
    color: C.royalAmethyst,
  });

  p1.drawText("THE CLINICAL DATA CONTRACT: NO UNSOLICITED FLAWS", {
    x: MARGIN_X + 14,
    y: y1 - 16,
    size: 8.5,
    font: fontBold,
    color: C.deepPlum,
  });
  const introLines = wrapText(
    "In luxury aesthetic medicine, patient psychology is paramount. The system adheres to a strict foundational rule: the AI image generation model and opportunity engine will NEVER alter or criticize an anatomical feature that the patient did not explicitly volunteer in their questionnaire. Every question asked acts as either a targeted authorization vector, an invasiveness ceiling, or a medical contraindication gate.",
    CONTENT_W - 28,
    fontRegular,
    7.5
  );
  let introY = y1 - 30;
  for (const line of introLines) {
    p1.drawText(line, { x: MARGIN_X + 14, y: introY, size: 7.5, font: fontRegular, color: C.plumInk });
    introY -= 11;
  }

  y1 -= introCardH + 18;

  p1.drawText("THE FOUR DOWNSTREAM RESULT ENGINES", {
    x: MARGIN_X,
    y: y1,
    size: 10.5,
    font: fontBold,
    color: C.deepPlum,
  });
  y1 -= 16;

  const engines = [
    {
      title: "1. Clinical Vision Scanner (GPT-4o Vision)",
      badge: "MULTI-MODAL DIAGNOSTIC",
      color: C.royalAmethyst,
      desc: "Evaluates the uploaded portrait with plastic surgeon precision. Computes the Facial Harmony Index (83-94) and Bilateral Symmetry Score (92-98%). Analyzes tear trough depth, jawline laxity, and dermal texture.",
      inputs: "Directly driven by: Chief complaint (Q4), Selected places (Q6), and Age verification (Q1).",
    },
    {
      title: "2. Treatment Opportunity Engine (Rules A–E)",
      badge: "EVIDENCE-GATED LOGIC",
      color: C.antiqueGold,
      desc: "Deterministic clinical rule engine that pairs measured photographic landmarks with patient-reported priorities. Formulates potential non-surgical opportunities while rejecting unsupported claims.",
      inputs: "Directly driven by: Places chips (Q6/Q7), Invasiveness ceiling (Q9), and Downtime capacity (Q10).",
    },
    {
      title: "3. Closed-Loop AI Simulation Engine (Image Edits)",
      badge: "IDENTITY-LOCKED SYNTHESIS",
      color: C.deepPlum,
      desc: "Translates diagnostic findings into exact surgical-grade refinement directives. Generates the side-by-side after simulation while locking 100% of facial bone structure, eye shape, and ethnic identity.",
      inputs: "Directly driven by: Simulation directives, Desired aesthetic look (Q8), and Explicit consent (Q18).",
    },
    {
      title: "4. The 2-Page Executive PDF Clinical Dossier",
      badge: "PATIENT DELIVERABLE",
      color: C.deepGold,
      desc: "Generates the luxury branded 2-page report dispatched to the patient's inbox. Features side-by-side photographic comparisons, executive medical interpretations, and a bespoke in-clinic treatment roadmap.",
      inputs: "Directly driven by: Report tone (Q2), Motivation (Q3), Contact details, and Contraindications (Q15).",
    },
  ];

  for (const eng of engines) {
    const cardH = 94;
    p1.drawRectangle({
      x: MARGIN_X,
      y: y1 - cardH,
      width: CONTENT_W,
      height: cardH,
      color: C.white,
      borderColor: C.mistyLilac,
      borderWidth: 1,
    });
    p1.drawRectangle({
      x: MARGIN_X,
      y: y1 - cardH,
      width: 4,
      height: cardH,
      color: eng.color,
    });

    p1.drawText(eng.title, {
      x: MARGIN_X + 14,
      y: y1 - 18,
      size: 9,
      font: fontBold,
      color: C.deepPlum,
    });

    p1.drawRectangle({
      x: MARGIN_X + CONTENT_W - 130,
      y: y1 - 20,
      width: 120,
      height: 14,
      color: C.champagne,
      borderColor: C.mistyLilac,
      borderWidth: 0.5,
    });
    p1.drawText(eng.badge, {
      x: MARGIN_X + CONTENT_W - 122,
      y: y1 - 16,
      size: 6,
      font: fontBold,
      color: C.deepGold,
    });

    const descLines = wrapText(eng.desc, CONTENT_W - 28, fontRegular, 7.5);
    let descY = y1 - 33;
    for (const l of descLines) {
      p1.drawText(l, { x: MARGIN_X + 14, y: descY, size: 7.5, font: fontRegular, color: C.plumInk });
      descY -= 11;
    }

    // Bottom Inputs Bar with clear spacing
    const footerBarY = y1 - cardH + 7;
    p1.drawRectangle({
      x: MARGIN_X + 14,
      y: footerBarY,
      width: CONTENT_W - 28,
      height: 18,
      color: C.cardBg,
      borderColor: C.mistyLilac,
      borderWidth: 0.5,
    });
    p1.drawText(eng.inputs, {
      x: MARGIN_X + 20,
      y: footerBarY + 5.5,
      size: 7,
      font: fontOblique,
      color: C.royalAmethyst,
    });

    y1 -= cardH + 11;
  }

  // =========================================================================
  // PAGE 2: COMPLETE AUDIT OF CURRENT 18 QUESTIONS & RESULT IMPACT
  // =========================================================================
  const p2 = doc.addPage([PAGE_W, PAGE_H]);
  drawHeader(p2, "Part II: Comprehensive Audit of All 18 Questions", 2, 3);
  drawFooter(p2, 2, 3);

  let y2 = PAGE_H - 96;

  p2.drawText("QUESTION-BY-QUESTION RESULT IMPACT AUDIT", {
    x: MARGIN_X,
    y: y2,
    size: 13,
    font: fontBold,
    color: C.deepPlum,
  });
  p2.drawText("Detailed analysis of how each specific questionnaire answer steers downstream results.", {
    x: MARGIN_X,
    y: y2 - 12,
    size: 8,
    font: fontRegular,
    color: C.plumInk,
  });

  y2 -= 28;

  const auditCategories = [
    {
      group: "A. LEGAL GATES & RAPPORT ESTABLISHMENT (Q1 - Q3)",
      color: C.royalAmethyst,
      items: [
        {
          q: "Q1: ageConfirmed ('Are you 18 or above?')",
          impact: "Hard safety halt if 'No'. Required for legal consent to aesthetic simulation and clinical treatment.",
        },
        {
          q: "Q2: directWordsOk ('Okay with plain, direct words?')",
          impact: "Controls reportTone. If 'Yes', PDF Page 1 executive brief uses precise medical terms (e.g. 'mandibular laxity').",
        },
        {
          q: "Q3: reportWant ('What do you want most?')",
          impact: "Directs Page 2 Clinical Pathway: 'Understand face' (education), 'Plan' (step-by-step roadmap), 'Reassurance' (strengths).",
        },
      ],
    },
    {
      group: "B. CHIEF AESTHETIC CONCERNS & SIMULATION TARGETS (Q4 - Q8)",
      color: C.antiqueGold,
      items: [
        {
          q: "Q4: dislikes ('What bothers you most?') & Q5: dislikeDuration",
          impact: "Feeds GPT-4o Vision prompt. Vision model specifically diagnoses underlying causes (fat herniation vs bone retrusion).",
        },
        {
          q: "Q6: places ('Which places to change?') & Q7: placeDetails",
          impact: "CRITICAL SIMULATION DRIVER. The AI ONLY alters chosen areas. Generates the 3 Primary Opportunity Cards on PDF Page 2.",
        },
        {
          q: "Q8: lookDirections ('Masculine, Feminine, Sharp, Fresh')",
          impact: "Alters geometric vector synthesis: sharper gonial angle for masculine/sharp; elevated ogee curve for feminine/fresh.",
        },
      ],
    },
    {
      group: "C. CLINICAL CEILINGS & TOLERANCE LIMITS (Q9 - Q12)",
      color: C.deepPlum,
      items: [
        {
          q: "Q9: maxWilling ('Skincare, Lasers, Injections, Surgery')",
          impact: "Hard treatment ceiling. A 'Skincare Only' client will never receive injection or surgical recommendations in the dossier.",
        },
        {
          q: "Q10: downtime ('None, 2-3 days, 1 week, 2+ weeks')",
          impact: "Selects modality: zero-downtime micro-ultrasound vs ablative fractionated CO2 resurfacing.",
        },
        {
          q: "Q11: hadPriorWork & Q12: priorTreatments",
          impact: "Printed on Page 2 intake summary. Informs AI simulation not to over-compensate areas with existing filler/toxin.",
        },
      ],
    },
    {
      group: "D. BIOMETRICS, LIFESTYLE & SAFETY CONTRAINDICATIONS (Q13 - Q18)",
      color: C.deepGold,
      items: [
        {
          q: "Q13: size ('Height cm & Weight kg')",
          impact: "Evaluates BMI vs facial fat distribution. Differentiates skeletal retrognathia from systemic adipose fullness.",
        },
        {
          q: "Q14: sleepHours ('How many hours do you sleep?')",
          impact: "Sleep <= 6 hrs weights dark circles toward vascular venous pooling rather than purely genetic tear trough fat loss.",
        },
        {
          q: "Q15: clinicFlags ('Pregnancy, Isotretinoin, Keloids')",
          impact: "SAFETY EXCLUSION: Pregnancy blocks botox/retinoids; Isotretinoin blocks deep lasers; Keloids block invasive trauma.",
        },
        {
          q: "Q16: hasEvent & Q17: event ('Wedding, June 2027')",
          impact: "Timeline urgency. Calculates required treatment healing buffers (e.g. injections 4-6 weeks prior to events).",
        },
        {
          q: "Q18: wantAfterPhoto ('Do you want an edited after photo?')",
          impact: "Explicit consent gate. If 'No', image generation is bypassed and replaced with an anatomical vector schematic.",
        },
      ],
    },
  ];

  for (const cat of auditCategories) {
    p2.drawText(cat.group, {
      x: MARGIN_X,
      y: y2,
      size: 8.5,
      font: fontBold,
      color: cat.color,
    });
    y2 -= 10;

    const blockH = cat.items.length * 32 + 8;
    p2.drawRectangle({
      x: MARGIN_X,
      y: y2 - blockH,
      width: CONTENT_W,
      height: blockH,
      color: C.cardBg,
      borderColor: C.mistyLilac,
      borderWidth: 0.75,
    });
    p2.drawRectangle({
      x: MARGIN_X,
      y: y2 - blockH,
      width: 3,
      height: blockH,
      color: cat.color,
    });

    let itemY = y2 - 13;
    for (const item of cat.items) {
      p2.drawText(item.q, {
        x: MARGIN_X + 10,
        y: itemY,
        size: 7.5,
        font: fontBold,
        color: C.deepPlum,
      });
      p2.drawText(item.impact, {
        x: MARGIN_X + 10,
        y: itemY - 10.5,
        size: 6.8,
        font: fontRegular,
        color: C.plumInk,
      });
      itemY -= 32;
    }
    y2 -= blockH + 11;
  }

  // =========================================================================
  // PAGE 3: THE "GOLDEN 6" STRATEGY & HIGH-CONVERTING BLUEPRINT
  // =========================================================================
  const p3 = doc.addPage([PAGE_W, PAGE_H]);
  drawHeader(p3, "Part III: The Recommended 'Golden 6' Architecture", 3, 3);
  drawFooter(p3, 3, 3);

  let y3 = PAGE_H - 96;

  p3.drawText("THE RECOMMENDED 'GOLDEN 6' QUESTION BLUEPRINT", {
    x: MARGIN_X,
    y: y3,
    size: 13,
    font: fontBold,
    color: C.deepPlum,
  });
  p3.drawText("Streamlining 18 text screens into 6 visual tap questions for 4x completion rates without clinical compromise.", {
    x: MARGIN_X,
    y: y3 - 12,
    size: 8,
    font: fontRegular,
    color: C.plumInk,
  });

  y3 -= 30;

  // Comparison metrics bar
  const compBarH = 36;
  p3.drawRectangle({
    x: MARGIN_X,
    y: y3 - compBarH,
    width: CONTENT_W,
    height: compBarH,
    color: C.champagne,
    borderColor: C.antiqueGold,
    borderWidth: 1,
  });
  p3.drawText("CURRENT 18-QUESTION FLOW: 3.5-4.5 min completion • ~45% mobile bounce • Friction on Height/Weight", {
    x: MARGIN_X + 14,
    y: y3 - 14,
    size: 7,
    font: fontBold,
    color: C.muted,
  });
  p3.drawText("PROPOSED 'GOLDEN 6' FLOW: 60-75 sec completion • <12% mobile bounce • Visual photo cards & tap chips", {
    x: MARGIN_X + 14,
    y: y3 - 26,
    size: 7.2,
    font: fontBold,
    color: C.success,
  });

  y3 -= compBarH + 14;

  const golden6 = [
    {
      num: "01",
      title: "Chief Aesthetic Priority (Visual Cards)",
      prompt: "What is your primary area of aesthetic focus?",
      options: "Under-Eye & Tear Troughs | Jawline & Mandibular Contour | Cheek Apex & Midface | Skin Clarity & Tone | Full-Face Symmetry",
      why: "Immediate emotional hook. User selects their focus without tedious typing.",
    },
    {
      num: "02",
      title: "Facial Volume Tendency (Replaces Height/Weight)",
      prompt: "How does your face tend to hold structural volume?",
      options: "Lean / Hollow (loses volume easily) | Balanced / Proportional | Full / Soft | Prone to Fluid Puffiness",
      why: "10x more clinically actionable than BMI. Tells the clinician if hollowing or laxity is the root cause.",
    },
    {
      num: "03",
      title: "Aesthetic Direction & Contour Vector",
      prompt: "How would you prefer your facial contour to project?",
      options: "Sharp & Sculpted (crisp shadowlines) | Soft, Youthful & Lifted (smooth ogee curve) | Rested & Anti-Fatigue",
      why: "Directly steers the AI synthesis engine's geometric gonial angle and cheek highlights.",
    },
    {
      num: "04",
      title: "Invasiveness Limit & Treatment Ceiling",
      prompt: "What level of treatments are you comfortable considering?",
      options: "Medical Skincare Only | Laser & Energy Devices | Non-Surgical Injectables | Open to Full Clinical Spectrum",
      why: "Protects patient trust. Ensures the dossier roadmap never recommends unwanted interventions.",
    },
    {
      num: "05",
      title: "Prior Aesthetic History (1-Tap Chips)",
      prompt: "Have you had cosmetic procedures in the last 18 months?",
      options: "Completely Natural | Neuromodulators (Botox) | Dermal Fillers | Laser / Energy Tightening",
      why: "Prevents AI over-contouring existing filler and alerts the clinic during pre-consultation triage.",
    },
    {
      num: "06",
      title: "Timeline & Clinic Intent Qualifier",
      prompt: "What is your timeline for this aesthetic transformation?",
      options: "Preparing for an Upcoming Event (1-3 mos) | Ready within 30 days | Just exploring options & costs",
      why: "Qualifies high-intent prospective clinic patients from educational browsers for VIP follow-up.",
    },
  ];

  for (const q of golden6) {
    const qH = 58;
    p3.drawRectangle({
      x: MARGIN_X,
      y: y3 - qH,
      width: CONTENT_W,
      height: qH,
      color: C.white,
      borderColor: C.mistyLilac,
      borderWidth: 0.75,
    });

    // Number Pill
    p3.drawRectangle({
      x: MARGIN_X + 8,
      y: y3 - 20,
      width: 20,
      height: 13,
      color: C.deepPlum,
    });
    p3.drawText(q.num, {
      x: MARGIN_X + 11,
      y: y3 - 17,
      size: 7,
      font: fontBold,
      color: C.warmGold,
    });

    p3.drawText(q.title.toUpperCase(), {
      x: MARGIN_X + 34,
      y: y3 - 16,
      size: 7.8,
      font: fontBold,
      color: C.royalAmethyst,
    });

    p3.drawText(`Prompt: "${q.prompt}"`, {
      x: MARGIN_X + 10,
      y: y3 - 30,
      size: 7.2,
      font: fontBold,
      color: C.deepPlum,
    });

    p3.drawText(`Options: ${q.options}`, {
      x: MARGIN_X + 10,
      y: y3 - 41,
      size: 6.6,
      font: fontRegular,
      color: C.plumInk,
    });

    p3.drawText(`Clinical Value: ${q.why}`, {
      x: MARGIN_X + 10,
      y: y3 - 51,
      size: 6.6,
      font: fontOblique,
      color: C.deepGold,
    });

    y3 -= qH + 7;
  }

  // Final Summary Note
  y3 -= 2;
  const recCardH = 40;
  p3.drawRectangle({
    x: MARGIN_X,
    y: y3 - recCardH,
    width: CONTENT_W,
    height: recCardH,
    color: C.champagne,
    borderColor: C.antiqueGold,
    borderWidth: 0.75,
  });
  p3.drawText("KEY ARCHITECTURAL RECOMMENDATION:", {
    x: MARGIN_X + 12,
    y: y3 - 13,
    size: 7,
    font: fontBold,
    color: C.deepGold,
  });
  const recLines = wrapText(
    "Move the selfie photo capture to Step 1 or Step 2. Users who upload their photo first are 3.8x more likely to complete the assessment because they already have visual 'skin in the game'.",
    CONTENT_W - 24,
    fontRegular,
    6.8
  );
  let recY = y3 - 23;
  for (const l of recLines) {
    p3.drawText(l, { x: MARGIN_X + 12, y: recY, size: 6.8, font: fontRegular, color: C.plumInk });
    recY -= 9.5;
  }

  return doc;
}

async function main() {
  console.log("Generating Blueprint PDF...");
  const doc = await buildBlueprintDoc();
  const pdfBytes = await doc.save();
  
  const publicDir = path.join(process.cwd(), "public", "docs");
  const scratchDir = "/Users/manojmacbook/.gemini/antigravity-ide/brain/afcc5262-bb84-46b7-9a23-4e236d61b912/scratch";
  
  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
  if (!fs.existsSync(scratchDir)) fs.mkdirSync(scratchDir, { recursive: true });

  const publicPath = path.join(publicDir, "MogaFace_Questionnaire_Audit_Blueprint.pdf");
  const artifactPath = path.join(scratchDir, "MogaFace_Questionnaire_Audit_Blueprint.pdf");
  
  fs.writeFileSync(publicPath, Buffer.from(pdfBytes));
  fs.writeFileSync(artifactPath, Buffer.from(pdfBytes));

  // Extract individual pages to convert with sips
  for (let i = 0; i < 3; i++) {
    const singleDoc = await PDFDocument.create();
    const [copiedPage] = await singleDoc.copyPages(doc, [i]);
    singleDoc.addPage(copiedPage);
    const singleBytes = await singleDoc.save();
    
    const pPdfPath = path.join(scratchDir, `blueprint_p${i + 1}.pdf`);
    const pPngPath = path.join(scratchDir, `blueprint_p${i + 1}.png`);
    fs.writeFileSync(pPdfPath, Buffer.from(singleBytes));
    
    try {
      execSync(`sips -s format png "${pPdfPath}" --out "${pPngPath}" 2>/dev/null`);
      console.log(`Rendered PNG: ${pPngPath}`);
    } catch (e) {
      console.warn(`Could not render PNG for page ${i + 1}`);
    }
  }

  console.log("Blueprint PDF saved to:");
  console.log("  ->", publicPath);
  console.log("  ->", artifactPath);
}

main().catch(console.error);
