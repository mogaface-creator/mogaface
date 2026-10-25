import { NextRequest, NextResponse } from "next/server";
import { runClinicalVisionScan, combinedAppearancePreview, buildFullAestheticPrompt, type TreatmentKey } from "@/lib/submissions/clinicalVision";
import { generateAfterImage } from "@/lib/submissions/imageJob";
import { generatePdfReport } from "@/lib/submissions/pdfReport";
import { isUploadedPhoto, validateSourcePhoto } from "@/lib/image-generation/output";

export const runtime = "nodejs";
export const maxDuration = 180; // scan + edit + automated quality review

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "not_found" }, { status: 404 });
  const origin = req.headers.get("origin");
  if (!origin || new URL(origin).host !== req.headers.get("host")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const photoFile = formData.get("photo") as File | null;
    const clientName = (formData.get("clientName") as string | null)?.trim() || "Manoj";
    const customPrompt = (formData.get("customPrompt") as string | null)?.trim();
    const customDirective = (formData.get("customDirective") as string | null)?.trim();
    const wantPdf = formData.get("generatePdf") === "true";
    const simulateHair = formData.get("simulateHair") === "true";
    const rawFocus = (formData.get("focus") as string | null)?.trim() || "all";
    const intensity = ((formData.get("intensity") as string | null)?.trim() || "balanced") as "subtle" | "balanced" | "defined";

    if (!isUploadedPhoto(photoFile) || photoFile.size > 10_000_000) {
      return NextResponse.json(
        { ok: false, error: "Please upload or capture a valid portrait photo." },
        { status: 400 }
      );
    }

    const beforeArrayBuffer = await photoFile.arrayBuffer();
    const beforeBytes = Buffer.from(beforeArrayBuffer);
    const source = validateSourcePhoto(new Uint8Array(beforeBytes), photoFile.type);
    if (!source.ok) return NextResponse.json({ error: "invalid_photo" }, { status: 400 });
    const beforeMime = source.mimeType;

    // 1. Run Clinical Vision Scan (GPT-4o Vision)
    const isAllPillars = rawFocus === "all" || rawFocus === "combined";
    const concerns = isAllPillars
      ? (simulateHair ? ["skin", "jawline", "under_eye", "forehead", "hair"] : ["skin", "jawline", "under_eye", "forehead"])
      : [rawFocus];

    const visionResult = isAllPillars
      ? combinedAppearancePreview({
          intensity,
          simulateHair,
          customDirective: customDirective || customPrompt,
          clientName,
        })
      : await runClinicalVisionScan({
          beforeBytes,
          beforeMime,
          clientName,
          simulateHair,
          intakeConcerns: concerns,
          intensity,
          customDirective: customDirective || customPrompt,
        });

    // 2. Build or resolve prompt
    const promptToUse = customPrompt || visionResult.imagePrompt || buildFullAestheticPrompt({
      firstName: clientName,
      keys: concerns as TreatmentKey[],
      simulateHair,
      intensity,
      customDirective,
    });

    // 3. Run Photorealistic Aesthetic Image Generation (chatgpt-image-latest)
    const imageResult = await generateAfterImage({
      beforeBytes,
      beforeMime,
      clinicalVision: { ...visionResult, imagePrompt: promptToUse },
      customPrompt: customPrompt || null,
      simulateHair,
      intensity,
      customDirective,
      debugPreview: true,
    });

    if (!imageResult.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: imageResult.review?.status === "rejected"
            ? `Review notice: ${imageResult.review.reason || "The draft did not pass automated quality review."}`
            : `Image generation failed: ${imageResult.reason}`,
          review: imageResult.review,
          ...(imageResult.debugPreview ? { rejectedPreview: `data:${imageResult.debugPreview.mime};base64,${imageResult.debugPreview.base64}` } : {}),
        },
        { status: 502 }
      );
    }

    const afterBase64 = imageResult.base64;
    const afterMime = imageResult.mime;
    const afterBytes = Buffer.from(afterBase64, "base64");

    // 4. Optional 2-Page Clinical PDF Dossier Generation
    let pdfBase64: string | undefined;
    if (wantPdf) {
      try {
        const pdfBytes = await generatePdfReport({
          clientName,
          referenceId: `CLINIC-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
          beforeImageBytes: beforeBytes,
          afterImageBytes: afterBytes,
          reportSummary: visionResult.executiveSummary,
          detectedAreas: visionResult.opportunities,
          intakeConcerns: concerns,
          pillars: visionResult.pillars,
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
      pillars: visionResult.pillars,
      harmonyScore: visionResult.harmonyScore,
      symmetryIndex: visionResult.symmetryIndex,
      promptUsed: promptToUse,
      pdfBase64,
      review: imageResult.review,
    });
  } catch (err) {
    console.error("[test-simulate] Error:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Internal simulation error" },
      { status: 500 }
    );
  }
}
