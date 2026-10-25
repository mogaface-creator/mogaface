import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { preparePortraitEdit, compositePortraitEdit } from "../../lib/image-generation/portraitEdit.ts";
import { validPortraitGeometry, portraitEditWeight, type PortraitGeometry } from "../../lib/image-generation/portraitGeometry.ts";
import { combinedAppearancePreview } from "../../lib/submissions/clinicalVision.ts";
const geometry:PortraitGeometry={face:{cx:.5,cy:.55,rx:.25,ry:.25},hair:{cx:.5,cy:.25,rx:.3,ry:.16},protected:[{cx:.4,cy:.45,rx:.07,ry:.04},{cx:.6,cy:.45,rx:.07,ry:.04},{cx:.5,cy:.55,rx:.04,ry:.08},{cx:.5,cy:.66,rx:.08,ry:.04},{cx:.5,cy:.35,rx:.1,ry:.02}]};
test("combined preview matches the requested styling, contour and skin goals without fabricated findings",()=>{
 const plan=combinedAppearancePreview();assert.deepEqual(plan.pillars.map(p=>p.key),["hair","jawline","skin"]);assert.match(plan.imagePrompt!,/clearly visible/);assert.match(plan.imagePrompt!,/own hair/);assert.match(plan.executiveSummary,/not diagnoses/);assert.equal(plan.harmonyScore,undefined);
});
test("portrait geometry rejects malformed input and protects core features",()=>{
 assert.equal(validPortraitGeometry(geometry),true);assert.equal(validPortraitGeometry({...geometry,protected:[]}),false);
 assert.equal(portraitEditWeight(.5,.55,geometry),0);assert.equal(portraitEditWeight(.5,.25,geometry),1);assert.equal(portraitEditWeight(.03,.95,geometry),0);
});
test("combined edit allows visible changes but preserves protected features and pixels outside the selection exactly",async()=>{
 const width=200,height=240;const source=await sharp({create:{width,height,channels:3,background:"#64788c"}}).png().toBuffer();
 const prepared=await preparePortraitEdit(source,geometry);const candidate=await sharp({create:{width:512,height:512,channels:3,background:"#b4bec8"}}).png().toBuffer();
 const result=await compositePortraitEdit(prepared,candidate);const data=await sharp(result).raw().toBuffer();const original=await sharp(source).raw().toBuffer();
 let changed=0;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const w=portraitEditWeight(x/width,y/height,geometry);
  for(let c=0;c<3;c++){const i=(y*width+x)*3+c;if(w===0)assert.equal(data[i],original[i]);else if(data[i]!==original[i])changed++;}
 }
 assert.ok(changed>0);const hairIndex=(Math.round(.25*height)*width+Math.round(.5*width))*3;assert.ok(data[hairIndex]-original[hairIndex]>12);
 const metadata=await sharp(result).metadata();assert.equal(metadata.width,width);assert.equal(metadata.height,height);
});

test("combined API receives the complete crop without a provider mask; local compositing remains in place", async()=>{
 const {generateAfterImage}=await import("../../lib/submissions/imageJob.ts");
 const previousFetch=globalThis.fetch,previousEnv={...process.env};
 const width=200,height=240,pixels=Buffer.alloc(width*height*3);let seed=7;for(let i=0;i<pixels.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;pixels[i]=60+seed%130;}
 const source=await sharp(pixels,{raw:{width,height,channels:3}}).png().toBuffer();
 try{
  Object.assign(process.env,{OPENAI_API_KEY:"test-key",IMAGE_GENERATION_PROVIDER:"openai"});
  let imageCalls=0;
  globalThis.fetch=async(url,init)=>{
   if(String(url).endsWith("/images/edits")){
    imageCalls++;const form=init!.body as FormData;assert.equal(form.get("mask"),null);
    const crop=form.get("image") as Blob;const bytes=Buffer.from(await crop.arrayBuffer());
    const stats=await sharp(bytes).stats();assert.ok(stats.channels.every(c=>c.min>0));
    const rendered=await sharp(bytes).resize(1024,1536,{fit:"fill"}).png().toBuffer();
    return Response.json({data:[{b64_json:rendered.toString("base64")}]});
   }
   return Response.json({choices:[{message:{content:JSON.stringify({samePerson:true,naturalTexture:true,preservedLighting:true,preservedUnselectedAreas:true,subtleChanges:true})}}]});
  };
  const result=await generateAfterImage({beforeBytes:source,beforeMime:"image/png",record:null,clinicalVision:combinedAppearancePreview(),portraitGeometry:geometry});
  assert.equal(result.ok,true,result.ok?"":result.reason);assert.equal(imageCalls,1);
  if(result.ok){const output=await sharp(Buffer.from(result.base64,"base64")).raw().toBuffer();for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(portraitEditWeight(x/width,y/height,geometry)===0)for(let c=0;c<3;c++){const i=(y*width+x)*3+c;assert.equal(output[i],pixels[i]);}}
 }finally{globalThis.fetch=previousFetch;for(const k of Object.keys(process.env))if(!(k in previousEnv))delete process.env[k];Object.assign(process.env,previousEnv);}
});
