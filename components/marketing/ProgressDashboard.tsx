"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import "./progress-dashboard.css";

const METRICS = [
 {name:"Skin texture",values:[54,59,65,70],status:"Improving"},
 {name:"Brow definition",values:[62,64,68,72],status:"Balanced"},
 {name:"Facial symmetry",values:[76,76,77,77],status:"Stable"},
 {name:"Tone consistency",values:[57,61,66,71],status:"Improving"},
 {name:"Feature balance",values:[70,71,72,73],status:"Balanced"},
 {name:"Hair appearance",values:[60,64,68,72],status:"Improving"},
];
const TREND=[58,64,71,77];
const MONTHS=["Baseline","Month 1","Month 2","Month 3"];

function sampleValue(values:number[], position:number) {
 const start=Math.floor(position);const end=Math.min(3,start+1);
 return Math.round(values[start]+(values[end]-values[start])*(position-start));
}

function MetricCard({index,month}:{index:number;month:number}){
 const metric=METRICS[index];const value=sampleValue(metric.values,month);
 return <article className="progress-metric"><div className="progress-metric-body"><div><h3>{metric.name}</h3><span>{metric.status}</span></div><p>{value}<small> / 100</small></p></div><div className="progress-meter" aria-label={`Example ${metric.name}: ${value} out of 100`}><span style={{left:`${value}%`}}><i/>Example</span></div><div className="progress-meter-labels"><span>0</span><span>100</span></div></article>;
}

export function ProgressDashboard(){
 const [month,setMonth]=useState(0);
 const grid=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  const node=grid.current;if(!node)return;
  const reduced=window.matchMedia("(prefers-reduced-motion: reduce)");
  let frame=0;
  const update=()=>{
   frame=0;if(reduced.matches)return;
   const rect=node.getBoundingClientRect();
   const distance=window.innerHeight*.65+rect.height*.35;
   const progress=Math.max(0,Math.min(1,(window.innerHeight*.8-rect.top)/distance));
   setMonth(progress*3);
  };
  const schedule=()=>{if(!frame)frame=requestAnimationFrame(update);};
  update();window.addEventListener("scroll",schedule,{passive:true});window.addEventListener("resize",schedule);reduced.addEventListener("change",schedule);
  return ()=>{cancelAnimationFrame(frame);window.removeEventListener("scroll",schedule);window.removeEventListener("resize",schedule);reduced.removeEventListener("change",schedule);};
 },[]);
 const value=sampleValue(TREND,month);const label=MONTHS[Math.round(month)];
 const start=Math.floor(month),end=Math.min(3,start+1);
 const exactValue=TREND[start]+(TREND[end]-TREND[start])*(month-start);
 const x=44+month*100;const y=252-exactValue*2;
 return <section id="your-progress" className="progress-dashboard" aria-labelledby="progress-heading"><header className="progress-heading"><span>Your biometrics</span><h2 id="progress-heading">Track your progress<br/><em>Explore what changes</em></h2><p>Compare your photos and report insights over time.<br/>Scroll through this sample dashboard to explore the timeline.</p></header>
 <div className="progress-grid" ref={grid}><div className="progress-metric-column">{[0,1,2].map(i=><MetricCard index={i} month={month} key={i}/>)}</div>
 <div className="progress-center"><div className="progress-portrait"><Image src="/images/transformations/female_studio_cutout.png" fill alt="Illustrative portrait in a sample progress dashboard" sizes="(max-width: 800px) 90vw, 35vw"/><div><span>Appearance overview</span><strong>{value}<small> PTS</small></strong><p>Example score · {label}</p></div></div>
 <div className="progress-chart"><div className="progress-chart-key"><span><i/>Example progress</span><span><i/>Baseline reference</span></div><svg viewBox="0 0 380 285" role="img" aria-label={`Illustrative progress chart. ${label}: ${value} points. Baseline: 58 points.`}><defs><linearGradient id="progress-area" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#9aaeb5" stopOpacity=".25"/><stop offset="1" stopColor="#9aaeb5" stopOpacity="0"/></linearGradient></defs>{[20,40,60,80,100].map(v=><g key={v}><path d={`M44 ${252-v*2}H350`} stroke="currentColor" opacity=".12"/><text x="13" y={256-v*2}>{v}</text></g>)}<path d="M44 136L144 124L244 110L344 98V252H44Z" fill="url(#progress-area)"/><path d="M44 136H344" stroke="#c5d3d8" strokeDasharray="4 5"/><path d="M44 136L144 124L244 110L344 98" stroke="#7e9ba6" strokeWidth="2" fill="none"/><path d={`M${x} 42V252`} stroke="#9aaeb5" strokeDasharray="2 4"/><circle cx={x} cy={y} r="10" fill="#9aaeb5" opacity=".2"/><circle cx={x} cy={y} r="5" fill="#5d767e" stroke="white" strokeWidth="2"/>{MONTHS.map((label,i)=><text key={label} x={44+i*100} y="274" textAnchor="middle">{i===0?"Start":`M${i}`}</text>)}</svg>
 <label className="progress-timeline">Scroll to explore <output>{label}</output><input aria-label="Explore sample timeline" type="range" min="0" max="3" step="0.01" value={month} aria-valuetext={label} onChange={e=>setMonth(Number(e.target.value))}/></label></div></div>
 <div className="progress-metric-column">{[3,4,5].map(i=><MetricCard index={i} month={month} key={i}/>)}</div></div>
 <p className="progress-example-note">Interactive example with fictional values. These are not measured scores, treatment results, or predictions.</p></section>;
}
