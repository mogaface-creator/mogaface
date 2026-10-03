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
    // Sample test images
    const sampleBefore = await sharp({
      create: { width: 400, height: 500, channels: 3, background: { r: 42, g: 21, b: 72 } },
    }).jpeg().toBuffer();

    const sampleAfter = await sharp({
      create: { width: 400, height: 500, channels: 3, background: { r: 94, g: 53, b: 143 } },
    }).jpeg().toBuffer();

    const summary =
      "Based on your diagnostic photos and clinical intake, we identified key opportunities in mandibular contour definition and anterior malar projection. The targeted algorithmic simulation illustrates softened transition vectors across the nasolabial fold and enhanced lateral cheek support, establishing golden-ratio harmony.";

    // Generate test PDF
    const pdfBytes = await generatePdfReport({
      clientName: "Test Patient",
      clientEmail: toEmail,
      clientPhone: "+1 (555) 019-2834",
      clientLocation: "MogaFace Aesthetics",
      referenceId: "test-verif-" + Date.now().toString(36),
      beforeImageBytes: sampleBefore,
      afterImageBytes: sampleAfter,
      reportSummary: summary,
      detectedAreas: [
        {
          label: "Mandibular & Jawline Contour",
          description: "Clinical indication for sharpening lateral jawline definition and optimizing the cervicofacial angle.",
        },
        {
          label: "Periorbital & Midface Transition",
          description: "Diminishing infraorbital shadowing and restoring subtle anterior cheek volume.",
        },
      ],
      intakeConcerns: ["Jawline Definition", "Under-Eye Volume"],
    });

    // Send email with attached PDF via Resend
    const result = await sendReportEmail({
      toEmail,
      clientName: "Test Patient",
      referenceId: "test-verif-" + Date.now().toString(36),
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
