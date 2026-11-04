"use client";
import { useEffect, useRef, useState } from "react";
import { MAX_VIDEO_BYTES, MAX_VIDEO_DURATION_SEC } from "@/lib/facial-analysis/video/validate";
import type { VideoExpressionAnalysis } from "@/lib/facial-analysis/video/types";

export function OptionalVideoUpload(){
 const [file,setFile]=useState<File|null>(null),[url,setUrl]=useState<string|null>(null),[error,setError]=useState("");
 const [busy,setBusy]=useState(false),[progress,setProgress]=useState({done:0,total:0});
 const [analysis,setAnalysis]=useState<VideoExpressionAnalysis|null>(null);
 const input=useRef<HTMLInputElement>(null);const revision=useRef(0);
 useEffect(()=>()=>{revision.current+=1},[]);
 useEffect(()=>{if(!file){setUrl(null);return;}const next=URL.createObjectURL(file);setUrl(next);return()=>URL.revokeObjectURL(next)},[file]);
 function select(next?:File){revision.current+=1;setAnalysis(null);setError("");if(!next)return;if(!next.type.startsWith("video/")){setError("Choose a video file, such as MP4, MOV or WebM.");return}if(next.size>MAX_VIDEO_BYTES){setError("Choose a video smaller than 200 MB.");return}setFile(next)}
 async function checkVideo(){if(!file||busy)return;const current=++revision.current;setBusy(true);setError("");setAnalysis(null);setProgress({done:0,total:0});try{const {analyzeVideoFile}=await import("@/lib/facial-analysis/video/capture");const result=await analyzeVideoFile(file,{onProgress:(done,total)=>{if(current===revision.current)setProgress({done,total})}});if(current===revision.current)setAnalysis(result)}catch{if(current===revision.current)setError("This video could not be checked. Try another clip.")}finally{if(current===revision.current)setBusy(false)}}
 return <div className="optional-video"><div className="video-heading"><div><span className="visual-eyebrow">OPTIONAL / EXPRESSION VIDEO</span><h3>Add movement to the picture.</h3></div><span className="video-optional-badge">Optional</span></div><p>Upload a short clip: neutral face, raise your eyebrows, frown, smile, then squint. Up to {MAX_VIDEO_DURATION_SEC} seconds · 200 MB.</p><input ref={input} type="file" accept="video/*" aria-label="Upload optional expression video" disabled={busy} onChange={e=>{select(e.target.files?.[0]);e.target.value=""}} className="sr-only"/>
 {url?<div className="video-preview"><video src={url} controls playsInline preload="metadata" aria-label="Your selected expression video" onError={()=>setError("Your browser cannot play this file. Try an MP4 or WebM clip.")} onLoadedMetadata={e=>{if(e.currentTarget.duration>MAX_VIDEO_DURATION_SEC)setError(`Choose a clip under ${MAX_VIDEO_DURATION_SEC} seconds.`)}}/><div><span>{file?.name}</span><button type="button" disabled={busy} onClick={()=>{revision.current+=1;setFile(null);setAnalysis(null);setError("")}}>Remove video</button></div></div>:<button className="video-dropzone" type="button" onClick={()=>input.current?.click()}><svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true"><rect x="4" y="7" width="17" height="18" rx="4"/><path d="M21 13l7-4v14l-7-4M12 12v8M8 16h8"/></svg><strong>Upload a video</strong><span>MP4, MOV or WebM supported by your browser</span></button>}
 {file&&<button className="moga-pill moga-pill-glass video-check" disabled={busy||!!error} onClick={checkVideo}>{busy?`Checking frames ${progress.done}${progress.total?` / ${progress.total}`:""}…`:"Check video locally"}</button>}
 {error&&<p role="alert" className="video-error">{error}</p>}
 {analysis&&<div className="video-result" role="status"><strong>{analysis.status==="analyzed"?"Video checked":"More usable expression footage is needed"}</strong><p>{analysis.framesUsable} usable frames from {analysis.framesSampled} sampled.</p><ul>{analysis.notes.slice(0,3).map((note,i)=><li key={i}>{note}</li>)}</ul></div>}
 <p className="video-privacy">The clip is checked on your device. This optional check does not change your generated after-image; the portrait photo remains its source.</p>
 </div>
}
