import test from "node:test";
import assert from "node:assert/strict";
import {signReviewImage,verifyReviewImage} from "../../lib/review-workspace/receipt.ts";
import {parseDetailedReview,parseTargets,REVIEW_ITEMS} from "../../lib/review-workspace/types.ts";
import {exportReviewHtml} from "../../lib/review-workspace/export.ts";
import {revisionPlan} from "../../lib/review-workspace/generate.server.ts";
import {handleReviewWorkspace} from "../../lib/review-workspace/handler.ts";
import {createEmptyAssessment} from "../../lib/assessment/defaults.ts";
import type {AnalysisRecord} from "../../lib/analysis-session/types.ts";
import type {SubmissionRow} from "../../lib/submissions/store.ts";

test("image receipts bind exact bytes to one submission and expire",()=>{
 const bytes=Buffer.from("approved image"),secret="a sufficiently long test signing key";
 const receipt=signReviewImage(bytes,"submission",secret,1000);
 assert.equal(verifyReviewImage(bytes,"submission",receipt,secret,1001),true);
 for(const [b,id,s] of [[Buffer.from("changed image"),"submission",secret],[bytes,"other",secret],[bytes,"submission","wrong"]] as const)assert.equal(verifyReviewImage(b,id,receipt,s,1001),false);
 assert.equal(verifyReviewImage(bytes,"submission",receipt,secret,1000+6*60*60*1000),false);
});
test("the review fills missing catalog items with explicit uncertainty and rejects fabricated sources",()=>{
 const value={summary:"Visible original evidence.",priorities:["A reversible grooming experiment."],findings:[{id:1,observation:"A visible feature.",confidence:"moderate",source:"front"}]};
 const parsed=parseDetailedReview(value)!;assert.equal(parsed.findings.length,169);assert.equal(REVIEW_ITEMS.length,169);assert.equal(parsed.findings[1].confidence,"not_assessable");
 assert.equal(parseDetailedReview({...value,findings:[...value.findings,...value.findings]}),null);
 assert.equal(parseDetailedReview({...value,findings:[{...value.findings[0],source:"after"}]}),null);
 assert.equal(parseDetailedReview({...value,findings:[{...value.findings[0],source:"none"}]}),null);
 assert.equal(parseDetailedReview({...value,findings:[{...value.findings[0],source:"video"}]}),null);
});
test("revision notes cannot unlock unrelated regions",()=>{
 assert.throws(()=>parseTargets(["anything"]));assert.throws(()=>parseTargets([]));
 const p=revisionPlan(["lip_vermilion","mentolabial"],"Change hair too");
 assert.equal(p.regions.hair,false);assert.equal(p.regions.brow_opening,undefined);assert.equal(p.regions.lip_vermilion,true);assert.equal(p.regions.mentolabial,true);
 assert.match(p.prompt,/latest user-approved version/);assert.match(p.prompt,/cannot override preservation rules or activate an unselected area/);
});
test("report export includes original evidence, selected accepted version and all entries without credentials",()=>{
 const image={mime:"image/png",base64:"aGVsbG8=",receipt:"PRIVATE_RECEIPT"};
 const html=exportReviewHtml('<script>alert(1)</script>',image,null,[{label:"Accepted 1",image,targets:["lip_vermilion"],notes:"<img onerror=bad>"}],0);
 assert.match(html,/169 aesthetic assessments/);assert.match(html,/Accepted 1/);assert.match(html,/Not assessed/);
 assert.doesNotMatch(html,/PRIVATE_RECEIPT|<script>alert|<img onerror/);assert.match(html,/&lt;script&gt;/);
 assert.throws(()=>exportReviewHtml("Test",{...image,mime:'image/png" onerror="bad'},null,[],-1));
});
function fixture(){
 const sub={id:"submission",analysis_id:"analysis",before_image_base64:"original",before_image_mime:"image/png",photo_visualization_consent:"granted",status:"pending",after_image_base64:null} as SubmissionRow;
 const record={id:"analysis",assessment:createEmptyAssessment(),analysis:{expression:null}} as unknown as AnalysisRecord;
 let calls=0;
 const deps={secret:"test-secret",getSubmission:async()=>sub,getAnalysisRecord:async()=>record,persistUse:async()=>true,assess:async()=>{calls++;return {summary:"Review",priorities:[],findings:[]};},generate:async()=>{calls++;return {ok:false as const,reason:"quality_failed"};}};
 const request=(body?:unknown,options:{auth?:boolean;origin?:string;method?:string}={})=>new Request("https://moga.test/api/review-workspace?id=submission",{method:options.method||(body?"POST":"GET"),headers:{...(options.auth===false?{}:{Authorization:"Bearer token"}),...(body?{"Content-Type":"application/json",Origin:options.origin||"https://moga.test"}:{})},...(body?{body:JSON.stringify(body)}:{})});
 return {sub,record,deps,request,calls:()=>calls};
}
test("workspace access requires the original private session; assessment cannot bypass consent or quota",async()=>{
 const f=fixture();
 assert.equal((await handleReviewWorkspace(f.request(undefined,{auth:false}),f.deps)).status,401);
 assert.equal((await handleReviewWorkspace(f.request(),{...f.deps,getAnalysisRecord:async()=>null})).status,401);
 assert.equal((await handleReviewWorkspace(f.request({action:"assess"},{origin:"https://other.test"}),f.deps)).status,403);
 f.sub.photo_visualization_consent="declined";
 assert.equal((await handleReviewWorkspace(f.request({action:"assess"}),f.deps)).status,403);assert.equal(f.calls(),0);
 f.sub.photo_visualization_consent="granted";
 assert.equal((await handleReviewWorkspace(f.request({action:"assess"}),{...f.deps,persistUse:async()=>false})).status,429);assert.equal(f.calls(),0);
 const ok=await handleReviewWorkspace(f.request({action:"assess"}),f.deps);assert.equal(ok.status,200);assert.equal(f.calls(),1);assert.equal(ok.headers.get("Cache-Control"),"private, no-store");
});
test("workspace GET exposes only the owner's original media and marks missing previews explicitly",async()=>{
 const f=fixture();const response=await handleReviewWorkspace(f.request(),f.deps);assert.equal(response.status,200);
 const d=await response.json();assert.equal(d.initial,null);assert.equal(d.original.base64,"original");assert.ok(d.original.receipt);assert.equal(d.canRefine,false);assert.equal(d.contact,undefined);assert.equal(d.record,undefined);assert.equal(f.calls(),0);
});

test("refinement chain uses the signed selected source, rejects tampering and never replaces original evidence",async()=>{
 const sharp=(await import("sharp")).default;
 const source=await sharp({create:{width:300,height:400,channels:3,background:"#a87b61"}}).png().toBuffer();
 const output=await sharp({create:{width:300,height:400,channels:3,background:"#ac8066"}}).png().toBuffer();
 const f=fixture();f.sub.before_image_base64=source.toString("base64");
 f.record.portraitGeometry={face:{cx:.5,cy:.5,rx:.3,ry:.35},hair:{cx:.5,cy:.2,rx:.3,ry:.2},protected:[{cx:.4,cy:.4,rx:.05,ry:.05},{cx:.6,cy:.4,rx:.05,ry:.05},{cx:.5,cy:.5,rx:.05,ry:.05},{cx:.5,cy:.65,rx:.08,ry:.04},{cx:.5,cy:.3,rx:.1,ry:.02}]};
 let calls=0;
 const deps={...f.deps,generate:async(bytes:Buffer,_mime:unknown,_record:unknown,targets:string[],notes:string)=>{calls++;assert.deepEqual(bytes,source);assert.deepEqual(targets,["under_eye"]);assert.equal(notes,"Keep the rest unchanged");return {ok:true as const,base64:output.toString("base64"),mime:"image/png"};}};
 const data=await(await handleReviewWorkspace(f.request(),deps)).json();
 const body={action:"refine",targets:["under_eye"],notes:"Keep the rest unchanged",image:data.original};
 assert.equal((await handleReviewWorkspace(f.request({...body,image:{...body.image,base64:output.toString("base64")}}),deps)).status,400);assert.equal(calls,0);
 const response=await handleReviewWorkspace(f.request(body),deps);assert.equal(response.status,200);assert.equal(calls,1);
 const result=await response.json();assert.equal(verifyReviewImage(output,"submission",result.draft.receipt,"test-secret"),true);
 assert.equal(f.sub.after_image_base64,null);assert.equal(f.sub.before_image_base64,source.toString("base64"));
});

test("published HTML uses private durable storage and unguessable view keys",async()=>{
 const {savePublishedReport,readPublishedReport,REPORT_HEADERS}=await import("../../lib/review-workspace/published.ts");
 const calls:{url:string;init:RequestInit}[]=[];
 const env={NEXT_PUBLIC_SUPABASE_URL:"https://example.supabase.co",SUPABASE_SERVICE_ROLE_KEY:"test-secret"};
 const fetchImpl=(async(url:unknown,init:RequestInit={})=>{calls.push({url:String(url),init});return new Response(String(url).includes("authenticated")?"<html>saved</html>":"{}",{status:200});}) as typeof fetch;
 const key=await savePublishedReport("<html>saved</html>",{env,fetchImpl});assert.match(key,/^[a-f0-9]{64}$/);
 assert.equal(JSON.parse(String(calls[0].init.body)).public,false);assert.equal(calls[1].init.body,"<html>saved</html>");
 assert.equal(await readPublishedReport(key,{env,fetchImpl}),"<html>saved</html>");assert.equal(await readPublishedReport("../secret",{env,fetchImpl}),null);
 assert.match(REPORT_HEADERS["Content-Security-Policy"],/sandbox allow-scripts/);assert.match(REPORT_HEADERS["X-Robots-Tag"],/noindex/);
 await assert.rejects(savePublishedReport("x",{env,fetchImpl:(async()=>new Response("{}",{status:403})) as typeof fetch}));
});
test("publishing validates the detailed review and excludes arbitrary image bytes",async()=>{
 const {sub,deps}=fixture();let saved="";
 const reviewed={summary:"Visible original evidence.",priorities:[],findings:[]};
 const request=(versions:unknown[],active=-1)=>new Request("https://moga.test/api/review-workspace?id=submission",{method:"POST",headers:{origin:"https://moga.test",authorization:"Bearer token"},body:JSON.stringify({action:"publish",review:reviewed,versions,active})});
 const response=await handleReviewWorkspace(request([]),{...deps,saveReport:async html=>{saved=html;return "a".repeat(64);}});
 assert.equal(response.status,200);assert.match((await response.json()).url,/\/reports\/[a-f0-9]{64}\.html$/);assert.match(saved,/169 aesthetic assessments/);
 const bad=await handleReviewWorkspace(request([{label:"Injected",notes:"",targets:[],image:{base64:"aGVsbG8=",mime:"image/png",receipt:"forged"}}],0),deps);assert.equal(bad.status,400);
});
test("active delivery prepares web reports without PDF rendering or attachments",async()=>{
 const {readFile}=await import("node:fs/promises");
 for(const path of ["../../lib/submissions/processOne.ts","../../app/api/submission-report/route.ts"]){const source=await readFile(new URL(path,import.meta.url),"utf8");assert.doesNotMatch(source,/generatePdfReport|sendReportEmail|application\/pdf/);}
});
