import {readFile} from "node:fs/promises";
import {Suspense} from "react";
import {notFound} from "next/navigation";
import {ReviewWorkspace} from "@/components/review-workspace/ReviewWorkspace";
import {prepareReportDisplay} from "@/lib/review-workspace/display.server.ts";
export const dynamic="force-dynamic";
/** Read-only local fixture, inaccessible in production. Exercises the real workspace component. */
export default async function WorkspacePreview(){
 if(process.env.NODE_ENV!=="development"||!process.env.REPORT_PREVIEW_DATA)notFound();
 const input=JSON.parse(await readFile(process.env.REPORT_PREVIEW_DATA,"utf8"));
 return <Suspense fallback={<p>Opening preview…</p>}><ReviewWorkspace previewData={{name:input.name,original:input.original,initial:null,sidePhotos:input.context?.sidePhotos||[],video:{summary:input.context?.videoSummary||"No usable video context."},consent:true,canRefine:false,status:"preview",suggestedTargets:[],display:await prepareReportDisplay(input.original.base64,input.geometry)}} previewReview={input.review}/></Suspense>;
}
