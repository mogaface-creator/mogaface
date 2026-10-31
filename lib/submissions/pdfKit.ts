import { rgb, type PDFFont } from "pdf-lib";
import sharp from "sharp";
import type { PortraitGeometry } from "../image-generation/portraitGeometry.ts";
/** Shared PDF helpers: page metrics, palette, text wrapping and face-following photo crops. */
export type CropRegion="portrait"|"hair"|"eyes"|"jaw"|"skin";
export const W=595.28,H=841.89,M=45,CW=W-2*M;
export const hex=(s:string)=>rgb(parseInt(s.slice(1,3),16)/255,parseInt(s.slice(3,5),16)/255,parseInt(s.slice(5,7),16)/255);
export const C={ink:hex("#29212f"),plum:hex("#39244f"),accent:hex("#987748"),muted:hex("#766e7a"),line:hex("#e3dce7"),pale:hex("#f4f0f5"),paleText:hex("#cfc5d9"),white:rgb(1,1,1)};
export const clean=(s:string)=>s.replace(/[\u2010-\u2015]/g,"-").replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"').replace(/[^\x20-\x7e\n]/g," ");
export function wrap(text:string,font:PDFFont,size:number,width:number):string[]{
 return clean(text).split("\n").flatMap(part=>{const lines:string[]=[];let line="";for(const word of part.split(/\s+/).filter(Boolean)){if(font.widthOfTextAtSize((line?line+" ":"")+word,size)>width && line){lines.push(line);line="";} if(font.widthOfTextAtSize(word,size)>width){if(line){lines.push(line);line="";}let chunk="";for(const ch of word){if(font.widthOfTextAtSize(chunk+ch,size)>width){lines.push(chunk);chunk="";}chunk+=ch;}line=chunk;}else line+=(line?" ":"")+word;}if(line)lines.push(line);return lines.length?lines:[""];});
}
type Box=[number,number,number,number];
/** Fixed fractions only as a fallback; with face geometry the crop follows the real face position. */
function cropBox(region:CropRegion|undefined,g:PortraitGeometry|null|undefined):Box|null{
 if(!region)return null;
 if(!g){return region==="portrait"?null:({hair:[0.02,0.04,0.96,0.36],eyes:[0.15,0.25,0.72,0.27],jaw:[0.16,0.48,0.74,0.43],skin:[0.2,0.36,0.62,0.32]} as const)[region] as unknown as Box;}
 const {face:f,hair:hr}=g;const span=(cx:number,rx:number,cy:number,top:number,bottom:number):Box=>[cx-rx,cy+top,2*rx,bottom-top];
 if(region==="portrait")return [f.cx-f.rx*1.9,f.cy-f.ry*1.9,f.rx*3.8,f.ry*3.8];
 if(region==="hair")return [hr.cx-hr.rx,hr.cy-hr.ry,2*hr.rx,(f.cy-f.ry*0.5)-(hr.cy-hr.ry)];
 if(region==="eyes")return span(f.cx,f.rx*1.05,f.cy,-f.ry*0.6,f.ry*0.2);
 if(region==="skin")return span(f.cx,f.rx*0.95,f.cy,-f.ry*0.45,f.ry*0.5);
 return span(f.cx,f.rx*1.05,f.cy,f.ry*0.1,f.ry*1.15);
}
export async function jpeg(bytes:Buffer|Uint8Array,targetAspect:number,region?:CropRegion,geometry?:PortraitGeometry|null){
 const oriented=await sharp(Buffer.from(bytes)).rotate().toBuffer();const meta=await sharp(oriented).metadata();const w=meta.width!,h=meta.height!;
 let image=sharp(oriented);
 const box=cropBox(region,geometry);
 if(box){
  // Widen the box to the target aspect around its centre, then clamp it inside the image.
  let [x,y,bw,bh]=box;const aspect=(bw*w)/(bh*h);
  if(aspect<targetAspect){const nw=bw*targetAspect/aspect;x-=(nw-bw)/2;bw=nw;}else{const nh=bh*aspect/targetAspect;y-=(nh-bh)/2;bh=nh;}
  bw=Math.min(bw,1);bh=Math.min(bh,1);x=Math.max(0,Math.min(1-bw,x));y=Math.max(0,Math.min(1-bh,y));
  image=image.extract({left:Math.floor(w*x),top:Math.floor(h*y),width:Math.max(1,Math.floor(w*bw)),height:Math.max(1,Math.floor(h*bh))});
 }
 const width=1400,height=Math.max(1,Math.round(width/targetAspect));
 return image.resize({width,height,fit:"cover",position:geometry?"centre":"attention"}).jpeg({quality:88}).toBuffer();
}
