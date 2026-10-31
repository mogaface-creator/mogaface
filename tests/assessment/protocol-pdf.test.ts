import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { PDFDocument, PDFName, PDFDict } from "pdf-lib";
import { generateProtocolPdf } from "../../lib/submissions/protocolPdf.ts";
import { createEmptyAssessment } from "../../lib/assessment/defaults.ts";
import { setAnswer } from "../../lib/assessment/clinicIntake.ts";
test("full PDF renders answer branches and never reads an unapproved after image",async()=>{
 const photo=await sharp({create:{width:600,height:800,channels:3,background:'#777777'}}).jpeg().toBuffer();
 let a=createEmptyAssessment();for(const[id,v]of Object.entries({protocolHairTexture:'curly',protocolHairGoal:'styling',protocolSensitivity:'yes',protocolDiet:'vegan',maxWilling:'laser',protocolBudget:'under1000',protocolEquipment:'gym'}))a=setAnswer(a,id,v);
 const bytes=await generateProtocolPdf({clientName:'Sample client',referenceId:'TEST',beforeImageBytes:photo,afterImageBytes:Buffer.from('invalid image - must not be read'),assessment:a,reportSummary:'',detectedAreas:[]});
 const doc=await PDFDocument.load(bytes);assert.equal(doc.getPageCount(),25);assert.ok(bytes.length>10000);
 await assert.rejects(()=>generateProtocolPdf({clientName:'Sample',referenceId:'TEST',beforeImageBytes:photo,afterImageBytes:Buffer.from('invalid image'),previewApproved:true,assessment:a,reportSummary:'',detectedAreas:[]}));
});

test("quality-checked after photo is embedded in cover, overview and regional comparisons on every render", async()=>{
 const before=await sharp({create:{width:600,height:800,channels:3,background:'#773333'}}).jpeg().toBuffer();
 const after=await sharp({create:{width:600,height:800,channels:3,background:'#337733'}}).jpeg().toBuffer();
 const input={clientName:'Sample',referenceId:'REPEAT',beforeImageBytes:before,afterImageBytes:after,previewStatus:'quality_checked' as const,assessment:createEmptyAssessment(),reportSummary:'',detectedAreas:[]};
 const imageCount=(page:import('pdf-lib').PDFPage)=>{
  const objects=page.node.Resources()?.lookup(PDFName.of('XObject'),PDFDict);
  return objects?.keys().length ?? 0;
 };
 for(let attempt=0;attempt<2;attempt++){
  const pdf=await PDFDocument.load(await generateProtocolPdf(input));
  assert.equal(pdf.getPageCount(),25);
  assert.equal(imageCount(pdf.getPage(0)),2,'cover must contain original and after');
  assert.equal(imageCount(pdf.getPage(3)),2,'overview must contain original and after');
  assert.equal(imageCount(pdf.getPage(4)),2,'hair comparison must contain original and after');
 }
 const without=await PDFDocument.load(await generateProtocolPdf({...input,afterImageBytes:null,previewStatus:undefined}));
 assert.equal(imageCount(without.getPage(0)),1,'missing after must never be replaced by a duplicate original');
});
