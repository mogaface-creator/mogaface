/**
 * MogaFace Email Delivery Module
 *
 * Sends the personalized aesthetic consultation PDF report to the client via
 * Resend.
 *
 * Features:
 *   - Luxury HTML email template matching the MogaFace design system
 *   - High-resolution PDF attachment
 *   - WhatsApp and clinic consultation booking links
 *   - Graceful dev simulation fallback when RESEND_API_KEY is not configured
 */

import { Resend } from "resend";

export interface SendReportEmailInput {
  toEmail: string;
  clientName: string;
  referenceId: string;
  pdfBytes: Buffer | Uint8Array;
  reportSummary?: string;
}

export type SendReportEmailResult =
  | { ok: true; id?: string; simulated?: boolean }
  | { ok: false; error: string };

export async function sendReportEmail(input: SendReportEmailInput): Promise<SendReportEmailResult> {
  const env = process.env;
  const apiKey = env.RESEND_API_KEY?.trim();

  const refCode = input.referenceId.slice(0, 8).toUpperCase();
  const dossierId = `MF-${refCode}`;
  const firstName = input.clientName.trim().split(/\s+/)[0] || "there";

  if (!apiKey) {
    console.warn(
      `[emailDelivery] RESEND_API_KEY is not configured. Email to "${input.toEmail}" was simulated (PDF attachment size: ${input.pdfBytes.length} bytes).`,
    );
    return { ok: true, simulated: true };
  }

  const fromEmail = env.RESEND_FROM_EMAIL?.trim() || "MogaFace <onboarding@resend.dev>";
  const resend = new Resend(apiKey);

  const subject = `Your Personalized Aesthetic Analysis & Simulation Dossier [${dossierId}]`;

  const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f7f0e8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e3dfea; }
    .header { background-color: #1a0e2e; padding: 36px 32px; text-align: center; border-bottom: 2px solid #c2a46f; }
    .brand { color: #d4b87a; font-size: 24px; font-weight: bold; letter-spacing: 4px; margin: 0; }
    .subbrand { color: #d4c7e8; font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; margin-top: 8px; }
    .content { padding: 40px 32px; color: #3d2f4f; line-height: 1.6; }
    .greeting { font-size: 20px; font-weight: 600; color: #1a0e2e; margin-bottom: 16px; }
    .badge { display: inline-block; background-color: #f2e6d8; color: #5e358f; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 24px; }
    .summary-card { background-color: #f7f0e8; border-left: 4px solid #5e358f; padding: 20px; border-radius: 0 8px 8px 0; margin: 24px 0; font-size: 14px; color: #3d2f4f; }
    .card-title { color: #5e358f; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
    .cta-block { background-color: #1a0e2e; border-radius: 8px; padding: 28px 24px; margin: 32px 0; text-align: center; color: #ffffff; }
    .cta-heading { color: #d4b87a; font-size: 17px; font-weight: 600; margin-bottom: 10px; }
    .cta-sub { color: #d4c7e8; font-size: 13px; margin-bottom: 20px; }
    .btn { display: inline-block; background-color: #c2a46f; color: #1a0e2e; text-decoration: none; padding: 12px 28px; border-radius: 6px; font-weight: 700; font-size: 13px; letter-spacing: 0.5px; }
    .attachment-notice { border: 1px dashed #c2a46f; background-color: #faf6f1; border-radius: 8px; padding: 16px; margin: 24px 0; text-align: center; font-size: 13px; color: #1a0e2e; }
    .footer { background-color: #f2e6d8; padding: 24px 32px; text-align: center; font-size: 11px; color: #8a7b9a; border-top: 1px solid #e3dfea; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="brand">M O G A F A C E</h1>
      <div class="subbrand">Clinical Facial Architecture &amp; Aesthetic Simulation</div>
    </div>
    <div class="content">
      <div class="greeting">Hello ${firstName},</div>
      <div class="badge">Dossier: ${dossierId}</div>
      <p>
        Thank you for submitting your facial aesthetic assessment. Over the past 30 minutes, our clinical modeling system has processed your diagnostic photographs and assessment responses.
      </p>
      <p>
        Your full <strong>2-page Clinical Aesthetic Consultation Dossier</strong> has been generated and is attached to this email as a PDF.
      </p>

      <div class="attachment-notice">
        📎 <strong>Attachment: MogaFace-Aesthetic-Dossier-${refCode}.pdf</strong><br>
        <span style="font-size: 12px; color: #6b5a7e;">Includes your side-by-side photographic baseline, targeted algorithmic simulation, and identified anatomical opportunities.</span>
      </div>

      ${
        input.reportSummary
          ? `
      <div class="summary-card">
        <div class="card-title">Executive Clinical Summary</div>
        <div>${input.reportSummary}</div>
      </div>`
          : ""
      }

      <div class="cta-block">
        <div class="cta-heading">Ready to Discuss Your Targeted Results?</div>
        <div class="cta-sub">
          Facial aesthetics requires precise hands-on medical evaluation. Connect directly with our clinical coordination desk to schedule your private consultation.
        </div>
        <a href="mailto:${fromEmail}?subject=Consultation%20Inquiry%20-%20${dossierId}" class="btn">
          Schedule Consultation
        </a>
      </div>

      <p style="font-size: 13px; color: #6b5a7e;">
        <strong>Important Safety Notice:</strong> This digital simulation is prepared strictly for educational and aesthetic consultation planning. All clinical procedures require an in-person physical assessment by a licensed medical practitioner.
      </p>
    </div>
    <div class="footer">
      MogaFace Clinical Aesthetics • Confidential Medical Dossier<br>
      Reference ID: ${dossierId} • Generated for ${input.clientName}
    </div>
  </div>
</body>
</html>
  `.trim();

  try {
    const pdfBuffer = Buffer.from(input.pdfBytes);

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [input.toEmail],
      subject,
      html: htmlContent,
      attachments: [
        {
          filename: `MogaFace-Aesthetic-Dossier-${refCode}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    if (error) {
      console.error("[emailDelivery] Resend API error:", error);
      return { ok: false, error: error.message };
    }

    return { ok: true, id: data?.id };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown email error";
    console.error("[emailDelivery] Failed to send email via Resend:", errorMsg);
    return { ok: false, error: errorMsg };
  }
}
