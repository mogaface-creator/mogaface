import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import fs from 'node:fs/promises';
import {PDFDocument} from 'pdf-lib';
import {createEmptyAssessment} from '../../lib/assessment/defaults.ts';
import {projectPlaces,setAnswer} from '../../lib/assessment/clinicIntake.ts';
import {buildMogaFaceAnalysis} from '../../lib/observation/build.ts';
import {createAnalysisRecord,getAnalysisRecord,attachReportPhotos} from '../../lib/analysis-session/store.ts';
import {createSubmission,getSubmission,claimSubmission,updateSubmission} from '../../lib/submissions/store.ts';
import {handleSubmitAssessment} from '../../lib/submissions/submitHandler.ts';
import {generateAfterImage} from '../../lib/submissions/imageJob.ts';
import {protocolInput} from '../../lib/submissions/protocolInput.ts';
import {generatePdfReport} from '../../lib/submissions/pdfReport.ts';
import {downloadSubmissionReport} from '../../lib/submissions/reportDownload.ts';
import {buildProtocolPages} from '../../lib/submissions/protocolContent.ts';
const deps={env:{NODE_ENV:'test'}};
test('questions + three photos + saved video evidence reach the after-image report and protected download',async()=>{
 let a=projectPlaces(createEmptyAssessment(),['HAIR','BLEMISHES']);a=setAnswer(a,'protocolHairTexture','curly');a=setAnswer(a,'protocolHairGoal','texture');a=setAnswer(a,'wantAfterPhoto','yes');
 const analysis=buildMogaFaceAnalysis(a,null);analysis.expression={status:'analyzed',measured:[],expressions:[{type:'dynamic_expression_observation',expression:'BROW_RAISE',region:'FOREHEAD',status:'observed',evidence:{neutralFrames:[0],expressionFrames:[1],movementMetric:'test movement vs neutral',movementPct:12},strength:'low',reason:'Synthetic test fixture'}],linePatterns:[],notes:[]};
 const handle=await createAnalysisRecord({assessment:a,analysis,photoQualityValid:true,hasLeftFortyFive:true,hasRightFortyFive:true},deps);assert.ok(handle);
 const original=await sharp({create:{width:600,height:800,channels:3,background:'#777777'}}).jpeg().toBuffer();
 const after=await sharp({create:{width:600,height:800,channels:3,background:'#888888'}}).jpeg().toBuffer();
 const form=new FormData();for(const field of ['photo','leftPhoto','rightPhoto'])form.set(field,new Blob([original],{type:'image/jpeg'}),field+'.jpg');form.set('payload',JSON.stringify({...handle,photoVisualizationConsent:'granted'}));
 const response=await handleSubmitAssessment(new Request('http://localhost/api/submit-assessment',{method:'POST',headers:{host:'localhost',origin:'http://localhost'},body:form}),{getAnalysisRecord:(id,t)=>getAnalysisRecord(id,t,deps),attachReportPhotos:(r,p)=>attachReportPhotos(r,p,deps),createSubmission:i=>createSubmission(i,deps)});assert.equal(response.status,200);const {submissionId}=await response.json();
 const record=await getAnalysisRecord(handle.analysisId,handle.sessionToken,deps);assert.ok(record?.reportPhotos);assert.equal(record.analysis.expression.status,'analyzed');
 assert.equal(await claimSubmission(submissionId,deps),true);assert.equal(await claimSubmission(submissionId,deps),false);
 const previousFetch=globalThis.fetch,previousKey=process.env.OPENAI_API_KEY,previousProvider=process.env.IMAGE_GENERATION_PROVIDER;
 process.env.OPENAI_API_KEY='test-only-key';process.env.IMAGE_GENERATION_PROVIDER='openai';let edits=0;
 globalThis.fetch=async(url,init)=>{if(String(url).endsWith('/images/edits')){edits++;assert.match(String((init?.body as FormData).get('prompt')),/reports curly hair/);return Response.json({data:[{b64_json:after.toString('base64')}]});}return Response.json({choices:[{message:{content:JSON.stringify({samePerson:true,naturalTexture:true,preservedLighting:true,preservedUnselectedAreas:true,subtleChanges:true,reason:'Synthetic test review'})}}]});};
 let generated:Awaited<ReturnType<typeof generateAfterImage>>;
 try{generated=await generateAfterImage({beforeBytes:original,beforeMime:'image/jpeg',record});}finally{globalThis.fetch=previousFetch;if(previousKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=previousKey;if(previousProvider===undefined)delete process.env.IMAGE_GENERATION_PROVIDER;else process.env.IMAGE_GENERATION_PROVIDER=previousProvider;}
 assert.equal(generated.ok,true);assert.equal(edits,1);if(!generated.ok)throw Error('test generation failed');
 const input=protocolInput(record,{name:'Synthetic sample',id:submissionId,front:original,after:Buffer.from(generated.base64,'base64')});assert.ok(input.leftImageBytes&&input.rightImageBytes);assert.equal(input.previewStatus,'quality_checked');
 const pages=buildProtocolPages({name:'Synthetic sample',assessment:a,analysis:record.analysis,photoViews:3,previewStatus:'quality_checked'});assert.match(JSON.stringify(pages.find(p=>p.id==='scope')),/views available for this report: 3/);assert.match(JSON.stringify(pages.find(p=>p.id==='scope')),/usable expression comparisons/);
 const pdf=await generatePdfReport(input);if(process.env.PROTOCOL_QA_PDF)await fs.writeFile(process.env.PROTOCOL_QA_PDF,pdf);assert.equal((await PDFDocument.load(pdf)).getPageCount(),25);
 await updateSubmission(submissionId,{status:'done',reportSummary:'Your Next Face protocol - test',afterImageBase64:generated.base64,afterImageMime:'image/jpeg'},deps);
 const downloadDeps={getSubmission:(id:string)=>getSubmission(id,deps),getAnalysisRecord:(id:string,t:string)=>getAnalysisRecord(id,t,deps),generatePdfReport};
 assert.equal((await downloadSubmissionReport(new Request('http://localhost/api/submission-report?id='+submissionId),downloadDeps)).status,401);
 assert.equal((await downloadSubmissionReport(new Request('http://localhost/api/submission-report?id='+submissionId,{headers:{Authorization:'Bearer wrong'}}),downloadDeps)).status,401);
 const download=await downloadSubmissionReport(new Request('http://localhost/api/submission-report?id='+submissionId,{headers:{Authorization:'Bearer '+handle.sessionToken}}),downloadDeps);assert.equal(download.status,200);assert.equal(download.headers.get('content-type'),'application/pdf');
});
test('an unavailable quality review never becomes a deliverable image',async()=>{
 const photo=await sharp({create:{width:600,height:800,channels:3,background:'#666666'}}).jpeg().toBuffer();const after=await sharp({create:{width:600,height:800,channels:3,background:'#999999'}}).jpeg().toBuffer();
 const oldFetch=globalThis.fetch;const oldKey=process.env.OPENAI_API_KEY,oldProvider=process.env.IMAGE_GENERATION_PROVIDER;process.env.OPENAI_API_KEY='test-key';process.env.IMAGE_GENERATION_PROVIDER='openai';
 globalThis.fetch=async url=>String(url).endsWith('/images/edits')?Response.json({data:[{b64_json:after.toString('base64')}]}):Response.json({error:'unavailable'},{status:503});
 try{const result=await generateAfterImage({beforeBytes:photo,beforeMime:'image/jpeg',customPrompt:'Keep identity and edit only hair.'});assert.equal(result.ok,false);if(!result.ok)assert.equal(result.reason,'image_review_unavailable');}finally{globalThis.fetch=oldFetch;if(oldKey===undefined)delete process.env.OPENAI_API_KEY;else process.env.OPENAI_API_KEY=oldKey;if(oldProvider===undefined)delete process.env.IMAGE_GENERATION_PROVIDER;else process.env.IMAGE_GENERATION_PROVIDER=oldProvider;}
});
