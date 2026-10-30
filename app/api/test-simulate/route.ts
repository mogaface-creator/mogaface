import { comparisonSummary } from "@/lib/submissions/imageReview";
import { buildAppearancePlan, parseAppearanceControls, DEFAULT_APPEARANCE_CONTROLS } from "@/lib/image-generation/appearancePlan";
import { NextRequest, NextResponse } from "next/server";
import { combinedAppearancePreview } from "@/lib/submissions/clinicalVision";
import { generateAfterImage } from "@/lib/submissions/imageJob";
import { generatePdfReport } from "@/lib/submissions/pdfReport";
import { DEFAULT_IMAGE_MODEL } from "@/lib/image-generation/openaiImages";
import { isUploadedPhoto, validateSourcePhoto } from "@/lib/image-generation/output";
import { validPortraitGeometry } from "@/lib/image-generation/portraitGeometry";

export const runtime = "nodejs";
export const maxDuration = 180; // scan + edit + automated quality review

export async function GET() {
  if (process.env.NODE_ENV !== "development") return NextResponse.json({error:"not_found"},{status:404});
  const configured = !!process.env.OPENAI_API_KEY?.trim() && process.env.IMAGE_GENERATION_PROVIDER?.trim().toLowerCase() === "openai";
  const raw = process.env.IMAGE_GENERATION_MODEL?.trim();
  return NextResponse.json({configured,model: !raw || raw === "gpt-image-2.5-sunburst" ? DEFAULT_IMAGE_MODEL : raw},{headers:{"Cache-Control":"no-store"}});
}

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV !== "development") return NextResponse.json({error:"not_found"},{status:404});
  try {
    if (new URL(req.headers.get("origin") || "").host !== (req.headers.get("host") || new URL(req.url).host)) return NextResponse.json({error:"forbidden"},{status:403});
  } catch { return NextResponse.json({error:"forbidden"},{status:403}); }

  try {
    const formData = await req.formData();
    if (formData.get("openaiConsent") !== "granted") return NextResponse.json({error:"Agree to sending the portrait to OpenAI first."},{status:400});
    const photoFile = formData.get("photo") as File | null;
    const clientName = (formData.get("clientName") as string | null)?.trim() || "Guest";
    const customDirective = (formData.get("customDirective") as string | null)?.trim();
    const wantPdf = formData.get("generatePdf") === "true";
    const simulateHair = formData.get("simulateHair") === "true";
    const rawFocus = (formData.get("focus") as string | null)?.trim() || "all";
    const intensity = ((formData.get("intensity") as string | null)?.trim() || "balanced") as "subtle" | "balanced" | "defined";

    const targetsJson = formData.get("targets") as string | null;
    let targets: string[] = [];
    if (targetsJson) {
      try {
        const parsed = JSON.parse(targetsJson);
        if (Array.isArray(parsed)) {
          targets = parsed.map((t) => (t === "hairline" ? "hair" : String(t)));
        }
      } catch {
        // continue
      }
    }

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

    let portraitGeometry: unknown;
    try {
      portraitGeometry = JSON.parse(String(formData.get("portraitGeometry") || "null"));
    } catch {
      return NextResponse.json({ error: "Could not locate the face safely. Please choose a clear, front-facing photo." }, { status: 400 });
    }
    if (!validPortraitGeometry(portraitGeometry)) {
      return NextResponse.json({ error: "Could not locate the face safely. Please choose a clear, front-facing photo." }, { status: 400 });
    }

    // 1. Run Clinical Vision Scan (GPT-4o Vision)
    const isAllPillars = rawFocus === "all" || rawFocus === "combined";
    const concerns = targets.length > 0
      ? targets
      : isAllPillars
      ? (simulateHair ? ["skin", "jawline", "under_eye", "forehead", "hair"] : ["skin", "jawline", "under_eye", "forehead"])
      : [rawFocus];

    if (!["subtle","balanced","defined"].includes(intensity) || !["all","combined","skin","jawline","under_eye","forehead","midface","hair"].includes(rawFocus) || (customDirective?.length || 0)>600) return NextResponse.json({error:"invalid_options"},{status:400});
    const visionResult = combinedAppearancePreview({ intensity, simulateHair, customDirective, clientName });
    const allowedTargets = ["skin","jawline","under_eye","forehead","midface","hair"];
    if (targets.some(target => !allowedTargets.includes(target))) return NextResponse.json({error:"invalid_targets"},{status:400});
    let appearancePlan: ReturnType<typeof buildAppearancePlan>;
    try {
      const controls = formData.has("appearanceControls")
        ? parseAppearanceControls(JSON.parse(String(formData.get("appearanceControls"))))
        : {...DEFAULT_APPEARANCE_CONTROLS, contour: "preserve" as const};
      appearancePlan = buildAppearancePlan(controls,{focus:rawFocus,simulateHair,directive:customDirective,targets: targets.length ? targets : undefined});
    } catch { return NextResponse.json({error:"invalid_appearance_controls"},{status:400}); }
    const promptToUse = appearancePlan.prompt;
    const enabled = (key:string) => appearancePlan.areas.some(area => area.key === key && area.level !== "preserve");
    const editRegions = {
      hair: enabled("hair"), skin: enabled("skin"), contour: enabled("contour"),
      underEye: enabled("under_eye"), forehead: enabled("forehead"),
    };

    // 3. Generate and locally composite one masked illustrative edit.
    const imageResult = await generateAfterImage({
      beforeBytes,
      beforeMime,
      clinicalVision: { ...visionResult, imagePrompt: promptToUse },
      customPrompt: promptToUse,
      simulateHair,
      intensity,
      customDirective,
      portraitGeometry,
      ...(editRegions ? { editRegions } : {}),
      debugPreview: true,
    });

    if (!imageResult.ok) {
      const userMessage = imageResult.reason === "portrait_output_aspect_mismatch"
        ? "OpenAI returned a differently cropped image, so the preview was safely rejected. The image request completed, but no face edit was used."
        : imageResult.reason === "portrait_composite_failed"
        ? "The generated image could not be safely combined with the original photo, so it was rejected."
        : undefined;
      return NextResponse.json(
        {
          ok: false,
          error: userMessage || (imageResult.review?.status === "rejected"
            ? `Review notice: ${imageResult.review.reason || "The draft did not pass automated quality review."}`
            : imageResult.reason.startsWith("OpenAI")
            ? imageResult.reason
            : `Image generation failed: ${imageResult.reason}`),
          review: imageResult.review,
          ...(imageResult.debugPreview ? { rejectedPreview: `data:${imageResult.debugPreview.mime};base64,${imageResult.debugPreview.base64}` } : {}),
        },
        { status: 502 }
      );
    }

    const afterBase64 = imageResult.base64;
    const afterMime = imageResult.mime;
    const afterBytes = Buffer.from(afterBase64, "base64");

    const reportSummary = comparisonSummary(imageResult.review);

    // 4. Optional preview PDF generation
    let pdfBase64: string | undefined;
    if (wantPdf) {
      try {
        const pdfBytes = await generatePdfReport({
          clientName,
          referenceId: `CLINIC-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
          beforeImageBytes: beforeBytes,
          afterImageBytes: afterBytes,
          previewStatus: "quality_checked",
          reportSummary,
          reportScopeNote: "Local preview only. No clinical assessment, treatment suitability, measured improvement or outcome prediction was performed.",
          detectedAreas: [],
          intakeConcerns: concerns,
          pillars: [],

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
      executiveSummary: reportSummary,
      opportunities: [],
      pillars: [],
      model: imageResult.model,
      // Keep image-generation instructions on the server, including in local tests.
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
