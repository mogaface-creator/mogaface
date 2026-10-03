/**
 * Test Route: GET /api/test-email?to=your_email@domain.com
 *
 * Sends a real test email with the attached 2-page PDF dossier via Resend
 * to verify domain verification, API keys, and delivery end-to-end.
 */

import type { NextRequest } from "next/server";
import { generatePdfReport } from "@/lib/submissions/pdfReport";
import { sendReportEmail } from "@/lib/submissions/emailDelivery";
import sharp from "sharp";

export const maxDuration = 60;

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = new URL(request.url);
  const toEmail = searchParams.get("to")?.trim();

  if (!toEmail || !toEmail.includes("@")) {
    return Response.json(
      {
        error: "missing_email",
        message: "Please provide a valid recipient email: /api/test-email?to=your_email@example.com",
      },
      { status: 400 },
    );
  }

  try {
    const submissionId = searchParams.get("id");
    let beforeBytes: Buffer;
    let afterBytes: Buffer | null = null;
    let clientName = "Test Patient";
    let summary =
      "Based on your diagnostic photos and clinical intake, we identified key opportunities in mandibular contour definition and anterior malar projection. The targeted algorithmic simulation illustrates softened transition vectors across the nasolabial fold and enhanced lateral cheek support, establishing golden-ratio harmony.";
    let detectedAreas: { label: string; description: string }[] = [
      {
        label: "Mandibular & Jawline Contour",
        description: "Clinical indication for sharpening lateral jawline definition and optimizing the cervicofacial angle.",
      },
      {
        label: "Periorbital & Midface Transition",
        description: "Diminishing infraorbital shadowing and restoring subtle anterior cheek volume.",
      },
    ];

    if (submissionId) {
      const { getSubmission } = await import("@/lib/submissions/store");
      const { resolveLeadData } = await import("@/lib/submissions/lead");
      const sub = await getSubmission(submissionId);
      if (sub) {
        const lead = await resolveLeadData({ leadId: sub.lead_id, analysisId: sub.analysis_id });
        if (lead.name) clientName = lead.name;
        if (sub.before_image_base64) beforeBytes = Buffer.from(sub.before_image_base64, "base64");
        if (sub.after_image_base64) afterBytes = Buffer.from(sub.after_image_base64, "base64");
        if (sub.report_summary) summary = sub.report_summary;
        if (sub.detected_areas) detectedAreas = sub.detected_areas;
      }
    }

    if (!beforeBytes!) {
      // Sample test images with facial outline illustration
      const svgBefore = `
        <svg width="400" height="500" xmlns="http://www.w3.org/2000/svg">
          <rect width="400" height="500" fill="#2a1548"/>
          <circle cx="200" cy="200" r="100" fill="#f2e6d8" opacity="0.25"/>
          <ellipse cx="200" cy="230" rx="80" ry="115" fill="none" stroke="#d4b87a" stroke-width="3"/>
          <text x="200" y="240" font-family="sans-serif" font-size="16" font-weight="bold" fill="#f2e6d8" text-anchor="middle">BASELINE PROFILE</text>
        </svg>
      `;
      beforeBytes = await sharp(Buffer.from(svgBefore)).jpeg().toBuffer();
    }

    if (!afterBytes && !submissionId) {
      const svgAfter = `
        <svg width="400" height="500" xmlns="http://www.w3.org/2000/svg">
          <rect width="400" height="500" fill="#5e358f"/>
          <circle cx="200" cy="200" r="100" fill="#f2e6d8" opacity="0.35"/>
          <ellipse cx="200" cy="230" rx="76" ry="112" fill="none" stroke="#c2a46f" stroke-width="3"/>
          <text x="200" y="240" font-family="sans-serif" font-size="16" font-weight="bold" fill="#f2e6d8" text-anchor="middle">SIMULATION RESULT</text>
        </svg>
      `;
      afterBytes = await sharp(Buffer.from(svgAfter)).jpeg().toBuffer();
    }

    // Generate test PDF
    const pdfBytes = await generatePdfReport({
      clientName,
      clientEmail: toEmail,
      clientPhone: "+1 (555) 019-2834",
      clientLocation: "MogaFace Aesthetics",
      referenceId: submissionId || ("test-verif-" + Date.now().toString(36)),
      beforeImageBytes: beforeBytes,
      afterImageBytes: afterBytes,
      reportSummary: summary,
      detectedAreas,
      intakeConcerns: ["Jawline Definition", "Under-Eye Volume"],
    });

    // Send email with attached PDF via Resend
    const result = await sendReportEmail({
      toEmail,
      clientName,
      referenceId: submissionId || ("test-verif-" + Date.now().toString(36)),
      pdfBytes,
      reportSummary: summary,
    });

    if (!result.ok) {
      return Response.json(
        {
          success: false,
          error: result.error,
          hint: "Check that RESEND_API_KEY is valid and RESEND_FROM_EMAIL uses your verified domain.",
        },
        { status: 500 },
      );
    }

    if (result.simulated) {
      return Response.json({
        success: true,
        simulated: true,
        message: "RESEND_API_KEY is not configured yet. The PDF was generated, but the email was simulated.",
      });
    }

    return Response.json({
      success: true,
      emailId: result.id,
      message: `Test email with attached PDF successfully sent to ${toEmail}! Check your inbox.`,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ success: false, error: errorMsg }, { status: 500 });
  }
}
