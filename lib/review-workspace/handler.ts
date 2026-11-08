import {prepareReportDisplay} from "./display.server.ts";
import {appearancePlanFromAssessment} from "../image-generation/appearanceFromAssessment.ts";
import {readPreparedReport,previewState} from "./prepared.ts";
import {processOne} from "../submissions/processOne.ts";
import {getSubmission} from "../submissions/store.ts";
import {getAnalysisRecord,persistIllustrationUse} from "../analysis-session/store.ts";
import {validPortraitGeometry} from "../image-generation/portraitGeometry.ts";
import {validateSourcePhoto} from "../image-generation/output.ts";
import {expressionContext} from "../observation/expressionContext.ts";
import {assessOriginals,generateRevision} from "./generate.server.ts";
import {signReviewImage,verifyReviewImage} from "./receipt.ts";
import {exportReviewHtml,type ExportVersion} from "./export.ts";
import {savePublishedReport} from "./published.ts";
import {parseDetailedReview,parseTargets} from "./types.ts";
const headers={"Cache-Control":"private, no-store","Referrer-Policy":"no-referrer"};
const json=(body:unknown,status=200)=>Response.json(body,{status,headers});
export const MAX_REVIEW_REQUEST_BYTES=4_000_000;
interface Deps {getSubmission:typeof getSubmission;getAnalysisRecord:typeof getAnalysisRecord;persistUse:typeof persistIllustrationUse;assess:typeof assessOriginals;generate:typeof generateRevision;secret:string;prepare:typeof processOne;saveReport:typeof savePublishedReport}
const defaults=():Deps=>({getSubmission,getAnalysisRecord,persistUse:persistIllustrationUse,assess:assessOriginals,generate:generateRevision,prepare:processOne,saveReport:savePublishedReport,secret:process.env.REVIEW_REVISION_SECRET?.trim()||process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()||""});
async function boundedJson(request:Request){
 const reader=request.body?.getReader();if(!reader)throw new Error("invalid_request");
 const chunks:Uint8Array[]=[];let size=0;
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_REVIEW_REQUEST_BYTES){await reader.cancel();throw new Error("too_large");}chunks.push(value);}
 return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
export async function handleReviewWorkspace(request:Request,overrides:Partial<Deps>={}):Promise<Response>{
 const deps={...defaults(),...overrides};
 try{
  if(!["GET","POST"].includes(request.method))return json({error:"method_not_allowed"},405);
  if(request.method==="POST"&&request.headers.get("origin")!==new URL(request.url).origin)return json({error:"origin_required"},403);
  const id=new URL(request.url).searchParams.get("id"),auth=request.headers.get("authorization")||"";
  if(!id||!/^[a-zA-Z0-9-]{1,80}$/.test(id)||!auth.startsWith("Bearer ")||auth.length>300)return json({error:"unauthorized"},401);
  const sub=await deps.getSubmission(id);if(!sub?.analysis_id||!sub.before_image_base64||!sub.before_image_mime)return json({error:"not_found"},404);
  const record=await deps.getAnalysisRecord(sub.analysis_id,auth.slice(7));if(!record)return json({error:"unauthorized"},401);
  if(!deps.secret)return json({error:"workspace_unavailable"},503);
  const wrap=(base64:string,mime:string)=>({base64,mime,receipt:signReviewImage(Buffer.from(base64,"base64"),id,deps.secret)});
  const original=wrap(sub.before_image_base64,sub.before_image_mime);
  const consent=sub.photo_visualization_consent==="granted";
  const selected=appearancePlanFromAssessment(record.assessment).editRegions;
  const suggestedTargets=[...(selected.skin?["skin"]:[]),...(selected.underEye?["under_eye"]:[]),...(selected.hair?["hair"]:[]),...(["brow_opening","lip_vermilion","lower_face_balance","mentolabial","chin_projection"] as const).filter(key=>selected[key])];
  const prepared=readPreparedReport(sub.report_summary);
  const wantsPreview=record.assessment.clinicIntake.wantAfterPhoto!=="no";
  const initial=consent&&wantsPreview&&sub.after_image_base64&&prepared.summary.startsWith("Your Next Face protocol")?wrap(sub.after_image_base64,sub.after_image_mime||"image/jpeg"):null;
  const needsAssessmentConsent=consent&&!record.aiReportConsent&&!prepared.review;
  const needsPreparation=consent&&!needsAssessmentConsent&&!prepared.prepared&&sub.status==="done"&&(sub.retry_count??0)<3;
  const canRetry=consent&&(sub.retry_count??0)<3&&(sub.status==="failed"||sub.status==="done"&&(!prepared.review||wantsPreview&&!initial));
  if(request.method==="GET")return json({display:await prepareReportDisplay(sub.before_image_base64,record.portraitGeometry),suggestedTargets,name:record.contact?.name||"Your appearance review",original,
    initial,review:consent?prepared.review:null,wantsPreview,needsPreparation,needsAssessmentConsent,canRetry,previewStatus:previewState(prepared.summary),
    sidePhotos:record.reportPhotos?[{label:"Left oblique — original",...record.reportPhotos.leftFortyFive},{label:"Right oblique — original",...record.reportPhotos.rightFortyFive}]:[],
    video:expressionContext(record.analysis.expression),consent,canRefine:consent&&validPortraitGeometry(record.portraitGeometry),summary:prepared.summary,status:sub.status});
  if(!consent)return json({error:"photo_consent_required"},403);
  const body=await boundedJson(request);
  if(!body||typeof body!=="object"||Array.isArray(body))return json({error:"invalid_request"},400);
  if(body.action==="prepare"){
   if(!canRetry)return json({status:sub.status});
   if(needsAssessmentConsent&&body.allowAssessment!==true)return json({error:"assessment_consent_required"},403);
   const outcome=await deps.prepare(sub,{authenticatedRecord:needsAssessmentConsent?{...record,aiReportConsent:true}:record});
   return json({status:outcome.outcome});
  }
  if(body.action==="assess"){
   if(prepared.review)return json({review:prepared.review});
   if(!await deps.persistUse(record.id,record))return json({error:"session_limit"},429);
   return json({review:await deps.assess(sub,record.aiReportConsent?record:{...record,reportPhotos:undefined})});
  }
  if(body.action==="publish"){
   const review=prepared.review||parseDetailedReview(body.review,record.videoPreviewContextConsent==="granted"&&expressionContext(record.analysis.expression).status==="usable");
   if(!review||!Array.isArray(body.versions)||body.versions.length>8||!Number.isInteger(body.active)||body.active < -1||body.active>=body.versions.length)return json({error:"invalid_request"},400);
   const versions:ExportVersion[]=[];
   for(const v of body.versions){
    if(!v||typeof v.label!=="string"||v.label.length>100||typeof v.notes!=="string"||v.notes.length>600||!Array.isArray(v.targets)||v.targets.length>9||v.targets.some((t:unknown)=>typeof t!=="string"||t.length>100))return json({error:"invalid_request"},400);
    const image=v.initial===true?initial:v.image;
    if(!image||typeof image.base64!=="string"||typeof image.mime!=="string"||!/^[A-Za-z0-9+/]+={0,2}$/.test(image.base64)||!verifyReviewImage(Buffer.from(image.base64,"base64"),id,image.receipt,deps.secret))return json({error:"unapproved_source"},400);
    versions.push({label:v.label,image,notes:v.notes,targets:v.targets});
   }
   const sidePhotos=record.reportPhotos?[{label:"Left oblique — original",...record.reportPhotos.leftFortyFive},{label:"Right oblique — original",...record.reportPhotos.rightFortyFive}]:[];
   const html=exportReviewHtml(record.contact?.name||"Your appearance review",original,review,versions,body.active,{sidePhotos,videoSummary:expressionContext(record.analysis.expression).summary,display:await prepareReportDisplay(sub.before_image_base64,record.portraitGeometry)});
   const key=await deps.saveReport(html);
   return json({url:`${new URL(request.url).origin}/reports/${key}.html`});
  }
  if(body.action!=="refine")return json({error:"invalid_action"},400);
  const targets=parseTargets(body.targets);
  if(typeof body.notes!=="string"||body.notes.length>600)return json({error:"invalid_notes"},400);
  if(!validPortraitGeometry(record.portraitGeometry))return json({error:"geometry_unavailable"},409);
  const image=body.image;if(!image||typeof image.base64!=="string"||typeof image.mime!=="string"||image.base64.length>3_800_000||!/^[A-Za-z0-9+/]+={0,2}$/.test(image.base64))return json({error:"invalid_image"},400);
  const bytes=Buffer.from(image.base64,"base64"),checked=validateSourcePhoto(bytes,image.mime);
  if(!checked.ok||!verifyReviewImage(bytes,id,image.receipt,deps.secret))return json({error:"unapproved_source"},400);
  if(!await deps.persistUse(record.id,record))return json({error:"session_limit"},429);
  const originalBytes=Buffer.from(sub.before_image_base64,"base64"),originalChecked=validateSourcePhoto(originalBytes,sub.before_image_mime);
  if(!originalChecked.ok)return json({error:"original_unavailable"},409);
  const generated=await deps.generate(bytes,checked.mimeType,record,targets,body.notes.trim(),{bytes:originalBytes,mime:originalChecked.mimeType});
  if(!generated.ok)return json({error:"revision_not_approved",reason:generated.reason},422);
  return json({draft:wrap(generated.base64,generated.mime),targets,notes:body.notes.trim()});
 }catch(error){
  const message=error instanceof Error?error.message:"";
  if(message==="assessment_incomplete")return json({error:"assessment_incomplete"},502);
  if(message==="too_large")return json({error:"too_large"},413);
  if(message==="invalid_targets"||error instanceof SyntaxError)return json({error:"invalid_request"},400);
  return json({error:"workspace_unavailable"},503);
 }
}
