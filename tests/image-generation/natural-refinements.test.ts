import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { createEmptyAssessment } from "../../lib/assessment/defaults.ts";
import { projectPlaces } from "../../lib/assessment/clinicIntake.ts";
import { toggleDetail } from "../../lib/assessment/appearanceConcerns.ts";
import { appearancePlanFromAssessment } from "../../lib/image-generation/appearanceFromAssessment.ts";
import { selectedNaturalRefinements } from "../../lib/image-generation/naturalRefinements.ts";
import { preparePortraitEdit, compositePortraitEdit } from "../../lib/image-generation/portraitEdit.ts";
import { portraitRegionWeights, validPortraitGeometry, type PortraitGeometry, type PortraitEditRegions } from "../../lib/image-generation/portraitGeometry.ts";

const off:PortraitEditRegions={hair:false,skin:false,contour:false,underEye:false,forehead:false};
const geometry:PortraitGeometry={face:{cx:.5,cy:.5,rx:.3,ry:.35},hair:{cx:.5,cy:.18,rx:.32,ry:.15},protected:[
 {cx:.38,cy:.4,rx:.08,ry:.05},{cx:.62,cy:.4,rx:.08,ry:.05},{cx:.5,cy:.5,rx:.05,ry:.07},{cx:.5,cy:.64,rx:.11,ry:.04},{cx:.5,cy:.26,rx:.2,ry:.02}],
 refinements:{brow_opening:[{cx:.38,cy:.345,rx:.09,ry:.025},{cx:.62,cy:.345,rx:.09,ry:.025}],lip_vermilion:[{cx:.5,cy:.64,rx:.1,ry:.03}],mentolabial:[{cx:.5,cy:.72,rx:.09,ry:.025}],chin_projection:[{cx:.5,cy:.8,rx:.11,ry:.04}],lower_face_balance:[{cx:.25,cy:.65,rx:.07,ry:.12},{cx:.75,cy:.65,rx:.07,ry:.12}]}};

test("general goals never activate local feature changes, even in a full report",()=>{
 for(const places of [["OVERALL_APPEARANCE"],["FACIAL_LIFTING"],["FACIAL_VOLUME"]] as const){
  const a=projectPlaces(createEmptyAssessment(),[...places]);
  const plan=appearancePlanFromAssessment(a,undefined,{improveAll:true});
  assert.deepEqual(selectedNaturalRefinements(a.appearanceConcerns),[]);
  assert.equal(plan.areas.some(area=>area.key==="brow_opening"||area.key==="lip_vermilion"),false);
  assert.equal(plan.editRegions.lip_vermilion,undefined);
 }
});
test("vermilion opt-in is narrow and cannot activate brows or contour",()=>{
 let a=projectPlaces(createEmptyAssessment(),["FACIAL_VOLUME"]);
 a={...a,appearanceConcerns:toggleDetail(a.appearanceConcerns,"LIP_FULLNESS")};
 const plan=appearancePlanFromAssessment(a);
 assert.equal(plan.editRegions.lip_vermilion,true);
 assert.equal(plan.editRegions.brow_opening,undefined);
 assert.match(plan.prompt,/ONLY the visible vermilion body/);
 assert.match(plan.prompt,/mouth width, corner positions/);
 assert.match(plan.prompt,/not an open mouth/);
 const malformed={...a.appearanceConcerns,selected:[]};
 assert.deepEqual(selectedNaturalRefinements(malformed),[]);
});
test("brow, chin, mentolabial and lower contour require their separate parent-backed choices",()=>{
 let a=projectPlaces(createEmptyAssessment(),["FACIAL_LIFTING","FACIAL_DEFINITION","FACIAL_VOLUME"]);
 for(const detail of ["BROW_OPENING","LOWER_FACE_SLIMMING","CHIN_PROJECTION","MENTOLABIAL_TRANSITION","LIP_FULLNESS"] as const)a={...a,appearanceConcerns:toggleDetail(a.appearanceConcerns,detail)};
 const p=appearancePlanFromAssessment(a);
 for(const key of ["brow_opening","lower_face_balance","chin_projection","mentolabial"] as const)assert.equal(p.editRegions[key],true);
 assert.match(p.prompt,/do not make a unilateral correction/);
 assert.match(p.prompt,/frontal photo cannot establish projection/);
 assert.match(p.prompt,/not a diagnosis of masseter/);
 assert.doesNotMatch(p.prompt,/Eyebrows are protected by the current mask/);
});
test("each added mask stays independent and preserves nose and eyes",()=>{
 assert.equal(validPortraitGeometry(geometry),true);
 for(const [key,point] of [["brow_opening",[.38,.345]],["lip_vermilion",[.5,.64]],["mentolabial",[.5,.72]],["chin_projection",[.5,.8]],["lower_face_balance",[.25,.65]]] as const){
  assert.equal(portraitRegionWeights(point[0],point[1],geometry,off).combined,0);
  const r={...off,[key]:true};
  assert.ok(portraitRegionWeights(point[0],point[1],geometry,r).combined>0,key);
  assert.equal(portraitRegionWeights(.5,.5,geometry,r).combined,0);
  assert.equal(portraitRegionWeights(.38,.43,geometry,r).combined,0);
 }
});
test("localized lip edit preserves all pixels outside its region and missing geometry fails closed",async()=>{
 const source=await sharp({create:{width:180,height:240,channels:3,background:"#697c89"}}).png().toBuffer();
 const candidate=await sharp({create:{width:180,height:240,channels:3,background:"#929fa9"}}).png().toBuffer();
 const regions={...off,lip_vermilion:true};
 const prepared=await preparePortraitEdit(source,geometry,regions);
 const result=await compositePortraitEdit(prepared,candidate);
 const orig=await sharp(source).raw().toBuffer(),out=await sharp(result).raw().toBuffer();
 let changed=0;
 for(let y=0;y<240;y++)for(let x=0;x<180;x++)for(let c=0;c<3;c++){
  const i=(y*180+x)*3+c;
  if(portraitRegionWeights((x+.5)/180,(y+.5)/240,geometry,regions).combined===0)assert.equal(out[i],orig[i]);
  else if(out[i]!==orig[i])changed++;
 }
 assert.ok(changed>0);
 await assert.rejects(preparePortraitEdit(source,{...geometry,refinements:undefined},regions),/refinement_geometry_unavailable/);
});

test("report facts distinguish selected refinements from findings",async()=>{
 const {intakeFacts}=await import("../../lib/submissions/reportAuthor.ts");
 const {buildProtocolPages}=await import("../../lib/submissions/protocolContent.ts");
 let a=projectPlaces(createEmptyAssessment(),["FACIAL_VOLUME"]);
 a={...a,appearanceConcerns:toggleDetail(a.appearanceConcerns,"LIP_FULLNESS")};
 assert.deepEqual(intakeFacts(a).selectedAppearanceRefinements,["lip_vermilion"]);
 const pages=buildProtocolPages({name:"Test",assessment:a});
 const summary=pages.find(p=>p.id==="scope")!.blocks.find(b=>b.title==="Selected local refinements")!.text;
 assert.match(summary,/lip vermilion/);assert.match(summary,/not findings/);
 assert.doesNotMatch(summary,/brow opening/);
});
