import {repairLegacyReportDisplay} from "@/lib/review-workspace/legacyDisplay.ts";
import {readPublishedReport,REPORT_HEADERS} from "@/lib/review-workspace/published.ts";
export const runtime="nodejs";
export async function GET(_request:Request,{params}:{params:Promise<{file:string}>}){
 const {file}=await params;const key=/^([a-f0-9]{64})\.html$/.exec(file)?.[1];
 if(!key)return new Response("Report not found",{status:404,headers:REPORT_HEADERS});
 try{const html=await readPublishedReport(key);return new Response(html?repairLegacyReportDisplay(html):"Report not found",{status:html?200:404,headers:REPORT_HEADERS});}catch{return new Response("Report temporarily unavailable. Please retry.",{status:503,headers:REPORT_HEADERS});}
}
