import {after} from "next/server";
import {handleSubmitAssessment} from "@/lib/submissions/submitHandler";
import {getSubmission} from "@/lib/submissions/store";
import {processOne} from "@/app/api/process-submissions/route";
export const runtime="nodejs";
export const maxDuration=180;
export async function POST(request:Request){
 const response=await handleSubmitAssessment(request);
 if(response.ok){const body=await response.clone().json();if(typeof body.submissionId==="string")after(async()=>{
   try{const submission=await getSubmission(body.submissionId);if(submission?.status==="pending")await processOne(submission);}catch{console.error("[submit-assessment] Background processing unavailable; queued submission retained.");}
 });}
 return response;
}
