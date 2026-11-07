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
 const {deps}=fixture();let saved="";
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

test("portal export has reachable report pages, all 169 findings and executable offline navigation",async()=>{
 const {Script}=await import("node:vm");
 const image={mime:"image/png",base64:"aGVsbG8=",receipt:"NEVER_EXPORT_THIS"};
 const html=exportReviewHtml("Private person",image,null,[],-1);
 const pageIds=[...html.matchAll(/<article id="page-([^"]+)" data-report-page/g)].map(m=>m[1]);
 assert.equal(new Set(pageIds).size,pageIds.length);assert.equal(pageIds.length,22);
 for(const match of html.split("<script")[0].matchAll(/data-page="([^"]+)"/g))assert.ok(pageIds.includes(match[1]),match[1]);
 assert.equal([...html.matchAll(/<tr data-catalog-row /g)].length,169);
 assert.ok(pageIds.includes("proportions")&&pageIds.includes("feature-lips")&&pageIds.includes("protocol"));
 const executable=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];assert.equal(executable.length,1);assert.doesNotThrow(()=>new Script(executable[0][1]));
 assert.doesNotMatch(html,/NEVER_EXPORT_THIS|https?:\/\/[^"\s<]+\.(?:png|jpg|jpeg)/);
 assert.match(html,/role="tablist"/);assert.match(html,/<dialog class="mobile-nav"/);
});
test("portal does not transfer reference scores or turn model prose into executable markup",()=>{
 const image={mime:"image/png",base64:"aGVsbG8=",receipt:"NO"};
 const review={summary:'</script><script>alert("unsafe")</script>',priorities:['<img src=x onerror="bad">'],findings:[]};
 const html=exportReviewHtml("<unsafe>",image,review,[],-1);
 assert.match(html,/&lt;\/script&gt;/);assert.match(html,/&lt;unsafe&gt;/);assert.doesNotMatch(html,/<script>alert|<img src=x/);
 assert.doesNotMatch(html,/score-number[^>]*>\s*(78|88)/);assert.match(html,/No reference score assigned/);
 const data=JSON.parse(/<script type="application\/json" id="portal-assets">([\s\S]*?)<\/script>/.exec(html)![1]);
 assert.deepEqual(Object.keys(data),["original"]);assert.equal(data.original,"data:image/png;base64,aGVsbG8=");
});

test("real submissions render without demo illustrations, fixed crops or generic masks",async()=>{
 const {prepareReportDisplay}=await import("../../lib/review-workspace/display.server.ts");
 const sharp=(await import("sharp")).default;
 const source=await sharp({create:{width:800,height:400,channels:3,background:"#9c735c"}}).jpeg().toBuffer();
 const geometry={face:{cx:.7,cy:.6,rx:.17,ry:.3},hair:{cx:.7,cy:.22,rx:.2,ry:.18},protected:[{cx:.64,cy:.45,rx:.04,ry:.05},{cx:.76,cy:.45,rx:.04,ry:.05},{cx:.7,cy:.6,rx:.04,ry:.1},{cx:.7,cy:.78,rx:.07,ry:.04},{cx:.7,cy:.32,rx:.1,ry:.02}]};
 const display=await prepareReportDisplay(source.toString("base64"),geometry);
 assert.ok(display.portrait);assert.ok(display.features.eyes&&display.features.lips);
 const eyes=await sharp(Buffer.from(display.features.eyes.base64,"base64")).metadata();
 const lips=await sharp(Buffer.from(display.features.lips.base64,"base64")).metadata();
 assert.notEqual(eyes.width! / eyes.height!,lips.width! / lips.height!);
 const image={mime:"image/jpeg",base64:source.toString("base64"),receipt:"private"};
 const html=exportReviewHtml("Real submission",image,null,[],-1,{sidePhotos:[],videoSummary:"",display});
 assert.doesNotMatch(html,/masked-portrait|clip-path:polygon|data-photo-bg|Hyper feminine|Hyper masculine/);
 assert.match(html,/data-photo="display-portrait"/);
 const page=(output:string,category:string)=>output.split(`id="page-feature-${category}"`)[1].split('<article id="page-')[0];
 for(const category of ["eyebrows","eyes","nose","lips","neck"]){
  assert.match(page(html,category),new RegExp(`data-photo="feature-${category}"`));
  assert.doesNotMatch(page(html,category),/data-photo="display-portrait"/);
 }
 assert.match(page(html,"ears"),/Ears detail unavailable/);
 assert.doesNotMatch(page(html,"ears"),/<img/);
 const withOblique=exportReviewHtml("Real submission",image,null,[],-1,{sidePhotos:[{...image,label:"Left oblique — original"}],videoSummary:"",display});
 assert.match(page(withOblique,"ears"),/data-photo="side-0"/);
 assert.match(page(withOblique,"ears"),/ear context/);
 assert.deepEqual(await prepareReportDisplay(source.toString("base64"),undefined),{features:{}});
 assert.deepEqual(await prepareReportDisplay("invalid",geometry),{features:{}});
});

test("existing saved reports receive the crop repair without altering their evidence",async()=>{
 const {repairLegacyReportDisplay}=await import("../../lib/review-workspace/legacyDisplay.ts");
 const legacy='<head></head><img class="masked-portrait" data-photo="original"><script>const evidence="unchanged"</script>';
 const fixed=repairLegacyReportDisplay(legacy);
 assert.match(fixed,/clip-path:none!important/);assert.match(fixed,/const evidence="unchanged"/);
 const current='<head></head><img data-photo="original">';assert.equal(repairLegacyReportDisplay(current),current);
});


test("provider reviews must address all 169 correctly identified features rather than 13 categories",async()=>{
 const {parseProviderDetailedReview,DETAILED_REVIEW_RESPONSE_FORMAT}=await import("../../lib/review-workspace/generate.server.ts");
 const review={summary:"Visible original features.",priorities:["Discuss skin texture and hair framing."],findings:REVIEW_ITEMS.map(i=>({id:i.id,feature:i.label,observation:"The original view does not establish this specific relationship.",confidence:"not_assessable",source:"none"}))};
 assert.equal(parseProviderDetailedReview(review).findings.length,169);
 assert.throws(()=>parseProviderDetailedReview({...review,findings:review.findings.slice(0,13)}),/assessment_incomplete/);
 assert.throws(()=>parseProviderDetailedReview({...review,findings:review.findings.map((f,i)=>i===0?{...f,feature:"Different catalog item"}:f)}),/assessment_incomplete/);
 assert.equal(DETAILED_REVIEW_RESPONSE_FORMAT.json_schema.strict,true);
 assert.equal(DETAILED_REVIEW_RESPONSE_FORMAT.json_schema.schema.properties.findings.minItems,169);
});
