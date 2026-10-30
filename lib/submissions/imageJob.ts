/**
 * Masked illustrative appearance preview.
 * Selected regions are sent to OpenAI's image edit API; the result is locally composited with the source.
 */

import { DEFAULT_IMAGE_MODEL, OPENAI_IMAGE_EDITS_URL, chooseImageSize } from "../image-generation/openaiImages.ts";
import { imageDimensions, validateGeneratedImage } from "../image-generation/output.ts";
import type { AnalysisRecord } from "../analysis-session/types.ts";
import type { ImageMime } from "../image-generation/output.ts";
import { ALL_PORTRAIT_EDIT_REGIONS, validPortraitGeometry } from "../image-generation/portraitGeometry.ts";
import type { PortraitEditRegions, PortraitGeometry } from "../image-generation/portraitGeometry.ts";
import { compositePortraitEdit, preparePortraitEdit } from "../image-generation/portraitEdit.ts";
import { appearancePlanFromAssessment } from "../image-generation/appearanceFromAssessment.ts";
import sharp from "sharp";
import type { ClinicalVisionResult } from "./clinicalVision.ts";
import { buildFullAestheticPrompt } from "./clinicalVision.ts";
import { reviewAfterImage, type ImageReview } from "./imageReview.ts";
import { MAX_GENERATED_IMAGE_BYTES } from "../image-generation/output.ts";

export type ImageJobResult =
  | { ok: true; base64: string; mime: string; model?: string; review?: ImageReview }
  | { ok: false; reason: string; review?: ImageReview; debugPreview?: { base64: string; mime: string } };

export interface ImageJobInput {
  debugPreview?: boolean;
  beforeBytes: Buffer;
  beforeMime: ImageMime;
  record?: AnalysisRecord | null;
  clinicalVision?: ClinicalVisionResult | null;
  customPrompt?: string | null;
  simulateHair?: boolean;
  intensity?: "subtle" | "balanced" | "defined";
  customDirective?: string;
  portraitGeometry?: unknown;
  editRegion?: unknown;
  editRegions?: PortraitEditRegions;
}

const EXTENSION: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

function roundTo16(value:number){return Math.max(16,Math.round(value/16)*16);}
function aspectMatchedImageSize(bytes:Uint8Array,model:string):string{
  const dimensions=imageDimensions(bytes);
  if(!dimensions)return chooseImageSize(bytes);
  const {width,height}=dimensions;
  const aspect=width/height;
  // GPT Image 2.x supports custom multiples-of-16 resolutions. Matching the
  // source aspect ratio avoids stretching the face during masked compositing.
  if(/^gpt-image-2(?:\.5|-)/.test(model) || model === "chatgpt-image-latest"){
    const longEdge=1536;
    const targetWidth=aspect>=1?longEdge:roundTo16(longEdge*aspect);
    const targetHeight=aspect<1?longEdge:roundTo16(longEdge/aspect);
    if(targetWidth/targetHeight>=1/3 && targetWidth/targetHeight<=3)return `${targetWidth}x${targetHeight}`;
  }
  return chooseImageSize(bytes);
}

function requestedSizeOrMatched(source:Uint8Array,model:string,requested:string|undefined):string{
  const matched=aspectMatchedImageSize(source,model);
  if(!requested)return matched;
  const m=/^(\d{3,4})x(\d{3,4})$/.exec(requested);
  const d=imageDimensions(source);
  if(!m||!d)return matched;
  const reqAspect=Number(m[1])/Number(m[2]);
  return Math.abs(reqAspect-d.width/d.height)<.005?requested:matched;
}

export async function generateAfterImage(input: ImageJobInput): Promise<ImageJobResult> {
  const env = process.env;
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) return { ok: false, reason: "openai_not_configured" };
  if (env.IMAGE_GENERATION_PROVIDER?.trim().toLowerCase() !== "openai") {
    return { ok: false, reason: "image_provider_disabled" };
  }

  const rawModel = env.IMAGE_GENERATION_MODEL?.trim();
  const model = rawModel || DEFAULT_IMAGE_MODEL;

  const timeoutMs = Number(env.IMAGE_GENERATION_TIMEOUT_MS) > 0
    ? Math.min(120_000, Math.max(10_000, Number(env.IMAGE_GENERATION_TIMEOUT_MS)))
    : 120_000;

  const bytes = new Uint8Array(input.beforeBytes);
  const mimeType = input.beforeMime;
  let prompt = input.customPrompt?.trim();
  let editRegions=input.editRegions ?? ALL_PORTRAIT_EDIT_REGIONS;
  let appearancePlan:ReturnType<typeof appearancePlanFromAssessment>|null=null;
  if(input.record?.assessment){
    appearancePlan=appearancePlanFromAssessment(input.record.assessment);
    // Production preferences always determine the prompt; callers cannot replace them.
    prompt=appearancePlan.prompt;
    editRegions=appearancePlan.editRegions;
  }

  const geometryCandidate=input.record?.portraitGeometry ?? input.portraitGeometry;
  const geometry=validPortraitGeometry(geometryCandidate)?geometryCandidate as PortraitGeometry:null;
  // The production path fails closed: never send a full-frame portrait edit
  // when the landmarks needed to protect identity and non-selected regions
  // could not be located.
  if(input.record?.assessment && !geometry)return {ok:false,reason:"portrait_geometry_unavailable"};
  let prepared:Awaited<ReturnType<typeof preparePortraitEdit>>|null=null;
  try{if(geometry)prepared=await preparePortraitEdit(input.beforeBytes,geometry,editRegions);}catch{return {ok:false,reason:"portrait_mask_failed"};}
  const editBytes=prepared?new Uint8Array(prepared.image):bytes;
  const editMime=prepared?"image/png":mimeType;
  const ext=prepared?"png":(EXTENSION[editMime]||"jpg");
  const editSize=requestedSizeOrMatched(editBytes,model,env.IMAGE_GENERATION_SIZE?.trim());

  // Build or resolve the targeted aesthetic simulation prompt
  if (!prompt) {
    if (input.clinicalVision?.imagePrompt?.trim()) {
      prompt = input.clinicalVision.imagePrompt.trim();
    } else {
      prompt = buildFullAestheticPrompt({
        simulateHair: input.simulateHair,
        intensity: input.intensity || "balanced",
        customDirective: input.customDirective,
      });
    }
  }

  console.log(`[imageJob] Dispatching aesthetic simulation to OpenAI (${model}).`);

  try {
    const postEdit = async (modelName: string, size?: string, quality?: string) => {
      const form = new FormData();
      form.append("model", modelName);
      form.append("image", new Blob([editBytes as BlobPart], { type: editMime }), `portrait.${ext}`);
      if(prepared)form.append("mask",new Blob([prepared.mask as BlobPart],{type:"image/png"}),"portrait-mask.png");
      form.append("prompt", prompt);
      form.append("n", "1");
      form.append("size", size || editSize);
      form.append("quality", quality || "high");
      if (/^gpt-image-1\.5(?:-|$)/.test(modelName)) form.append("input_fidelity", "high");
      form.append("output_format", "jpeg");

      return fetch(OPENAI_IMAGE_EDITS_URL, {
        method: "POST",
        headers: { authorization: `Bearer ${apiKey}` },
        body: form,
        signal: AbortSignal.timeout(timeoutMs),
      });
    };

    let usedModel = model;
    let response = await postEdit(model, editSize, env.IMAGE_GENERATION_QUALITY?.trim());

    // If an optional size or custom model fails with 400, retry once with standard model
    if (!response.ok && response.status === 400 && model !== DEFAULT_IMAGE_MODEL) {
      console.warn(`[imageJob] Retrying with default model ${DEFAULT_IMAGE_MODEL}...`);
      usedModel = DEFAULT_IMAGE_MODEL;
      response = await postEdit(DEFAULT_IMAGE_MODEL);
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error(`[imageJob] OpenAI API error (${response.status}):`, errText.slice(0, 300));
      let detail = `openai_error_${response.status}`;
      try {
        const parsed = JSON.parse(errText);
        if (parsed.error?.code === "credit_balance_exhausted" || parsed.error?.type === "insufficient_quota" || errText.includes("no credits remaining")) {
          detail = "OpenAI account has zero credits remaining. Please add credits at platform.openai.com/billing";
        } else if (response.status === 429) {
          detail = "OpenAI rate limit reached. Please wait a few moments and try again.";
        } else if (parsed.error?.message) {
          detail = parsed.error.message;
        }
      } catch {
        // fallback to code
      }
      return { ok: false, reason: detail };
    }

    const data = (await response.json()) as { data?: { b64_json?: unknown }[] };
    const checked = validateGeneratedImage(data.data?.[0]?.b64_json, editBytes);
    if (!checked.ok) {
      return { ok: false, reason: "invalid_result_image" };
    }

    let finalBytes: Uint8Array=checked.bytes;
    let finalMime=checked.mimeType;
    if(prepared){
      try{
        const composited=await compositePortraitEdit(prepared,checked.bytes);
        const lossless=await sharp(composited).webp({lossless:true,effort:6}).toBuffer();
        if(lossless.length<=MAX_GENERATED_IMAGE_BYTES){finalBytes=lossless;finalMime="image/webp";}
        else {finalBytes=await sharp(composited).jpeg({quality:96,chromaSubsampling:"4:4:4",mozjpeg:true}).toBuffer();finalMime="image/jpeg";}
      }
      catch(error){
        const reason=error instanceof Error && error.message.startsWith("candidate_aspect_mismatch") ? "portrait_output_aspect_mismatch" : "portrait_composite_failed";
        const detail=error instanceof Error ? error.message : "unknown_error";
        console.warn(`[imageJob] Could not composite OpenAI output (${reason}); requested ${editSize}; ${detail}.`);
        return {ok:false,reason};
      }
    }
    const finalBase64=Buffer.from(finalBytes).toString("base64");
    if(!validateGeneratedImage(finalBase64,bytes).ok)return {ok:false,reason:"invalid_composited_image"};

    // Automated quality & identity preservation triage
    const review = await reviewAfterImage({
      apiKey,
      model: env.CLINICAL_VISION_MODEL?.trim() || "gpt-4o",
      before: `data:${mimeType};base64,${input.beforeBytes.toString("base64")}`,
      after: `data:${finalMime};base64,${finalBase64}`,
      prompt,
    });

    console.log("[imageJob] Image review outcome:", review.status);

    if (review.status !== "approved") {
      return {ok:false,reason:review.status === "rejected" ? "image_quality_review_failed" : "image_review_unavailable",review,...(input.debugPreview ? {debugPreview:{base64:finalBase64,mime:finalMime}} : {})};
    }

    return { ok: true, base64: finalBase64, mime: finalMime, model: usedModel, review };
  } catch (err) {
    console.error("[imageJob] Simulation generation error:", err);
    return {
      ok: false,
      reason: err instanceof Error && err.name === "TimeoutError" ? "generation_timeout" : "generation_error",
    };
  }
}
