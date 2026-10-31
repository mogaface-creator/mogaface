import test from "node:test";
import assert from "node:assert/strict";
import type { ExpressionAnalysis } from "../../lib/observation/types.ts";
import { expressionContext } from "../../lib/observation/expressionContext.ts";
import { appearancePlanFromAssessment } from "../../lib/image-generation/appearanceFromAssessment.ts";
import { createEmptyAssessment } from "../../lib/assessment/defaults.ts";
import { projectPlaces } from "../../lib/assessment/clinicIntake.ts";
import { buildMogaFaceAnalysis } from "../../lib/observation/build.ts";
import { buildProtocolPages } from "../../lib/submissions/protocolContent.ts";

function video(): ExpressionAnalysis {
  return { status: "analyzed", measured: [], notes: ["Private free-text note must not enter a prompt"], expressions: [
    {type:"dynamic_expression_observation",expression:"BROW_RAISE",region:"FOREHEAD",status:"observed",evidence:{neutralFrames:[0,1],expressionFrames:[2,3],movementMetric:"private metric text",movementPct:18},strength:"moderate",reason:"Private reason"},
    {type:"dynamic_expression_observation",expression:"SMILE",region:"MOUTH_AREA",status:"observed",evidence:{neutralFrames:[0,1],expressionFrames:[4,5],movementMetric:"mouth movement",movementPct:12},strength:"high",reason:""},
  ],linePatterns:[{kind:"forehead",mode:"DYNAMIC_VIDEO_EVIDENCE",expression:"BROW_RAISE",status:"observed",neutralFrames:[0,1],expressionFrames:[2,3],contrastRatio:1.2,neutralContrast:.1,expressionContrast:.12,reason:"Private line note"}] };
}

test("video produces traceable expression coverage and bounded line descriptions",()=>{
  const result=expressionContext(video());
  assert.equal(result.status,"usable");
  assert.equal(result.movements.filter(m=>m.reliable).length,2);
  assert.equal(result.patterns.length,1);
  assert.match(result.movements.find(m=>m.key==="FROWN")!.text,/no usable comparison/);
  assert.doesNotMatch(JSON.stringify(result.patterns),/Private/);
});

test("absent, inconclusive, weak, duplicate and malformed evidence never guides an edit",()=>{
  const a=projectPlaces(createEmptyAssessment(),["FACIAL_LINES","UNDER_EYE"]);
  const baseline=appearancePlanFromAssessment(a);
  for(const expression of [undefined,{...video(),status:"insufficient_evidence" as const},
    {...video(),expressions:video().expressions.map(e=>({...e,strength:"low" as const}))},
    {...video(),expressions:[...video().expressions,...video().expressions]},
    {...video(),expressions:video().expressions.map(e=>({...e,evidence:{...e.evidence,neutralFrames:[]}}))},
    {...video(),expressions:video().expressions.map(e=>({...e,evidence:{...e.evidence,movementPct:NaN}}))}]){
    const plan=appearancePlanFromAssessment(a,expression);
    assert.equal(plan.prompt,baseline.prompt);
    assert.equal(expressionContext(expression).patterns.length,0);
  }
  assert.equal(expressionContext().status,"not_provided");
  assert.equal(expressionContext({...video(),status:"insufficient_evidence"}).status,"inconclusive");
});

test("video constrains only selected brow/eye edits without unlocking regions or leaking raw text",()=>{
  const a=projectPlaces(createEmptyAssessment(),["FACIAL_LINES","UNDER_EYE"]);
  const baseline=appearancePlanFromAssessment(a), plan=appearancePlanFromAssessment(a,video());
  assert.match(plan.prompt,/expression-video comparisons showed brow-region movement/);
  assert.match(plan.prompt,/Preserve natural eyelid folds/);
  assert.doesNotMatch(plan.prompt,/Private|private metric|18|1\.2/);
  assert.deepEqual(plan.editRegions,baseline.editRegions);
  const hairOnly=projectPlaces(createEmptyAssessment(),["HAIR"]);
  assert.equal(appearancePlanFromAssessment(hairOnly,video()).prompt,appearancePlanFromAssessment(hairOnly).prompt);
  assert.equal(appearancePlanFromAssessment(hairOnly,video()).editRegions.forehead,false);
});

test("report details actual video findings and distinguishes missing from inconclusive video",()=>{
  const a=createEmptyAssessment(), analysis=buildMogaFaceAnalysis(a,null);
  analysis.expression=video();
  const pages=buildProtocolPages({name:"Sample",assessment:a,analysis});
  assert.equal(pages.length,25);
  const chapter=JSON.stringify(pages.find(p=>p.id==="facial-exercises"));
  assert.match(chapter,/2 of 4/);
  assert.match(chapter,/Brow raise: movement observed/);
  assert.match(chapter,/forehead region showed greater line contrast/);
  assert.doesNotMatch(chapter,/Private|private metric/);
  analysis.expression={...video(),status:"insufficient_evidence"};
  const inconclusive=JSON.stringify(buildProtocolPages({name:"Sample",analysis}).find(p=>p.id==="facial-exercises"));
  assert.match(inconclusive,/could not be established/);
  assert.doesNotMatch(inconclusive,/movement observed|showed greater line contrast/);
  const missing=JSON.stringify(buildProtocolPages({name:"Sample"}).find(p=>p.id==="facial-exercises"));
  assert.match(missing,/No expression video was supplied/);
});

test("outer-eye patterns accept distinct smile/squint rows and reject duplicate or mismatched rows",()=>{
  const expression=video();
  const pattern={...expression.linePatterns[0],kind:"lateralEye" as const,expression:"SMILE" as const};
  const squint={...pattern,expression:"SQUINT" as const,status:"insufficient_evidence" as const};
  expression.linePatterns=[pattern,squint];
  assert.equal(expressionContext(expression).patterns.length,1);
  expression.linePatterns=[pattern,pattern];
  assert.equal(expressionContext(expression).patterns.length,0);
  expression.linePatterns=[{...pattern,kind:"forehead"}];
  assert.equal(expressionContext(expression).patterns.length,0);
  expression.linePatterns=[{...pattern,contrastRatio:.8}];
  assert.equal(expressionContext(expression).patterns.length,0);
});
