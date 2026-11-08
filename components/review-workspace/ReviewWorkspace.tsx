"use client";
import {useEffect,useRef,useState} from "react";
import Image from "next/image";
import Link from "next/link";
import {List, X, CaretRight, Scan, Sparkle, LinkSimple} from "@phosphor-icons/react";
import type {ReportDisplay} from "@/lib/review-workspace/display.server.ts";
import { BeforeAfterSlider } from "./BeforeAfterSlider";
import styles from "./ReviewWorkspace.module.css";
import {useSearchParams} from "next/navigation";
import {ASSESSMENT_CATEGORIES} from "@/lib/assessment/aestheticCatalog.ts";
import {REVIEW_ITEMS,REVISION_TARGETS,type DetailedReview,type ReviewImage,type RevisionTarget,featurePhotoGuidance} from "@/lib/review-workspace/types.ts";
import {type ExportVersion} from "@/lib/review-workspace/export.ts";
export interface WorkspaceData {reportPath?:string|null;display?:ReportDisplay;review?:DetailedReview|null;wantsPreview?:boolean;needsPreparation?:boolean;needsAssessmentConsent?:boolean;canRetry?:boolean;previewStatus?:string;suggestedTargets:RevisionTarget[];name:string;original:ReviewImage;initial:ReviewImage|null;consent:boolean;canRefine:boolean;sidePhotos:{label:string;mime:string;base64:string}[];video:{summary:string};status:string}
const initialVersion=(image:ReviewImage):ExportVersion=>({image,label:"First AI illustration",targets:[],notes:"Automatically prepared from your original photo and assessment preferences."});
interface Draft {image:ReviewImage;targets:string[];notes:string}
const src=(image:Pick<ReviewImage,"mime"|"base64">)=>`data:${image.mime};base64,${image.base64}`;
const errors:Record<string,string>={preview_only:"This local preview is read-only. Your private review supports assessment and image generation.",photo_consent_required:"AI photo processing was declined for this submission. A new consented assessment is needed before AI review or editing.",session_limit:"This session has reached its AI request limit. Accepted work remains available to export.",unauthorized:"This private report needs the browser session used to submit it. Open it in that browser or start a new assessment.",not_found:"This submission or its original photo is unavailable.",geometry_unavailable:"This older submission lacks usable facial geometry for safe local edits. You can still read and export the report.",unapproved_source:"The selected image receipt has expired or does not match. Reopen the workspace to obtain a fresh source.",revision_not_approved:"This draft did not pass automated quality review. Your accepted version is unchanged. Try a smaller, more specific refinement.",too_large:"This image is too large for an interactive revision. Your accepted version remains available to export.",assessment_incomplete:"The detailed assessment was incomplete. No findings were invented; please retry.",workspace_unavailable:"The workspace could not complete this request. Your accepted version is unchanged. Please retry shortly."};
function Photo({image,alt}:{image:Pick<ReviewImage,"mime"|"base64">;alt:string}){return <Image unoptimized src={src(image)} alt={alt} width={1000} height={1333} className={styles.photo}/>;}
export function ReviewWorkspace({previewData,previewReview}:{previewData?:WorkspaceData;previewReview?:DetailedReview}){const id=useSearchParams().get("id");return <ReviewWorkspaceSession key={id||"missing"} id={id} previewData={previewData} previewReview={previewReview}/>;}
function ReviewWorkspaceSession({id,previewData,previewReview}:{id:string|null;previewData?:WorkspaceData;previewReview?:DetailedReview}){
 const token=useRef("");
 const [page,setPage]=useState("comparison"),[mobileOpen,setMobileOpen]=useState(false);
 const [openGroup,setOpenGroup]=useState("protocol");
 const go=(key:string)=>{setPage(key);setMobileOpen(false);window.scrollTo({top:0,behavior:"instant"});};
 const [data,setData]=useState<WorkspaceData|null>(previewData||null),[error,setError]=useState(""),[busy,setBusy]=useState<"loading"|"generating"|"publishing"|null>(previewData?null:"loading");
 const [review,setReview]=useState<DetailedReview|null>(previewReview||null),[versions,setVersions]=useState<ExportVersion[]>(()=>previewData?.initial?[initialVersion(previewData.initial)]:[]),[active,setActive]=useState(previewData?.initial?0:-1),[draft,setDraft]=useState<Draft|null>(null);
 const [targets,setTargets]=useState<RevisionTarget[]>([]),[notes,setNotes]=useState(""),[query,setQuery]=useState(""),[confidence,setConfidence]=useState("");
 const requestLock=useRef(false);
 const [baselineLink,setBaselineLink]=useState("");
 const [updatedLink,setUpdatedLink]=useState("");
 const [linkStatus,setLinkStatus]=useState<"loading"|"error"|null>(null);
 const [shareMessage,setShareMessage]=useState("");
 const [linkAttempt,setLinkAttempt]=useState(0);
 const [preparing,setPreparing]=useState(false);
 const [attempt,setAttempt]=useState(0);
 const allowAssessment=useRef(false);
 const requestedRetry=useRef(false);
 const initialAdded=useRef(!!previewData?.initial);
 useEffect(()=>{
  if(previewData)return;
  const controller=new AbortController();
  const shouldRetry=requestedRetry.current;
  requestedRetry.current=false;
  const endpoint=`/api/review-workspace?id=${encodeURIComponent(id||"")}`;
  const headers={Authorization:""};
  async function readWorkspace():Promise<WorkspaceData>{
   const response=await fetch(endpoint,{headers,cache:"no-store",signal:controller.signal});
   const result=await response.json();
   if(!response.ok)throw new Error(result.error);
   return result;
  }
  function apply(next:WorkspaceData){
   if(controller.signal.aborted)return;
   setData(next);
   setReview(next.review||null);
   setTargets(next.suggestedTargets||[]);
   if(next.initial&&!initialAdded.current){
    initialAdded.current=true;
    setVersions([initialVersion(next.initial)]);
    setActive(0);
   }
   setBusy(null);
   if (next.reportPath) {
    setBaselineLink(new URL(next.reportPath, window.location.origin).href);
    setLinkStatus(null);
   } else if (next.review && next.status === "done") {
    setLinkStatus("loading");
    void fetch(endpoint, {
     method: "POST",
     headers: { ...headers, "Content-Type": "application/json" },
     body: JSON.stringify({ action: "publish_initial" }),
     signal: AbortSignal.any([controller.signal, AbortSignal.timeout(65_000)]),
    }).then(async response => {
     if (!response.ok) throw new Error("report_storage_unavailable");
     const { url } = await response.json();
     if (!controller.signal.aborted) {
      setBaselineLink(url);
      setLinkStatus(null);
     }
    }).catch(() => {
     if (!controller.signal.aborted) setLinkStatus("error");
    });
   }
  }
  async function load(){
   await Promise.resolve();
   if(controller.signal.aborted)return;
   try{
    if(!id)throw new Error("no_submission");
    token.current=sessionStorage.getItem(`mogaface:report:${id}`)||"";
    if(!token.current)throw new Error("unauthorized");
    headers.Authorization=`Bearer ${token.current}`;
    let next=await readWorkspace();
    apply(next);
    if(next.needsPreparation||(shouldRetry&&next.canRetry&&(!next.needsAssessmentConsent||allowAssessment.current))){
     setPreparing(true);
     const response=await fetch(endpoint,{method:"POST",headers:{...headers,"Content-Type":"application/json"},body:JSON.stringify({action:"prepare",allowAssessment:allowAssessment.current}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(175_000)])});
     if(!response.ok)throw new Error((await response.json()).error);
     next=await readWorkspace();
     apply(next);
    }
    if(next.status==="pending"||next.status==="processing"){
     setPreparing(true);
     for(let poll=0;poll<90&&!controller.signal.aborted;poll++){
      await new Promise(resolve=>setTimeout(resolve,4000));
      if(controller.signal.aborted)return;
      const response=await fetch(`/api/check-submission-status?id=${encodeURIComponent(id)}`,{cache:"no-store",signal:controller.signal});
      if(!response.ok)throw new Error("status_unavailable");
      const status=(await response.json()).status;
      if(status==="done"||status==="failed"){
       apply(await readWorkspace());
       return;
      }
     }
     throw new Error("status_unavailable");
    }
   }catch(e){
    if(controller.signal.aborted)return;
    const code=e instanceof Error?e.message:"";
    setError(code==="no_submission"?"No submission was selected. Start from your assessment results.":errors[code]||"We could not load the latest report status. Try checking again.");
    setBusy(null);
   }finally{if(!controller.signal.aborted)setPreparing(false);}
  }
  void load();
  return()=>controller.abort();
 },[id,previewData,attempt,linkAttempt]);
 const retry=()=>{requestedRetry.current=true;setError("");setPreparing(true);setAttempt(value=>value+1);};
 const approveAssessment=()=>{allowAssessment.current=true;retry();};
 const post=async(body:unknown)=>{if(previewData)throw new Error("preview_only");const response=await fetch(`/api/review-workspace?id=${encodeURIComponent(id||"")}`,{method:"POST",headers:{Authorization:`Bearer ${token.current}`,"Content-Type":"application/json"},body:JSON.stringify(body),signal:AbortSignal.timeout(175000)});const result=await response.json();if(!response.ok)throw new Error(result.error);return result;};
 const generate=async()=>{if(!data||!targets.length||requestLock.current)return;requestLock.current=true;setBusy("generating");setError("");try{const result=await post({action:"refine",targets,notes,image:active<0?data.original:versions[active].image});setDraft({image:result.draft,targets:result.targets,notes:result.notes});}catch(e){setError(errors[e instanceof Error?e.message:""]||errors.workspace_unavailable);}finally{setBusy(null);requestLock.current=false;}};
 const accept=()=>{if(!draft||busy)return;const v={...draft,label:`Accepted concept ${versions.length+1}`};setVersions(old=>[...old,v]);setActive(versions.length);setDraft(null);setTargets([]);setNotes("");};
 const publish=async()=>{if(!data||!review||requestLock.current)return;requestLock.current=true;setBusy("publishing");setError("");try{const r=await post({action:"publish",review,versions:versions.map(version=>version.image.base64===data.initial?.base64?{...version,image:undefined,initial:true}:version),active});setUpdatedLink(r.url+"#protocol");setShareMessage("");}catch(e){setError(errors[e instanceof Error?e.message:""]||errors.workspace_unavailable);}finally{setBusy(null);requestLock.current=false;}};
 const current=active<0?null:versions[active];
 const reportLink=updatedLink||baselineLink;
 async function shareReport(copyOnly=false) {
  try {
   if (!copyOnly && navigator.share) {
    await navigator.share({ title: "Moga appearance report", url: reportLink });
    return;
   }
   await navigator.clipboard.writeText(reportLink);
   setShareMessage("Link copied.");
  } catch (error) {
   if (!(error instanceof DOMException && error.name === "AbortError")) setShareMessage("Select and copy the link below.");
  }
 }
 const sharePanel=(
  <section className={styles.sharePanel} aria-labelledby="share-report-heading">
   <h2 id="share-report-heading">Share your report</h2>
   {reportLink ? <>
    <p>Anyone with this link can view this report and its photos.</p>
    <div className={styles.shareActions}>
     <button className={styles.actionPrimary} onClick={()=>void shareReport()}>Share link</button>
     <button onClick={()=>void shareReport(true)}>Copy link</button>
     <a href={reportLink} target="_blank" rel="noreferrer">Open report</a>
    </div>
    <input className={styles.shareUrl} aria-label="Shareable report link" readOnly value={reportLink} onFocus={event=>event.target.select()} />
    {shareMessage && <p role="status">{shareMessage}</p>}
   </> : <div aria-live="polite">
    <p>{linkStatus==="error"?"The report is ready. The share link could not be created.":review&&!previewData?"Creating your share link…":"Your share link will appear when the detailed report is ready."}</p>
    {linkStatus==="error"&&<button className={styles.textButton} onClick={()=>{setLinkStatus("loading");setLinkAttempt(value=>value+1);}}>Retry share link</button>}
   </div>}
  </section>
 );
 const after=draft?.image||current?.image;
 const working=preparing||(!error&&(data?.status==="processing"||data?.status==="pending"||!!data?.needsPreparation));
 const optionalRefinement=!!current&&!!review&&!!data?.canRefine&&!previewData;
 const previewMessage=data?.previewStatus==="quality_review"?"The illustration did not pass the identity and image quality checks."
  :data?.previewStatus==="geometry_unavailable"?"This photograph did not provide a usable face outline for an illustration."
  :"An illustration could not be prepared for this submission.";

 const visibleFindings=REVIEW_ITEMS.filter(item=>{const f=review?.findings.find(f=>f.id===item.id);return (!query||`${item.label} ${item.category} ${f?.observation||""}`.toLowerCase().includes(query.toLowerCase()))&&(!confidence||(f?.confidence||"not_assessable")===confidence);});
 const category=ASSESSMENT_CATEGORIES.find(c=>c.id===page);
 const items=category?visibleFindings.filter(i=>i.category===category.name):visibleFindings;
 const featureImage=(key:string,label:string)=>{
  const detail=data?.display?.features[key];
  if(detail)return <Photo image={detail} alt={`${label} — original photo detail`}/>;
  if(key==="ears"&&data?.sidePhotos.length)return <div className={styles.sideEvidence}>{data.sidePhotos.map(side=><figure key={side.label}><Photo image={side} alt={side.label}/><figcaption>{side.label} · ear context</figcaption></figure>)}</div>;
  return <div className={styles.missingEvidence}><strong>{label} detail unavailable</strong><p>{featurePhotoGuidance(key)}</p></div>;
 };
 const count=review?.findings.filter(f=>f.confidence!=="not_assessable").length||0;
 const nav=<>
  <div className={styles.navGroup}><button aria-expanded={openGroup==="assessment"} onClick={()=>setOpenGroup(openGroup==="assessment"?"":"assessment")}><CaretRight size={14}/>Facial Assessments</button>{openGroup==="assessment"&&<div className={styles.navLinks}>{[["overview","Feature overview"],["evidence","Original photographs"],["catalog","169 assessments"]].map(([key,label])=><button key={key} aria-current={page===key?"page":undefined} onClick={()=>go(key)}>{label}</button>)}</div>}</div>
  <div className={styles.navGroup}><button aria-expanded={openGroup==="features"} onClick={()=>setOpenGroup(openGroup==="features"?"":"features")}><CaretRight size={14}/>Features Analysis</button>{openGroup==="features"&&<div className={styles.navLinks}>{ASSESSMENT_CATEGORIES.filter(c=>c.id!=="general-analysis").map(c=><button key={c.id} aria-current={page===c.id?"page":undefined} onClick={()=>go(c.id)}>{c.name}</button>)}</div>}</div>
  <div className={styles.navGroup}><button aria-expanded={openGroup==="protocol"} onClick={()=>setOpenGroup(openGroup==="protocol"?"":"protocol")}><CaretRight size={14}/>Protocol</button>{openGroup==="protocol"&&<div className={styles.navLinks}>{[["comparison","Before & after"],["history","Versions & report link"]].map(([key,label])=><button key={key} aria-current={page===key?"page":undefined} onClick={()=>go(key)}>{label}</button>)}</div>}</div>
 </>;
 const findings=(rows:typeof REVIEW_ITEMS)=><div className={styles.findings}>{rows.map(item=>{const f=review?.findings.find(f=>f.id===item.id);return <article className={styles.finding} key={item.id}><header><h3>{item.label}</h3><span>{(f?.confidence||"not_assessable").replaceAll("_"," ")}</span></header><p>{f?.observation||"A finding is unavailable for this feature."}</p><footer>{f?.source&&f.source!=="none"?`Original ${f.source} photograph`:"Evidence unavailable"}<span>Assessment {item.id}</span></footer></article>;})}</div>;
 const legacyConsent=!working&&data?.needsAssessmentConsent&&data.canRetry ? <section className={styles.build}><div><strong>AI permission for this older submission</strong><p>Allow OpenAI to use your original photos and any previously authorized video expression summary for the detailed assessment.</p></div><button onClick={approveAssessment}>Allow AI assessment</button></section> : null;
 const assessmentStatus=review ? <p className={styles.count}>{count} supported observations · {169-count} items need more evidence</p>
  : legacyConsent || <section className={styles.build} aria-live="polite"><div><strong>{working?"Preparing your detailed assessment…":!data?.consent?"Photo review only":"Detailed assessment unavailable"}</strong><p>{working?"Your findings will appear here automatically.":!data?.consent?"AI photo processing was declined for this submission.":"You can still view your original photographs."}</p></div>{!working&&data?.canRetry&&<button onClick={retry}>Retry report</button>}</section>;
 const currentTitle=category?.name||({overview:"Feature overview",evidence:"Original photographs",catalog:"169 assessments",comparison:"Before & after",refine:"Targeted refinements",history:"Versions & report link"}[page]||"Appearance review");
 return <div className={styles.workspace}>
  <header className={styles.mobileHeader} inert={mobileOpen}><button aria-label="Open review navigation" onClick={()=>setMobileOpen(true)}><List size={22}/></button><Link href="/">Moga</Link><span>{currentTitle}</span></header>
  <aside className={styles.primary}><Link className={styles.brand} href="/">Moga</Link><button className={styles.service} onClick={()=>{setOpenGroup("assessment");go("overview");}}><Scan size={24}/>Moga Report</button><button onClick={()=>{setOpenGroup("protocol");go("comparison");}}><Sparkle size={22}/>Before &amp; after</button><button onClick={()=>{setOpenGroup("protocol");go("history");}}><LinkSimple size={22}/>Saved report</button><p className={styles.railNote}>Private appearance review<br/>Original evidence & selected concepts</p></aside>
  <nav className={styles.secondary} aria-label="Review sections">{nav}</nav>
  {mobileOpen&&<div className={styles.scrim} onClick={()=>setMobileOpen(false)}><div className={styles.mobileNav} role="dialog" aria-modal="true" aria-label="Review navigation" onClick={e=>e.stopPropagation()} onKeyDown={e=>{if(e.key==="Escape")setMobileOpen(false);if(e.key==="Tab"){const buttons=Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));const first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}}><header><strong>Moga</strong><button aria-label="Close review navigation" onClick={()=>setMobileOpen(false)} autoFocus><X size={22}/></button></header>{nav}</div></div>}
  <main className={styles.main} inert={mobileOpen}>
   {error&&<div role="alert" className={styles.error}>{error}{data&&<button className={styles.textButton} onClick={retry}>Check report status</button>}</div>}
   {busy==="loading"&&<p role="status">Opening your private review…</p>}
   {!data&&busy!=="loading"&&<><h1>Open your private review</h1><Link href="/assessment">Start an assessment</Link></>}
   {data&&<>
    <div className={styles.pageHeading}><p className={styles.eyebrow}>Personal appearance review · {data.name}</p><h1>{page==="overview"?<>An overview of your <span>facial features</span></>:category?<>A closer look at your <span>{category.name.toLowerCase()}</span></>:currentTitle}</h1><p>{category?category.method:page==="overview"?"Understand each feature, explore a natural after-image, and refine the details you choose.":"Your original evidence and accepted concepts, together in one review."}</p></div>
    {page==="comparison"&&legacyConsent}
    {(page==="overview"||page==="catalog"||category)&&assessmentStatus}
    {page==="overview"&&<>
     <div className={styles.overview}><figure className={styles.portrait}><Photo image={data.display?.portrait||data.original} alt="Original submitted photograph"/><figcaption>Original photograph · assessment evidence</figcaption></figure><div className={styles.overviewSide}><section className={styles.panel}><p className={styles.eyebrow}>Your assessment</p><h2>{review?"What stands out":"Start with your original photographs"}</h2><p>{review?.summary||"The assessment uses your original photographs and the views available for each feature."}</p></section><section className={styles.panel}><p className={styles.eyebrow}>Refinement priorities</p>{review?.priorities.length?<ol>{review.priorities.map((p,i)=><li key={i}>{p}</li>)}</ol>:<p>Priorities appear when your assessment is ready.</p>}<button onClick={()=>{setOpenGroup("protocol");go("comparison");}} className={styles.textButton}>Explore before & after <CaretRight size={14}/></button></section></div></div>
     <section className={styles.section}><h2>Your assessment <span>per feature</span></h2><p>Open a feature for its individual observations and original photo detail.</p><div className={styles.featureGrid}>{ASSESSMENT_CATEGORIES.filter(c=>c.id!=="general-analysis").map(c=>{const ids=REVIEW_ITEMS.filter(i=>i.category===c.name).map(i=>i.id);const f=review?.findings.find(f=>ids.includes(f.id)&&f.confidence!=="not_assessable");return <button key={c.id} className={styles.featureCard} onClick={()=>{setOpenGroup("features");go(c.id);}}><header><h3>{c.name}</h3><CaretRight size={16}/></header><div className={styles.featureImage}>{featureImage(c.id,c.name)}</div><div className={styles.featureCopy}><span className={styles.eyebrow}>{f?"Original evidence":review?"More evidence needed":"Assessment pending"}</span><p>{f?.observation||(review?`The available photographs do not establish these ${c.name.toLowerCase()} findings. Open the feature to see the limitations.`:`Explore the ${c.items.length} review items for ${c.name.toLowerCase()}.`)}</p></div></button>;})}</div></section>
    </>}
    {(category||page==="catalog")&&<>
     {category&&<div className={styles.categoryTop}><div className={styles.featureImage}>{featureImage(category.id,category.name)}</div><section className={styles.panel}><p className={styles.eyebrow}>{category.items.length} individual assessments</p><h2>{category.name} in context</h2><p>{category.limits}</p></section></div>}
     <div className={styles.search}><label>Search features<input aria-label="Search features" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Under-eye, lip, chin…"/></label><label>Evidence<select aria-label="Filter evidence" value={confidence} onChange={e=>setConfidence(e.target.value)}><option value="">All evidence levels</option>{["high","moderate","limited","not_assessable"].map(c=><option key={c} value={c}>{c.replaceAll("_"," ")}</option>)}</select></label></div><p className={styles.count} aria-live="polite">{items.length} matching assessments</p>{review&&findings(items)}
    </>}
    {page==="evidence"&&<><div className={styles.imagePair}><figure><Photo image={data.original} alt="Original front photograph"/><figcaption>Original front photograph</figcaption></figure>{data.sidePhotos.map(photo=><figure key={photo.label}><Photo image={photo} alt={photo.label}/><figcaption>{photo.label}</figcaption></figure>)}</div><section className={styles.panel}><h2>Expression video</h2><p>{data.video.summary}</p></section></>}
    {page==="comparison"&&<>
     {after ? <BeforeAfterSlider before={data.original} after={after} draft={!!draft} /> : <>
      <section className={styles.previewStatus} aria-live="polite"><Sparkle size={22}/><div>
       <strong>{working?"Preparing your report":!data.consent||data.wantsPreview===false?"Original photo review":"After-image unavailable"}</strong>
       <p>{working?data.wantsPreview!==false&&data.consent?"Your assessment and first after-image are being prepared together.":"Your report is being prepared.":!data.consent?"AI photo processing was declined for this submission.":data.wantsPreview===false?"This submission requested an original-only report.":previewMessage}</p>
       {!working&&data.canRetry&&!data.needsAssessmentConsent&&<button className={styles.textButton} onClick={retry}>Retry report</button>}
      </div></section>
      <figure className={styles.originalOnly}><Photo image={data.original} alt="Original front photograph"/><figcaption>Original photograph</figcaption></figure>
     </>}
     {after&&<p className={styles.caption}>The after-image is an AI illustration of your appearance preferences.</p>}
     {draft&&<section className={styles.panel}><h2>Review this draft</h2><p>{draft.notes}</p><div className={styles.actions}><button disabled={!!busy} onClick={accept}>Accept into report</button><button disabled={!!busy} onClick={()=>setDraft(null)}>Discard draft</button></div></section>}
     <div className={styles.comparisonActions}><button className={styles.actionPrimary} onClick={()=>{setOpenGroup("assessment");go("overview");}}>View detailed assessment</button>{optionalRefinement&&!draft&&<button className={styles.textButton} onClick={()=>go("refine")}>Optional refinements</button>}</div>
    </>}
    {page==="refine"&&<><div className={styles.categoryTop}><figure className={styles.portrait}><Photo image={current?.image||data.display?.portrait||data.original} alt="Current refinement source"/><figcaption>{current?.label||"Original photograph"}</figcaption></figure><section className={styles.panel}><p className={styles.eyebrow}>Only what changes this round</p><h2>Direct the next refinement</h2><p>Select the regions to change. Approved features outside these regions are preserved.</p>{draft&&<button onClick={()=>go("comparison")}>Review pending draft</button>}<fieldset disabled={!!busy||!!draft||!review||!data.canRefine||!!previewData}><legend>Features to refine</legend><div className={styles.targets}>{REVISION_TARGETS.map(t=><label key={t.key}><input type="checkbox" checked={targets.includes(t.key)} onChange={e=>setTargets(old=>e.target.checked?[...old,t.key]:old.filter(v=>v!==t.key))}/>{t.label}</label>)}</div><label className={styles.notes}>Optional notes<textarea value={notes} maxLength={600} onChange={e=>setNotes(e.target.value)} rows={4} placeholder="Describe the specific changes you want in the selected features."/></label><p className={styles.caption}>{notes.length}/600 characters</p><button onClick={async()=>{await generate();setPage("comparison");}} disabled={!targets.length}>{busy==="generating"?"Preparing a new draft…":"Generate revised illustration"}</button></fieldset>{!data.canRefine&&<p>Local editing is unavailable because consent or usable face geometry is missing.</p>}</section></div></>}
    {page==="comparison"&&(review||working)&&!previewData&&sharePanel}
    {page==="history"&&<>{sharePanel}<section className={styles.panel}><p className={styles.eyebrow}>Accepted versions</p><h2>Keep the result you approve</h2><div className={styles.actions}><button disabled={!!busy||!!draft} aria-pressed={active===-1} onClick={()=>setActive(-1)}>Original only</button>{versions.map((v,i)=><button key={i} disabled={!!busy||!!draft} aria-pressed={active===i} onClick={()=>setActive(i)}>{v.label}</button>)}</div><p>{current?.notes||"No accepted after-image is selected."}</p></section>{(versions.length>1||(data.initial&&active===-1))&&<section className={styles.panel}>
     <h2>Share the selected version</h2>
     <p>Save a separate link for the version selected above.</p>
     <button onClick={publish} disabled={!!busy||working||!review||!!draft||!!previewData}>{busy==="publishing"?"Creating link…":"Create link for this version"}</button>
    </section>}</>}
    <footer className={styles.bottom}><span>Original photographs support the assessment. AI concepts are visual illustrations.</span><span>Moga · Private review</span></footer>
   </>}
  </main>
 {data&&<nav className={styles.mobileTabs} aria-label="Main report views" inert={mobileOpen}>
  <button aria-current={page==="comparison"?"page":undefined} onClick={()=>{setOpenGroup("protocol");go("comparison");}}><Sparkle size={17}/>Before &amp; after</button>
  <button aria-current={page==="overview"||category||page==="catalog"?"page":undefined} onClick={()=>{setOpenGroup("assessment");go("overview");}}><Scan size={17}/>Assessment</button>
  <button aria-current={page==="history"?"page":undefined} onClick={()=>{setOpenGroup("protocol");go("history");}}><LinkSimple size={17}/>Share report</button>
 </nav>}
 </div>;
}
