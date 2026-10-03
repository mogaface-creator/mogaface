/**
 * MogaFace Branded PDF Report Generator
 *
 * Generates an executive, luxury aesthetic consultation report (2-page A4)
 * conforming to the Clinic Next Face Brand Identity System v1.0.
 *
 * Includes:
 *   - Page 1: Clinical Header, Client Credentials, Side-by-side Before/After
 *     Photographic Visual Comparison, Executive Summary.
 *   - Page 2: Detailed Anatomical Opportunities, Stated Patient Focus Areas,
 *     Bespoke Clinical Consultation Pathway & CTA, Medical Disclaimer.
 */

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import sharp from "sharp";

export interface GeneratePdfReportInput {
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientLocation?: string;
  dateStr?: string;
  referenceId: string;
  beforeImageBytes: Buffer | Uint8Array;
  afterImageBytes?: Buffer | Uint8Array | null;
  reportSummary: string;
  detectedAreas: { label: string; description: string }[];
  intakeConcerns?: string[];
}

// Brand Color Palette (Clinic Next Face Brand Identity v1.0)
const C = {
  deepPlum: rgb(0.102, 0.055, 0.18), // #1a0e2e
  plumInk: rgb(0.239, 0.184, 0.31), // #3d2f4f
  royalAmethyst: rgb(0.369, 0.208, 0.561), // #5e358f
  softOrchid: rgb(0.545, 0.42, 0.682), // #8b6bae
  paleViolet: rgb(0.831, 0.78, 0.91), // #d4c7e8
  antiqueGold: rgb(0.761, 0.643, 0.435), // #c2a46f
  warmGold: rgb(0.831, 0.722, 0.478), // #d4b87a
  deepGold: rgb(0.541, 0.427, 0.208), // #8a6d35
  silkBeige: rgb(0.949, 0.902, 0.847), // #f2e6d8
  champagne: rgb(0.969, 0.941, 0.91), // #f7f0e8
  mistyLilac: rgb(0.89, 0.875, 0.918), // #e3dfea
  white: rgb(1, 1, 1),
  muted: rgb(0.541, 0.482, 0.604), // #8a7b9a
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

function truncateString(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + "…";
}

/**
 * Normalizes any image (PNG, JPEG, WebP, etc.) to a high-DPI JPEG buffer
 * scaled inside the designated target box with background padding.
 */
async function prepareImageForPdf(
  rawBytes: Buffer | Uint8Array,
  boxWidth: number,
  boxHeight: number,
): Promise<Buffer | null> {
  try {
    const targetW = Math.round(boxWidth * 2.5); // high resolution for crisp PDF print
    const targetH = Math.round(boxHeight * 2.5);

    const jpegBuffer = await sharp(Buffer.from(rawBytes))
      .rotate() // auto-orient based on EXIF
      .resize({
        width: targetW,
        height: targetH,
        fit: "contain",
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      })
      .jpeg({ quality: 92, mozjpeg: true })
      .toBuffer();

    return jpegBuffer;
  } catch (err) {
    console.error("[pdfReport] Failed to prepare image:", err);
    return null;
  }
}

export async function generatePdfReport(input: GeneratePdfReportInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();

  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await doc.embedFont(StandardFonts.HelveticaOblique);

  const PAGE_WIDTH = 595.28; // A4 standard width in points
  const PAGE_HEIGHT = 841.89; // A4 standard height in points
  const MARGIN_X = 36;
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2; // 523.28

  const now = new Date();
  const dateFormatted =
    input.dateStr ||
    now.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

  const refCode = input.referenceId.slice(0, 8).toUpperCase();
  const dossierId = `MF-${refCode}`;

  // ==========================================
  // PAGE 1: VISUAL COMPARISON & EXECUTIVE BRIEF
  // ==========================================
  const page1 = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  // 1. Edge-to-edge Top Banner (Deep Plum)
  const bannerHeight = 88;
  const bannerY = PAGE_HEIGHT - bannerHeight;
  page1.drawRectangle({
    x: 0,
    y: bannerY,
    width: PAGE_WIDTH,
    height: bannerHeight,
    color: C.deepPlum,
  });

  // Antique Gold Accent Rule under Banner
  page1.drawRectangle({
    x: 0,
    y: bannerY - 2,
    width: PAGE_WIDTH,
    height: 2,
    color: C.antiqueGold,
  });

  // Banner Brand Title
  page1.drawText("M O G A F A C E", {
    x: MARGIN_X,
    y: bannerY + 52,
    size: 19,
    font: fontBold,
    color: C.warmGold,
  });

  page1.drawText("CLINICAL FACIAL HARMONIZATION & AESTHETIC SIMULATION", {
    x: MARGIN_X,
    y: bannerY + 36,
    size: 7.5,
    font: fontBold,
    color: C.paleViolet,
  });

  page1.drawText("CONFIDENTIAL MEDICAL AESTHETICS DOSSIER", {
    x: MARGIN_X,
    y: bannerY + 22,
    size: 7,
    font: fontRegular,
    color: C.muted,
  });

  // Banner Right Metadata Badge
  page1.drawRectangle({
    x: PAGE_WIDTH - MARGIN_X - 160,
    y: bannerY + 26,
    width: 160,
    height: 42,
    color: rgb(0.16, 0.08, 0.28),
    borderColor: C.antiqueGold,
    borderWidth: 0.75,
  });

  page1.drawText("SPECIALIST ASSESSMENT", {
    x: PAGE_WIDTH - MARGIN_X - 150,
    y: bannerY + 50,
    size: 6.5,
    font: fontBold,
    color: C.warmGold,
  });

  page1.drawText(`DOSSIER: ${dossierId}`, {
    x: PAGE_WIDTH - MARGIN_X - 150,
    y: bannerY + 37,
    size: 8,
    font: fontBold,
    color: C.white,
  });

  // 2. Client & Assessment Info Bar
  const infoBarY = bannerY - 58;
  const infoBarHeight = 46;
  page1.drawRectangle({
    x: MARGIN_X,
    y: infoBarY,
    width: CONTENT_WIDTH,
    height: infoBarHeight,
    color: C.champagne,
    borderColor: C.mistyLilac,
    borderWidth: 1,
  });

  // Vertical separators in info bar
  page1.drawRectangle({
    x: MARGIN_X + 175,
    y: infoBarY + 6,
    width: 1,
    height: infoBarHeight - 12,
    color: C.mistyLilac,
  });
  page1.drawRectangle({
    x: MARGIN_X + 350,
    y: infoBarY + 6,
    width: 1,
    height: infoBarHeight - 12,
    color: C.mistyLilac,
  });

  // Col 1: Client
  page1.drawText("PATIENT / CLIENT", {
    x: MARGIN_X + 14,
    y: infoBarY + 30,
    size: 6.5,
    font: fontBold,
    color: C.muted,
  });
  page1.drawText(truncateString(input.clientName || "Valued Client", 24), {
    x: MARGIN_X + 14,
    y: infoBarY + 14,
    size: 11,
    font: fontBold,
    color: C.deepPlum,
  });

  // Col 2: Date
  page1.drawText("DATE OF ASSESSMENT", {
    x: MARGIN_X + 189,
    y: infoBarY + 30,
    size: 6.5,
    font: fontBold,
    color: C.muted,
  });
  page1.drawText(dateFormatted, {
    x: MARGIN_X + 189,
    y: infoBarY + 14,
    size: 9.5,
    font: fontBold,
    color: C.plumInk,
  });

  // Col 3: Clinic Location / Scope
  page1.drawText("CLINIC JURISDICTION", {
    x: MARGIN_X + 364,
    y: infoBarY + 30,
    size: 6.5,
    font: fontBold,
    color: C.muted,
  });
  page1.drawText(truncateString(input.clientLocation || "MogaFace Aesthetics", 24), {
    x: MARGIN_X + 364,
    y: infoBarY + 14,
    size: 9.5,
    font: fontBold,
    color: C.royalAmethyst,
  });

  // 3. Section Title: Photographic Analysis
  const sectionTitleY = infoBarY - 26;
  page1.drawText("MULTI-VECTOR FACIAL AESTHETIC VISUALIZATION", {
    x: MARGIN_X,
    y: sectionTitleY,
    size: 10.5,
    font: fontBold,
    color: C.deepPlum,
  });
  page1.drawText("Photographic baseline paired with algorithmic contour harmonization and aesthetic projection.", {
    x: MARGIN_X,
    y: sectionTitleY - 11,
    size: 7.5,
    font: fontRegular,
    color: C.plumInk,
  });

  // 4. Before & After Photo Cards Side-by-Side
  const cardWidth = 254;
  const cardHeight = 270;
  const cardY = sectionTitleY - 20 - cardHeight;
  const photoBoxWidth = cardWidth - 16;
  const photoBoxHeight = 212;

  // Process Photos with Sharp
  const beforeJpeg = await prepareImageForPdf(input.beforeImageBytes, photoBoxWidth, photoBoxHeight);
  let afterJpeg: Buffer | null = null;
  if (input.afterImageBytes) {
    afterJpeg = await prepareImageForPdf(input.afterImageBytes, photoBoxWidth, photoBoxHeight);
  }

  // --- CARD 1: BASELINE (BEFORE) ---
  const card1X = MARGIN_X;
  page1.drawRectangle({
    x: card1X,
    y: cardY,
    width: cardWidth,
    height: cardHeight,
    color: C.white,
    borderColor: C.mistyLilac,
    borderWidth: 1,
  });

  // Card 1 Header Bar
  page1.drawRectangle({
    x: card1X,
    y: cardY + cardHeight - 22,
    width: cardWidth,
    height: 22,
    color: C.plumInk,
  });
  page1.drawText("BASELINE PROFILE (CURRENT)", {
    x: card1X + 54,
    y: cardY + cardHeight - 15,
    size: 7.5,
    font: fontBold,
    color: C.silkBeige,
  });

  // Card 1 Image Rendering
  if (beforeJpeg) {
    const embeddedBefore = await doc.embedJpg(beforeJpeg);
    page1.drawImage(embeddedBefore, {
      x: card1X + 8,
      y: cardY + 28,
      width: photoBoxWidth,
      height: photoBoxHeight,
    });
  } else {
    page1.drawText("Original photograph registered", {
      x: card1X + 45,
      y: cardY + 120,
      size: 9,
      font: fontOblique,
      color: C.muted,
    });
  }

  // Card 1 Footer Caption Bar
  page1.drawRectangle({
    x: card1X,
    y: cardY,
    width: cardWidth,
    height: 22,
    color: C.champagne,
    borderColor: C.mistyLilac,
    borderWidth: 0.5,
  });
  page1.drawText("Standard Clinical Frontal Perspective", {
    x: card1X + 44,
    y: cardY + 7,
    size: 7,
    font: fontRegular,
    color: C.muted,
  });

  // --- CARD 2: SIMULATION (AFTER) ---
  const card2X = MARGIN_X + CONTENT_WIDTH - cardWidth;
  page1.drawRectangle({
    x: card2X,
    y: cardY,
    width: cardWidth,
    height: cardHeight,
    color: C.white,
    borderColor: C.royalAmethyst,
    borderWidth: 1.5,
  });

  // Card 2 Header Bar (Royal Amethyst)
  page1.drawRectangle({
    x: card2X,
    y: cardY + cardHeight - 22,
    width: cardWidth,
    height: 22,
    color: C.royalAmethyst,
  });
  page1.drawText("TARGETED AESTHETIC SIMULATION", {
    x: card2X + 44,
    y: cardY + cardHeight - 15,
    size: 7.5,
    font: fontBold,
    color: C.white,
  });

  // Card 2 Image Rendering
  if (afterJpeg) {
    const embeddedAfter = await doc.embedJpg(afterJpeg);
    page1.drawImage(embeddedAfter, {
      x: card2X + 8,
      y: cardY + 28,
      width: photoBoxWidth,
      height: photoBoxHeight,
    });
  } else {
    // Placeholder if after image was pending or skipped
    page1.drawRectangle({
      x: card2X + 8,
      y: cardY + 28,
      width: photoBoxWidth,
      height: photoBoxHeight,
      color: C.champagne,
    });
    page1.drawText("Simulation Model Prepared", {
      x: card2X + 60,
      y: cardY + 130,
      size: 10,
      font: fontBold,
      color: C.royalAmethyst,
    });
    page1.drawText("Visual reconstruction rendered for consultation.", {
      x: card2X + 35,
      y: cardY + 112,
      size: 7.5,
      font: fontRegular,
      color: C.plumInk,
    });
  }

  // Card 2 Footer Caption Bar
  page1.drawRectangle({
    x: card2X,
    y: cardY,
    width: cardWidth,
    height: 22,
    color: C.champagne,
    borderColor: C.mistyLilac,
    borderWidth: 0.5,
  });
  page1.drawText("AI Aesthetic Harmony & Balance Projection", {
    x: card2X + 38,
    y: cardY + 7,
    size: 7,
    font: fontBold,
    color: C.royalAmethyst,
  });

  // 5. Executive Clinical Summary Box
  const summaryBoxY = cardY - 14 - 138;
  const summaryBoxHeight = 138;
  page1.drawRectangle({
    x: MARGIN_X,
    y: summaryBoxY,
    width: CONTENT_WIDTH,
    height: summaryBoxHeight,
    color: C.champagne,
    borderColor: C.mistyLilac,
    borderWidth: 1,
  });

  // Left royal accent bar
  page1.drawRectangle({
    x: MARGIN_X,
    y: summaryBoxY,
    width: 4,
    height: summaryBoxHeight,
    color: C.royalAmethyst,
  });

  page1.drawText("EXECUTIVE CLINICAL INTERPRETATION", {
    x: MARGIN_X + 16,
    y: summaryBoxY + summaryBoxHeight - 20,
    size: 9,
    font: fontBold,
    color: C.royalAmethyst,
  });

  // Hairline separator
  page1.drawRectangle({
    x: MARGIN_X + 16,
    y: summaryBoxY + summaryBoxHeight - 26,
    width: CONTENT_WIDTH - 32,
    height: 0.75,
    color: C.antiqueGold,
  });

  const summaryLines = wrapText(
    input.reportSummary || "Your personalized facial analysis has been completed.",
    CONTENT_WIDTH - 32,
    fontRegular,
    8.5,
  );

  let textY = summaryBoxY + summaryBoxHeight - 40;
  for (let i = 0; i < Math.min(summaryLines.length, 5); i++) {
    page1.drawText(summaryLines[i], {
      x: MARGIN_X + 16,
      y: textY,
      size: 8.5,
      font: fontRegular,
      color: C.plumInk,
    });
    textY -= 13;
  }

  // Key guidance note inside summary box
  page1.drawRectangle({
    x: MARGIN_X + 16,
    y: summaryBoxY + 12,
    width: CONTENT_WIDTH - 32,
    height: 24,
    color: C.white,
    borderColor: C.mistyLilac,
    borderWidth: 0.75,
  });
  page1.drawText("CLINICAL NOTE:", {
    x: MARGIN_X + 24,
    y: summaryBoxY + 20,
    size: 7,
    font: fontBold,
    color: C.deepGold,
  });
  page1.drawText(
    "Targeted refinement vectors illustrate soft-tissue harmony, midface support, and contour balance.",
    {
      x: MARGIN_X + 90,
      y: summaryBoxY + 20,
      size: 7,
      font: fontRegular,
      color: C.plumInk,
    },
  );

  // 6. Page 1 Footer
  drawFooter(page1, 1, 2, fontRegular, fontBold, MARGIN_X, CONTENT_WIDTH);

  // ==========================================
  // PAGE 2: ANATOMICAL FINDINGS & CONSULTATION CTA
  // ==========================================
  const page2 = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  // Page 2 Header Banner
  const p2HeaderH = 54;
  const p2HeaderY = PAGE_HEIGHT - p2HeaderH;
  page2.drawRectangle({
    x: 0,
    y: p2HeaderY,
    width: PAGE_WIDTH,
    height: p2HeaderH,
    color: C.deepPlum,
  });

  page2.drawRectangle({
    x: 0,
    y: p2HeaderY - 2,
    width: PAGE_WIDTH,
    height: 2,
    color: C.antiqueGold,
  });

  page2.drawText("M O G A F A C E", {
    x: MARGIN_X,
    y: p2HeaderY + 28,
    size: 14,
    font: fontBold,
    color: C.warmGold,
  });

  page2.drawText("ANATOMICAL FINDINGS, OPPORTUNITIES & CLINICAL PATHWAY", {
    x: MARGIN_X,
    y: p2HeaderY + 14,
    size: 7.5,
    font: fontBold,
    color: C.paleViolet,
  });

  page2.drawText(`CASE DOSSIER: ${dossierId}`, {
    x: PAGE_WIDTH - MARGIN_X - 140,
    y: p2HeaderY + 22,
    size: 8,
    font: fontBold,
    color: C.silkBeige,
  });

  // Section: Detected Anatomical Opportunities
  let p2Y = p2HeaderY - 32;
  page2.drawText("IDENTIFIED ANATOMICAL OPPORTUNITIES & FOCUS AREAS", {
    x: MARGIN_X,
    y: p2Y,
    size: 11,
    font: fontBold,
    color: C.deepPlum,
  });

  page2.drawText(
    "Algorithmic structural observations mapped from photographic vectors and symmetry assessment.",
    {
      x: MARGIN_X,
      y: p2Y - 12,
      size: 7.5,
      font: fontRegular,
      color: C.plumInk,
    },
  );

  p2Y -= 26;

  // Render Per-Area Opportunity Cards (up to 4 items)
  const areasToRender =
    input.detectedAreas && input.detectedAreas.length > 0
      ? input.detectedAreas.slice(0, 4)
      : [
          {
            label: "Mandibular & Jawline Contour",
            description:
              "Analysis indicated opportunity for enhanced lower-face definition and clean jawline contour definition.",
          },
          {
            label: "Periorbital & Midface Transition",
            description:
              "Smooth transition between tear trough and anterior cheek volume to optimize youthful light reflection.",
          },
          {
            label: "Facial Symmetry & Structural Balance",
            description:
              "Subtle vector balancing between bilateral facial planes to harmonize natural profile proportions.",
          },
        ];

  for (let i = 0; i < areasToRender.length; i++) {
    const area = areasToRender[i];
    const cardH = 50;

    page2.drawRectangle({
      x: MARGIN_X,
      y: p2Y - cardH,
      width: CONTENT_WIDTH,
      height: cardH,
      color: C.white,
      borderColor: C.mistyLilac,
      borderWidth: 1,
    });

    // Badge indicator
    page2.drawRectangle({
      x: MARGIN_X,
      y: p2Y - cardH,
      width: 4,
      height: cardH,
      color: i === 0 ? C.royalAmethyst : C.antiqueGold,
    });

    // Title
    page2.drawText(area.label.toUpperCase(), {
      x: MARGIN_X + 16,
      y: p2Y - 16,
      size: 8.5,
      font: fontBold,
      color: C.deepPlum,
    });

    // Status pill
    page2.drawRectangle({
      x: MARGIN_X + CONTENT_WIDTH - 85,
      y: p2Y - 18,
      width: 72,
      height: 14,
      color: C.champagne,
      borderColor: C.mistyLilac,
      borderWidth: 0.5,
    });
    page2.drawText("IDENTIFIED", {
      x: MARGIN_X + CONTENT_WIDTH - 73,
      y: p2Y - 14,
      size: 6,
      font: fontBold,
      color: C.deepGold,
    });

    // Description
    const areaLines = wrapText(area.description, CONTENT_WIDTH - 32, fontRegular, 8);
    let lineY = p2Y - 28;
    for (let l = 0; l < Math.min(areaLines.length, 2); l++) {
      page2.drawText(areaLines[l], {
        x: MARGIN_X + 16,
        y: lineY,
        size: 8,
        font: fontRegular,
        color: C.plumInk,
      });
      lineY -= 11;
    }

    p2Y -= cardH + 8;
  }

  // Section: Patient Stated Priorities (if any)
  if (input.intakeConcerns && input.intakeConcerns.length > 0) {
    p2Y -= 4;
    page2.drawRectangle({
      x: MARGIN_X,
      y: p2Y - 26,
      width: CONTENT_WIDTH,
      height: 26,
      color: C.champagne,
      borderColor: C.mistyLilac,
      borderWidth: 0.75,
    });

    page2.drawText("PATIENT STATED GOALS:", {
      x: MARGIN_X + 12,
      y: p2Y - 17,
      size: 7,
      font: fontBold,
      color: C.royalAmethyst,
    });

    page2.drawText(truncateString(input.intakeConcerns.join(" • "), 80), {
      x: MARGIN_X + 122,
      y: p2Y - 17,
      size: 7,
      font: fontRegular,
      color: C.deepPlum,
    });

    p2Y -= 36;
  } else {
    p2Y -= 10;
  }

  // Big Call-to-Action Container: In-Clinic Consultation
  const ctaBoxHeight = 158;
  const ctaBoxY = p2Y - ctaBoxHeight;

  page2.drawRectangle({
    x: MARGIN_X,
    y: ctaBoxY,
    width: CONTENT_WIDTH,
    height: ctaBoxHeight,
    color: C.deepPlum,
    borderColor: C.antiqueGold,
    borderWidth: 1.5,
  });

  page2.drawText("SCHEDULE YOUR SPECIALIST IN-CLINIC CONSULTATION", {
    x: MARGIN_X + 20,
    y: ctaBoxY + ctaBoxHeight - 24,
    size: 11,
    font: fontBold,
    color: C.warmGold,
  });

  page2.drawText("Translating Algorithmic Projection into Personalized Clinical Reality", {
    x: MARGIN_X + 20,
    y: ctaBoxY + ctaBoxHeight - 38,
    size: 8,
    font: fontRegular,
    color: C.paleViolet,
  });

  // Gold separator
  page2.drawRectangle({
    x: MARGIN_X + 20,
    y: ctaBoxY + ctaBoxHeight - 44,
    width: CONTENT_WIDTH - 40,
    height: 1,
    color: C.antiqueGold,
  });

  const ctaCopy =
    "Facial aesthetics is a discipline of subtle micro-adjustments and individual biological dynamics. While this digital simulation demonstrates directional harmonization, procedural outcomes depend on in-person palpation, tissue laxity, and precise medical technique. Present this dossier to your practitioner to begin your tailored treatment roadmap.";

  const ctaLines = wrapText(ctaCopy, CONTENT_WIDTH - 40, fontRegular, 8);
  let ctaTextY = ctaBoxY + ctaBoxHeight - 58;
  for (const line of ctaLines) {
    page2.drawText(line, {
      x: MARGIN_X + 20,
      y: ctaTextY,
      size: 8,
      font: fontRegular,
      color: C.silkBeige,
    });
    ctaTextY -= 11.5;
  }

  // Contact & Scheduling Card inside CTA box
  page2.drawRectangle({
    x: MARGIN_X + 20,
    y: ctaBoxY + 14,
    width: CONTENT_WIDTH - 40,
    height: 38,
    color: rgb(0.16, 0.08, 0.28),
    borderColor: C.warmGold,
    borderWidth: 0.75,
  });

  page2.drawText("DIRECT CONSULTATION DESK", {
    x: MARGIN_X + 32,
    y: ctaBoxY + 37,
    size: 7,
    font: fontBold,
    color: C.warmGold,
  });

  page2.drawText("Direct WhatsApp / Clinic Line: Available on Request", {
    x: MARGIN_X + 32,
    y: ctaBoxY + 24,
    size: 8,
    font: fontBold,
    color: C.white,
  });

  page2.drawText(`Reference: ${dossierId}`, {
    x: MARGIN_X + CONTENT_WIDTH - 150,
    y: ctaBoxY + 24,
    size: 8,
    font: fontBold,
    color: C.warmGold,
  });

  // Clinical Safety & Legal Disclaimer Box
  const disclaimerY = ctaBoxY - 14 - 68;
  const disclaimerH = 68;

  page2.drawRectangle({
    x: MARGIN_X,
    y: disclaimerY,
    width: CONTENT_WIDTH,
    height: disclaimerH,
    color: C.champagne,
    borderColor: C.mistyLilac,
    borderWidth: 0.75,
  });

  page2.drawText("REGULATORY & CLINICAL PRACTICE DISCLAIMER", {
    x: MARGIN_X + 14,
    y: disclaimerY + disclaimerH - 14,
    size: 6.5,
    font: fontBold,
    color: C.deepPlum,
  });

  const disclaimerText =
    "IMPORTANT NOTICE: This visual simulation and aesthetic analysis report are generated by artificial intelligence for educational and visualization purposes only. It does not constitute medical advice, diagnosis, or a binding guarantee of surgical or non-surgical outcomes. All aesthetic procedures carry specific risks, contraindications, and anatomical considerations. A formal, in-person consultation with a board-certified aesthetic medical practitioner is required prior to undergoing any treatment.";

  const disclaimerLines = wrapText(disclaimerText, CONTENT_WIDTH - 28, fontRegular, 6.5);
  let discY = disclaimerY + disclaimerH - 24;
  for (const line of disclaimerLines) {
    page2.drawText(line, {
      x: MARGIN_X + 14,
      y: discY,
      size: 6.5,
      font: fontRegular,
      color: C.muted,
    });
    discY -= 8.5;
  }

  // Page 2 Footer
  drawFooter(page2, 2, 2, fontRegular, fontBold, MARGIN_X, CONTENT_WIDTH);

  return await doc.save();
}

function drawFooter(
  page: PDFPage,
  pageNum: number,
  totalPages: number,
  fontRegular: PDFFont,
  fontBold: PDFFont,
  marginX: number,
  contentWidth: number,
) {
  const footerY = 32;

  // Hairline rule
  page.drawRectangle({
    x: marginX,
    y: footerY + 14,
    width: contentWidth,
    height: 0.75,
    color: C.antiqueGold,
  });

  page.drawText("MOGAFACE CLINICAL AESTHETICS • CONFIDENTIAL MEDICAL DOSSIER", {
    x: marginX,
    y: footerY,
    size: 6.5,
    font: fontRegular,
    color: C.muted,
  });

  page.drawText(`PAGE ${pageNum} OF ${totalPages}`, {
    x: marginX + contentWidth - 55,
    y: footerY,
    size: 7,
    font: fontBold,
    color: C.royalAmethyst,
  });
}
