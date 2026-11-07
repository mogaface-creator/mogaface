import sharp from "sharp";
import {validPortraitGeometry,type Ellipse,type PortraitGeometry} from "../image-generation/portraitGeometry.ts";
export interface DisplayPhoto {mime:string;base64:string}
export interface ReportDisplay {portrait?:DisplayPhoto;features:Record<string,DisplayPhoto>}
/** Rectangular crops of this submission's pixels. Never a generic silhouette or fixed selfie coordinates. */
export async function prepareReportDisplay(base64:string,geometry:PortraitGeometry|undefined):Promise<ReportDisplay>{
 const empty:ReportDisplay={features:{}};
 if(!validPortraitGeometry(geometry))return empty;
 try{
  const bytes=Buffer.from(base64,"base64");
  const oriented=await sharp(bytes).rotate().toBuffer();
  const meta=await sharp(oriented).metadata();if(!meta.width||!meta.height)return empty;
  const width=meta.width,height=meta.height;
  const union=(regions:Ellipse[],padding=.12)=>{const left=Math.min(...regions.map(e=>e.cx-e.rx)),top=Math.min(...regions.map(e=>e.cy-e.ry)),right=Math.max(...regions.map(e=>e.cx+e.rx)),bottom=Math.max(...regions.map(e=>e.cy+e.ry));return {cx:(left+right)/2,cy:(top+bottom)/2,rx:(right-left)*(1+padding)/2,ry:(bottom-top)*(1+padding)/2};};
  const extract=async(e:Ellipse,size:number):Promise<DisplayPhoto>=>{const left=Math.max(0,Math.min(width-1,Math.floor((e.cx-e.rx)*width))),top=Math.max(0,Math.min(height-1,Math.floor((e.cy-e.ry)*height)));const right=Math.max(left+1,Math.min(width,Math.ceil((e.cx+e.rx)*width))),bottom=Math.max(top+1,Math.min(height,Math.ceil((e.cy+e.ry)*height)));return {mime:"image/webp",base64:(await sharp(oriented).extract({left,top,width:right-left,height:bottom-top}).resize({width:size,height:size,fit:"inside",withoutEnlargement:true}).webp({quality:85}).toBuffer()).toString("base64")};};
  const face=geometry.face,eyes=geometry.protected.slice(0,2),nose=geometry.protected[2],lips=geometry.protected[3];
  const regions:Record<string,Ellipse>={eyes:union(eyes),eyebrows:union(eyes.map(e=>({...e,cy:e.cy-e.ry*.35,ry:e.ry*.65}))),nose,lips,smile:{...lips,rx:lips.rx*1.3,ry:lips.ry*1.4},hair:geometry.hair,"general-analysis":face,cheeks:{...face,cy:face.cy+face.ry*.13,ry:face.ry*.4},jaw:{...face,cy:face.cy+face.ry*.62,ry:face.ry*.4},chin:geometry.refinements?.chin_projection?.[0]||{...face,cy:face.cy+face.ry*.8,rx:face.rx*.4,ry:face.ry*.22},skin:face};
  // Include the jaw-to-neck transition and the area below it when the frame reaches far enough.
  const neckTop=face.cy+face.ry*.83;
  const neckBottom=Math.min(1,face.cy+face.ry*1.82);
  if(neckBottom-neckTop>=face.ry*.35){
   regions.neck={cx:face.cx,cy:(neckTop+neckBottom)/2,rx:face.rx*.94,ry:(neckBottom-neckTop)/2};
  }
  const entries=await Promise.all(Object.entries(regions).map(async([key,e])=>[key,await extract(e,360)] as const));
  return {portrait:await extract(union([face,geometry.hair],.18),850),features:Object.fromEntries(entries)};
 }catch{return empty;}
}
