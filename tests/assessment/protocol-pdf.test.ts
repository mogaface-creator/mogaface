import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
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
