import test from "node:test";
import assert from "node:assert/strict";
import { buildAppearancePlan, parseAppearanceControls, DEFAULT_APPEARANCE_CONTROLS as defaults } from "../../lib/image-generation/appearancePlan.ts";
test("independent settings preserve unselected areas and restrain default contour",()=>{
 const plan=buildAppearancePlan(defaults,{simulateHair:true});
 assert.equal(plan.areas.find(a=>a.key==="contour")?.level,"subtle");
 assert.match(plan.prompt,/Preserve cheek width/);
 const skinOnly=buildAppearancePlan(defaults,{focus:"skin",simulateHair:true});
 assert.equal(skinOnly.areas.find(a=>a.key==="contour")?.level,"preserve");
 assert.equal(skinOnly.areas.find(a=>a.key==="hair")?.level,"preserve");
 assert.equal(buildAppearancePlan(defaults,{simulateHair:false}).areas.find(a=>a.key==="hair")?.level,"preserve");
 assert.equal(buildAppearancePlan({...defaults,skin:"preserve"},{simulateHair:true}).areas.find(a=>a.key==="skin")?.level,"preserve");
});
test("controls reject malformed input rather than silently generating a stronger edit",()=>{
 for(const value of [null,[],{}, {...defaults,contour:"extreme"},{...defaults,unexpected:"balanced"}])assert.throws(()=>parseAppearanceControls(value));
});
