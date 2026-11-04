import {readFile} from "node:fs/promises";
import {exportReviewHtml} from "@/lib/review-workspace/export.ts";
import {REPORT_HEADERS} from "@/lib/review-workspace/published.ts";
export const runtime="nodejs";
export const dynamic="force-dynamic";
/** Explicit developer-only preview. No client media or preview data is committed. */
export async function GET(){
 if(process.env.NODE_ENV!=="development"||!process.env.REPORT_PREVIEW_DATA)return new Response("Not found",{status:404});
 try{const input=JSON.parse(await readFile(process.env.REPORT_PREVIEW_DATA,"utf8"));return new Response(exportReviewHtml(input.name,input.original,input.review,input.versions,input.active,input.context),{headers:REPORT_HEADERS});}
 catch{return new Response("The local report preview is unavailable.",{status:503});}
}
