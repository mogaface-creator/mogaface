import { NextRequest, NextResponse } from "next/server";
import { runClinicalVisionScan } from "@/lib/submissions/clinicalVision";
import { generateAfterImage } from "@/lib/submissions/imageJob";
import { generatePdfReport } from "@/lib/submissions/pdfReport";
import type { ImageMime } from "@/lib/image-generation/output";

export const runtime = "nodejs";
export const maxDuration = 60; // 60s max execution time on Vercel Pro / Node

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const photoFile = formData.get("photo") as File | null;
    const clientName = (formData.get("clientName") as string | null)?.trim() || "Test Patient";
    const customPrompt = (formData.get("customPrompt") as string | null)?.trim();
    const wantPdf = formData.get("generatePdf") === "true";

    if (!photoFile) {
      return NextResponse.json(
        { ok: false, error: "Please upload or capture a photo." },
        { status: 400 }
      );
    }

    const beforeArrayBuffer = await photoFile.arrayBuffer();
    const beforeBytes = Buffer.from(beforeArrayBuffer);
    const beforeMime = (photoFile.type || "image/jpeg") as ImageMime;

    // 1. Run Clinical Vision Scan (GPT-4o Vision)
    const visionResult = await runClinicalVisionScan({
      beforeBytes,
      beforeMime,
      clientName,
      intakeConcerns: ["Hairline restoration", "Jawline definition", "Acne & dermal clearance", "Under-eye rejuvenation"],
    });

    // If user provided a custom prompt override, inject it into visionResult
    if (customPrompt) {
      visionResult.imagePrompt = customPrompt;
    }

    // 2. Run Image Generation (chatgpt-image-latest)
    const imageResult = await generateAfterImage({
      beforeBytes,
      beforeMime,
      record: null,
      clinicalVision: visionResult,
    });

    if (!imageResult.ok) {
      return NextResponse.json(
        { ok: false, error: `Image generation failed: ${imageResult.reason}` },
        { status: 502 }
      );
    }

    const afterBase64 = imageResult.base64;
    const afterMime = imageResult.mime;
    const afterBytes = Buffer.from(afterBase64, "base64");

    // 3. Optional PDF generation
    let pdfBase64: string | undefined;
    if (wantPdf) {
      try {
        const pdfBytes = await generatePdfReport({
          clientName,
          referenceId: `TEST-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
          beforeImageBytes: beforeBytes,
          afterImageBytes: afterBytes,
          reportSummary: visionResult.executiveSummary,
          detectedAreas: visionResult.opportunities,
          intakeConcerns: ["Hairline & Follicular Rejuvenation", "Jawline & Mandibular Sculpting", "Dermal Clarity"],
          harmonyScore: visionResult.harmonyScore,
          symmetryIndex: visionResult.symmetryIndex,
        });
        pdfBase64 = Buffer.from(pdfBytes).toString("base64");
      } catch (pdfErr) {
        console.error("[test-simulate] PDF generation error:", pdfErr);
      }
    }

    return NextResponse.json({
      ok: true,
      beforeDataUrl: `data:${beforeMime};base64,${beforeBytes.toString("base64")}`,
      afterDataUrl: `data:${afterMime};base64,${afterBase64}`,
      executiveSummary: visionResult.executiveSummary,
      opportunities: visionResult.opportunities,
      harmonyScore: visionResult.harmonyScore,
      symmetryIndex: visionResult.symmetryIndex,
      promptUsed: visionResult.imagePrompt,
      pdfBase64,
    });
  } catch (err) {
    console.error("[test-simulate] Error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Internal simulation error" },
      { status: 500 }
    );
  }
}
