import {getSubmission} from "./store.ts";
import {getAnalysisRecord} from "../analysis-session/store.ts";
import {generatePdfReport} from "./pdfReport.ts";
import {protocolInput} from "./protocolInput.ts";
export async function downloadSubmissionReport(request:Request,deps={getSubmission,getAnalysisRecord,generatePdfReport}):Promise<Response>{
 const id=new URL(request.url).searchParams.get("id");const auth=request.headers.get("authorization")||"";
 if(!id || !auth.startsWith("Bearer "))return Response.json({error:"unauthorized"},{status:401});
 try{
  const sub=await deps.getSubmission(id);if(!sub?.analysis_id)return Response.json({error:"not_found"},{status:404});
  const record=await deps.getAnalysisRecord(sub.analysis_id,auth.slice(7));if(!record)return Response.json({error:"unauthorized"},{status:401});
  const deliveryOnlyFailure=sub.status==="failed" && sub.email_error?.startsWith("Email delivery failed:") && !!sub.report_summary;
  if((sub.status!=="done" && !deliveryOnlyFailure) || !sub.before_image_base64)return Response.json({error:"report_not_ready"},{status:409});
  const current=sub.report_summary?.startsWith("Your Next Face protocol")===true;
  const bytes=await deps.generatePdfReport(protocolInput(record,{name:record.contact?.name||"Your protocol",id:sub.id,front:Buffer.from(sub.before_image_base64,"base64"),after:current&&sub.after_image_base64 ? Buffer.from(sub.after_image_base64,"base64") : null,summary:sub.report_summary||""}));
  return new Response(Buffer.from(bytes),{headers:{"Content-Type":"application/pdf","Content-Disposition":"attachment; filename=Next-Face-Protocol.pdf","Cache-Control":"private, no-store","Referrer-Policy":"no-referrer"}});
 }catch{return Response.json({error:"report_unavailable"},{status:503});}
}
