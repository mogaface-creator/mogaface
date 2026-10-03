/**
 * Development & Preview Route: GET /api/test-pdf
 *
 * Allows viewing the generated MogaFace Aesthetic Dossier PDF directly in the
 * browser without needing to trigger the full 30-minute cron cycle.
 *
 * Usage:
 *   - GET /api/test-pdf            → renders demo clinical report with simulated before/after
 *   - GET /api/test-pdf?id=<uuid>  → renders the PDF for a specific submission in the database
 */

import type { NextRequest } from "next/server";
import { getSubmission } from "@/lib/submissions/store";
import { resolveLeadData } from "@/lib/submissions/lead";
import { generatePdfReport } from "@/lib/submissions/pdfReport";
import sharp from "sharp";

export const maxDuration = 60;

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const submissionId = searchParams.get("id");

  try {
    if (submissionId) {
      const submission = await getSubmission(submissionId);
      if (!submission) {
        return new Response("Submission not found", { status: 404 });
      }

      const lead = await resolveLeadData({
        leadId: submission.lead_id,
        analysisId: submission.analysis_id,
      });

      const beforeBytes = submission.before_image_base64
        ? Buffer.from(submission.before_image_base64, "base64")
        : await createDemoFaceImage({ r: 61, g: 47, b: 79, text: "Baseline" });

      const afterBytes = submission.after_image_base64
        ? Buffer.from(submission.after_image_base64, "base64")
        : null;

      const pdfBytes = await generatePdfReport({
        clientName: lead.name || "Client Assessment",
        clientEmail: lead.email,
        clientPhone: lead.phone,
        clientLocation: lead.location,
        referenceId: submission.id,
        beforeImageBytes: beforeBytes,
        afterImageBytes: afterBytes,
        reportSummary:
          submission.report_summary ||
          "Based on your photographic assessment, we observed subtle midface volume transition and mandibular angle definition opportunities. Your targeted simulation reflects balanced contour harmonization across both vectors.",
        detectedAreas: submission.detected_areas || [
          {
            label: "Mandibular & Jawline Contour",
            description: "Optimization of lower facial boundary to define the cervicofacial angle.",
          },
          {
            label: "Periorbital Midface Harmony",
            description: "Softened transition along the tear trough and anterior malar zone.",
          },
        ],
        intakeConcerns: lead.places,
      });

      return new Response(Buffer.from(pdfBytes), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="MogaFace-Report-${submission.id.slice(0, 8)}.pdf"`,
        },
      });
    }

    // Default demonstration PDF for instant preview
    const sampleBefore = await createDemoFaceImage({
      r: 30,
      g: 20,
      b: 45,
      text: "Diagnostic Baseline",
    });

    const sampleAfter = await createDemoFaceImage({
      r: 94,
      g: 53,
      b: 143,
      text: "Aesthetic Simulation",
    });

    const pdfBytes = await generatePdfReport({
      clientName: "Eleanor Vance",
      clientEmail: "eleanor.vance@example.com",
      clientPhone: "+1 (555) 234-8901",
      clientLocation: "Mayfair Aesthetic Clinic",
      referenceId: "e9f8a12b-preview",
      beforeImageBytes: sampleBefore,
      afterImageBytes: sampleAfter,
      reportSummary:
        "Based on Eleanor's diagnostic photos and clinical intake, we identified key opportunities in mandibular contour definition and anterior malar projection. The targeted algorithmic simulation illustrates softened transition vectors across the nasolabial fold and enhanced lateral cheek support, preserving authentic facial emotion while establishing golden-ratio harmony.",
      detectedAreas: [
        {
          label: "Mandibular Angle & Jawline Definition",
          description:
            "Clinical indication for sharpening lateral jawline definition and optimizing the jaw-to-neck transition for a cleaner profile contour.",
        },
        {
          label: "Infraorbital Tear Trough & Malar Projection",
          description:
            "Restoring subtle anterior projection to diminish under-eye shadowing and optimize light reflection on the midface triangle.",
        },
        {
          label: "Nasolabial Transition & Perioral Softening",
          description:
            "Harmonizing dynamic movement lines with targeted structural support in the deep pyriform space.",
        },
      ],
      intakeConcerns: ["Jawline Definition", "Under-Eye Volume", "Midface Balance"],
    });

    return new Response(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="MogaFace-Demonstration-Dossier.pdf"',
      },
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "PDF Generation Error";
    console.error("[test-pdf] Error:", err);
    return new Response(`Error generating PDF: ${errorMsg}`, { status: 500 });
  }
}

async function createDemoFaceImage(opts: { r: number; g: number; b: number; text: string }): Promise<Buffer> {
  const svg = `
    <svg width="400" height="500" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="grad" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stop-color="#d4b87a" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="#1a0e2e" stop-opacity="0.95"/>
        </radialGradient>
      </defs>
      <rect width="400" height="500" fill="rgb(${opts.r},${opts.g},${opts.b})"/>
      <rect width="400" height="500" fill="url(#grad)"/>
      <circle cx="200" cy="180" r="90" fill="#f2e6d8" opacity="0.15"/>
      <ellipse cx="200" cy="220" rx="75" ry="110" fill="none" stroke="#c2a46f" stroke-width="2" stroke-dasharray="6,4"/>
      <text x="200" y="225" font-family="Helvetica, Arial, sans-serif" font-size="14" font-weight="bold" fill="#f2e6d8" text-anchor="middle">${opts.text}</text>
      <text x="200" y="450" font-family="Helvetica, Arial, sans-serif" font-size="11" fill="#c2a46f" text-anchor="middle">MOGAFACE CLINICAL IMAGING</text>
    </svg>
  `;

  return await sharp(Buffer.from(svg)).jpeg({ quality: 95 }).toBuffer();
}
