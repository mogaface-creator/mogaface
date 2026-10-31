import { PDFDocument, StandardFonts, PDFString, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import sharp from "sharp";
import type { GeneratePdfReportInput } from "./pdfReport.ts";
import { buildProtocolPages, PROTOCOL_SOURCES, type ProtocolPage } from "./protocolContent.ts";
const W=595.28,H=841.89,M=45,CW=W-2*M;
const hex=(s:string)=>rgb(parseInt(s.slice(1,3),16)/255,parseInt(s.slice(3,5),16)/255,parseInt(s.slice(5,7),16)/255);
const C={ink:hex("#29212f"),plum:hex("#39244f"),accent:hex("#987748"),muted:hex("#766e7a"),line:hex("#e3dce7"),pale:hex("#f4f0f5"),white:rgb(1,1,1)};
const clean=(s:string)=>s.replace(/[\u2010-\u2015]/g,"-").replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"').replace(/[^\x20-\x7e\n]/g," ");
function wrap(text:string,font:PDFFont,size:number,width:number):string[]{
 return clean(text).split("\n").flatMap(part=>{const lines:string[]=[];let line="";for(const word of part.split(/\s+/).filter(Boolean)){if(font.widthOfTextAtSize((line?line+" ":"")+word,size)>width && line){lines.push(line);line="";} if(font.widthOfTextAtSize(word,size)>width){if(line){lines.push(line);line="";}let chunk="";for(const ch of word){if(font.widthOfTextAtSize(chunk+ch,size)>width){lines.push(chunk);chunk="";}chunk+=ch;}line=chunk;}else line+=(line?" ":"")+word;}if(line)lines.push(line);return lines.length?lines:[""];});
}
async function jpeg(bytes:Buffer|Uint8Array,targetAspect:number,region?:ProtocolPage["region"]){
 const oriented=await sharp(Buffer.from(bytes)).rotate().toBuffer();const meta=await sharp(oriented).metadata();const w=meta.width!,h=meta.height!;
 const boxes={hair:[0.02,0.04,0.96,0.36],eyes:[0.15,0.25,0.72,0.27],jaw:[0.16,0.48,0.74,0.43],skin:[0.2,0.36,0.62,0.32]} as const;
 let image=sharp(oriented);
 if(region && region!=="portrait"){const [x,y,bw,bh]=boxes[region];image=image.extract({left:Math.floor(w*x),top:Math.floor(h*y),width:Math.floor(w*bw),height:Math.floor(h*bh)});}
 const width=1400,height=Math.max(1,Math.round(width/targetAspect));
 return image.resize({width,height,fit:"cover",position:"attention"}).jpeg({quality:88}).toBuffer();
}
export async function generateProtocolPdf(input:GeneratePdfReportInput):Promise<Uint8Array>{
 const doc=await PDFDocument.create();const font=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold);
 doc.setTitle(`Next Face - ${clean(input.clientName)} - Personal Appearance Protocol`);doc.setAuthor("Next Face / MogaFace");
 const approved=(input.previewApproved===true || input.previewStatus==="quality_checked") && !!input.afterImageBytes;
 const pages=buildProtocolPages({name:input.clientName,assessment:input.assessment,concerns:input.intakeConcerns,previewApproved:input.previewApproved===true,previewStatus:input.previewStatus,previewMessage:input.previewMessage,reportScopeNote:input.reportScopeNote,analysis:input.analysis,photoViews:1+Number(!!input.leftImageBytes)+Number(!!input.rightImageBytes)});
 if (approved && input.reportSummary.includes("Illustrative before-and-after comparison;")) {
  const comparisons=input.reportSummary.split("\n").filter(line=>/^(hair|skin|jaw|under eye|forehead):/.test(line));
  for(const [index,text] of comparisons.entries()) pages.push({id:`observed-comparison-${index}`,title:"Observed preview comparison",subtitle:"ORIGINAL AND FINAL IMAGE REVIEW",blocks:[{title:text.split(":")[0].toUpperCase(),text}],takeaway:"Automated visual comparison can be mistaken. No diagnosis, measured improvement or achievable treatment outcome is established."});
 }
 const assets=new Map<string,Awaited<ReturnType<typeof doc.embedJpg>>>();
 const embed=async(key:string,bytes:Buffer|Uint8Array,aspect:number,region?:ProtocolPage["region"])=>assets.set(key,await doc.embedJpg(await jpeg(bytes,aspect,region)));
 const coverAspect=225/250,coverPairAspect=((225-8)/2)/250,overviewAspect=((CW-12)/2)/235,pairAspect=((CW-14)/2)/154,detailAspect=CW/154,trioAspect=((CW-16)/3)/154;
 await embed("cover-single",input.beforeImageBytes,coverAspect);await embed("cover-pair",input.beforeImageBytes,coverPairAspect);await embed("overview",input.beforeImageBytes,overviewAspect);
 if(approved){await embed("cover-pair-after",input.afterImageBytes!,coverPairAspect);await embed("overview-after",input.afterImageBytes!,overviewAspect);}
 for(const region of ["hair","eyes","jaw","skin"] as const){await embed(`${region}-detail`,input.beforeImageBytes,detailAspect,region);if(approved)await embed(`${region}-pair`,input.beforeImageBytes,pairAspect,region);if(approved)await embed(`${region}-pair-after`,input.afterImageBytes!,pairAspect,region);}
 if(input.leftImageBytes)await embed("left",input.leftImageBytes,trioAspect);
 if(input.rightImageBytes)await embed("right",input.rightImageBytes,trioAspect);
 const drawImage=(p:PDFPage,key:string,x:number,y:number,width:number,height:number)=>{const im=assets.get(key)!;p.drawRectangle({x,y,width,height,color:C.pale});const s=Math.min(width/im.width,height/im.height);p.drawImage(im,{x:x+(width-im.width*s)/2,y:y+(height-im.height*s)/2,width:im.width*s,height:im.height*s});};
 const date=input.dateStr || new Date().toLocaleDateString("en-GB",{timeZone:"Asia/Kolkata",day:"2-digit",month:"long",year:"numeric"});
 for(const [index,data] of pages.entries()){
  const p=doc.addPage([W,H]);const pageNo=index+1;
  p.drawText("NEXT FACE",{x:M,y:801,font:bold,size:12,color:C.plum});p.drawText("PERSONAL APPEARANCE PROTOCOL",{x:W-M-182,y:803,font,size:7,color:C.muted});
  p.drawLine({start:{x:M,y:784},end:{x:W-M,y:784},color:C.line,thickness:0.6});
  p.drawText(clean(data.subtitle),{x:M,y:754,font:bold,size:7.5,color:C.accent});
  const titleSize=Math.min(28,28*CW/Math.max(CW,bold.widthOfTextAtSize(clean(data.title),28)));
  p.drawText(clean(data.title),{x:M,y:716,font:bold,size:titleSize,color:C.ink});
  let top=687;
  if(index===0){
   const imageX=W-M-225,imageY=390,imageW=225,imageH=250;
   if(approved){const panelW=(imageW-8)/2;drawImage(p,"cover-pair",imageX,imageY,panelW,imageH);drawImage(p,"cover-pair-after",imageX+panelW+8,imageY,panelW,imageH);p.drawText("ORIGINAL",{x:imageX,y:imageY-14,font:bold,size:6.5,color:C.muted});p.drawText("ILLUSTRATIVE PREVIEW",{x:imageX+panelW+8,y:imageY-14,font:bold,size:6.5,color:C.muted});p.drawText("NOT A TREATMENT RESULT",{x:imageX,y:imageY-29,font:bold,size:7,color:C.accent});}
   else drawImage(p,"cover-single",imageX,imageY,imageW,imageH);
   p.drawText("PREPARED FOR",{x:M,y:650,font:bold,size:8,color:C.accent});
   const nameLines=wrap(input.clientName,bold,24,240);let y=615;for(const line of nameLines){p.drawText(line,{x:M,y,font:bold,size:24,color:C.plum});y-=30;}
   const lines=wrap(data.blocks[1].text,font,11,225);y-=20;for(const line of lines){p.drawText(line,{x:M,y,font,size:11,color:C.ink});y-=17;}
   y-=24;p.drawText("YOUR STATED PRIORITIES",{x:M,y,font:bold,size:8,color:C.accent});y-=20;for(const line of wrap(data.blocks[2].text,font,10,220).slice(0,11)){p.drawText(line,{x:M,y,font,size:10,color:C.ink});y-=15;}
   p.drawRectangle({x:M,y:120,width:CW,height:95,color:C.plum});p.drawText(input.reportScopeNote ? "A COMPLETE GUIDE. TEST LAB GOALS ONLY." : "A COMPLETE GUIDE. PERSONALISED TO YOUR ANSWERS.",{x:M+17,y:190,font:bold,size:9,color:C.white});
   let ty=170;for(const line of wrap(data.takeaway,font,10,CW-34)){p.drawText(line,{x:M+17,y:ty,font,size:10,color:C.white});ty-=15;}
  }else if(data.id==="overview"){
   const panelGap=12,panelW=(CW-panelGap)/2,imageY=431,imageH=235;
   if(approved){drawImage(p,"overview",M,imageY,panelW,imageH);drawImage(p,"overview-after",M+panelW+panelGap,imageY,panelW,imageH);p.drawText("CURRENT LOOK / ORIGINAL",{x:M,y:imageY-14,font:bold,size:6.8,color:C.muted});p.drawText("ILLUSTRATIVE PREVIEW / NOT A TREATMENT RESULT",{x:M+panelW+panelGap,y:imageY-14,font:bold,size:6.8,color:C.muted});}
   else{drawImage(p,"overview",M+panelW/2,imageY,panelW,imageH);p.drawText("CURRENT LOOK / ORIGINAL PHOTO",{x:M+panelW/2,y:imageY-14,font:bold,size:6.8,color:C.muted});}
   const cardY=184,cardH=210;
   const drawOverviewCard=(x:number,title:string,blocks:ProtocolPage["blocks"])=>{
    p.drawRectangle({x,y:cardY,width:panelW,height:cardH,color:C.pale,borderColor:C.line,borderWidth:0.7});
    p.drawText(title,{x:x+13,y:cardY+cardH-19,font:bold,size:7.2,color:C.accent});
    const innerHeight=cardH-56;
    let textSize=8.2;
    const bodyLines=(size:number)=>blocks.map(block=>wrap(block.text,font,size,panelW-26));
    const required=(size:number)=>bodyLines(size).reduce((sum,lines)=>sum+12+lines.length*(size+2)+5,0);
    while(required(textSize)>innerHeight&&textSize>6.6)textSize-=0.2;
    const wrapped=bodyLines(textSize);
    let y=cardY+cardH-38;
    for(const [i,block] of blocks.entries()){
     p.drawText(clean(block.title),{x:x+13,y,font:bold,size:8.2,color:C.plum});y-=12;
     for(const line of wrapped[i]){p.drawText(line,{x:x+13,y,font,size:textSize,color:C.ink});y-=textSize+2;}
     y-=5;
    }
   };
   drawOverviewCard(M,"YOUR GOALS",data.blocks.slice(0,2));
   drawOverviewCard(M+panelW+panelGap,"PRESERVE & REVIEW",data.blocks.slice(2));
   p.drawRectangle({x:M,y:94,width:CW,height:70,color:C.plum});
   p.drawText("A PERSONALISED PLAN, WITH CLEAR LIMITS",{x:M+14,y:145,font:bold,size:8,color:C.white});
   for(const [i,line]of wrap(data.takeaway,font,9,CW-28).entries())p.drawText(line,{x:M+14,y:127-i*12,font,size:9,color:C.white});
  }else{
   if(data.region){
    const height=154;const pair=approved;
    if(data.id==="jaw" && assets.has("left") && assets.has("right")){const pw=(CW-16)/3;for(const [i,key]of ["left","overview","right"].entries()){drawImage(p,key,M+i*(pw+8),top-height,pw,height);}p.drawText("LEFT 45-DEGREE / FRONT / RIGHT 45-DEGREE - ORIGINAL VIEWS",{x:M,y:top-height-13,font,size:7,color:C.muted});}
    else if(pair){drawImage(p,`${data.region}-pair`,M,top-height,(CW-14)/2,height);drawImage(p,`${data.region}-pair-after`,M+(CW+14)/2,top-height,(CW-14)/2,height);p.drawText("ORIGINAL",{x:M,y:top-height-13,font,size:7,color:C.muted});p.drawText("ILLUSTRATIVE DRAFT / NOT A TREATMENT RESULT",{x:M+(CW+14)/2,y:top-height-13,font,size:7,color:C.muted});}
    else{drawImage(p,`${data.region}-detail`,M,top-height,CW,height);p.drawText("ORIGINAL PHOTO / UNRETOUCHED DETAIL",{x:M,y:top-height-13,font,size:7,color:C.muted});}
    top-=height+34;
   }
   const bottom=154,available=top-bottom;let size=11.2;let lineHeight=17.2;
   const needed=(sz:number,lh:number)=>data.blocks.reduce((sum,b)=>sum+22+wrap(b.text,font,sz,CW).length*lh+15,0);
   while(needed(size,lineHeight)>available && size>8.4){size-=0.2;lineHeight-=0.3;}
   if(needed(size,lineHeight)>available)throw new Error(`protocol_page_overflow:${data.id}`);
   let y=top;
   for(const block of data.blocks){p.drawRectangle({x:M,y:y-11,width:2,height:12,color:C.accent});p.drawText(clean(block.title),{x:M+10,y:y-10,font:bold,size:11.5,color:C.plum});y-=28;for(const line of wrap(block.text,font,size,CW)){p.drawText(line,{x:M,y,font,size,color:C.ink});
      const sourceMatch=data.id==="sources" ? /^\[(\d+)\]/.exec(line) : null;
      if(sourceMatch){const url=PROTOCOL_SOURCES[Number(sourceMatch[1])-1];if(url){const ann=doc.context.obj({Type:"Annot",Subtype:"Link",Rect:[M,y-2,M+font.widthOfTextAtSize(line,size),y+size],Border:[0,0,0],A:{S:"URI",URI:PDFString.of(url)}});const ref=doc.context.register(ann);p.node.addAnnot(ref);}}
      y-=lineHeight;}y-=9;}
   const takeawayLines=wrap(data.takeaway,font,9,CW-30);const th=takeawayLines.length*13+35;const by=78;
   p.drawRectangle({x:M,y:by,width:CW,height:th,color:C.pale});p.drawText("YOUR TAKEAWAY",{x:M+15,y:by+th-18,font:bold,size:7.5,color:C.accent});let ty=by+th-35;for(const line of takeawayLines){p.drawText(line,{x:M+15,y:ty,font,size:9,color:C.ink});ty-=13;}
  }
  p.drawLine({start:{x:M,y:60},end:{x:W-M,y:60},color:C.line,thickness:0.6});p.drawText(`NEXT FACE / ${clean(input.referenceId).slice(0,24)} / CLINICAL REVIEW PENDING`,{x:M,y:44,font,size:6.5,color:C.muted});p.drawText(`${String(pageNo).padStart(2,"0")} / ${pages.length}`,{x:W-M-34,y:44,font,size:8,color:C.muted});
  if(index===0)p.drawText(clean(date),{x:M,y:235,font,size:8,color:C.muted});
 }
 return doc.save();
}
