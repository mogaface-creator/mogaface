import type { Assessment } from "../assessment/types.ts";
import { replyOf, pickedOf } from "../assessment/clinicIntake.ts";
import { buildAppearancePlan } from "./appearancePlan.ts";
import type { PortraitEditRegions } from "./portraitGeometry.ts";
import { renderRealismPrompt } from "./realismPrompt.server.ts";
import type { ExpressionAnalysis } from "../observation/types.ts";
import { expressionContext } from "../observation/expressionContext.ts";
/** Only allowlisted cosmetic preferences reach the renderer. No history, budget, medication, or raw free text. */
/**
 * `improveAll` (the customer report) edits every area that can visibly improve, not only the questionnaire ticks:
 * hair unless the user wants to keep their style or is bald, skin unless they said "none", plus jaw, under-eye and forehead.
 */
export function appearancePlanFromAssessment(a:Assessment,expression?:ExpressionAnalysis|null,options:{improveAll?:boolean}={}){
 const intake=a.clinicIntake,places=new Set(intake.places),all=options.improveAll===true;
 const hair=(all||places.has("HAIR")) && replyOf(intake,"protocolHairGoal")!=="maintain";
 const skin=(all||["SKIN_TEXTURE","SKIN_TONE","PIGMENTATION","BLEMISHES"].some(k=>places.has(k as typeof intake.places[number]))) && !pickedOf(intake,"protocolSkinConcerns").includes("none");
 const contour=all||places.has("FACIAL_DEFINITION");
 const underEye=all||places.has("UNDER_EYE");
 const forehead=all||places.has("FACIAL_LINES");
 const plan=buildAppearancePlan({hair:hair?"balanced":"preserve",skin:skin?"balanced":"preserve",contour:contour?"balanced":"preserve"},{simulateHair:hair,focus:"all"});
 // Full reports cover all areas; image changes still require the user's selection.
 plan.areas=all ? plan.areas : plan.areas.map(area=>area.key==="under_eye" && !places.has("UNDER_EYE") ? {...area,level:"preserve",instruction:"Preserve under-eye shadows, eye shape and eyelids unchanged."} : area.key==="forehead" && !places.has("FACIAL_LINES") ? {...area,level:"preserve",instruction:"Preserve forehead lines and expression unchanged."} : area);
 const texture=replyOf(intake,"protocolHairTexture");
 if(hair && ["straight","wavy","curly","coily","bald"].includes(texture)){
  const h=plan.areas.find(area=>area.key==="hair")!;
  h.instruction=texture==="bald" ? "Preserve the bald or shaved scalp unchanged; do not invent hair." : `${h.instruction} The user reports ${texture} hair: preserve that texture.`;
  if(texture==="bald")h.level="preserve";
 }
 const style=replyOf(intake,"protocolHairGoal");
 const styleText:Record<string,string>={short:"Use a short, neatly shaped version of the existing texture; preserve the original hairline.",texture:"Define and groom the existing natural texture without changing hair type.",volume:"Add modest styling lift using the existing hair; preserve density and scalp visibility. Avoid a rounded wig-like mass."};
 if(hair && styleText[style] && texture!=="bald"){const h=plan.areas.find(area=>area.key==="hair")!;h.instruction+=` ${styleText[style]}`;}
 if(skin){
  const instructions:Record<string,string>={
   breakouts:"Reduce visible temporary breakout contrast without erasing pores, facial hair or permanent marks.",
   marks:"Gently reduce selected flat post-blemish mark contrast while retaining complexion and normal skin variation.",
   scars:"Preserve raised or indented scar geometry; do not invent scar removal or fill texture with artificial smooth skin.",
   texture:"Preserve normal pore structure and fine texture; do not render a poreless surface.",
   redness:"Gently reduce visible localized redness without changing overall skin undertone or suppressing natural colour variation.",
  };
  const concerns=pickedOf(intake,"protocolSkinConcerns");
  const selected=concerns.flatMap(key=>instructions[key]?[instructions[key]]:[]);
  const area=plan.areas.find(area=>area.key==="skin")!;
  if(selected.length)area.instruction=`Edit only the selected skin concerns that are actually visible. ${selected.join(" ")} Preserve all other skin features, lighting and identifying marks.`;
 }
 const video=expressionContext(expression);
 const observed=(keys:string[])=>video.movements.some(m=>m.reliable && keys.includes(m.key));
 if(forehead && observed(["BROW_RAISE","FROWN"])){
  const area=plan.areas.find(area=>area.key==="forehead")!;
  area.instruction+=" Sampled expression-video comparisons showed brow-region movement. Preserve the original resting brow position and natural expression-related folds. Do not freeze the expression or infer a permanent wrinkle from movement. Edit only a selected crease actually visible in this source photograph.";
 }
 if(underEye && observed(["SMILE","SQUINT"])){
  const area=plan.areas.find(area=>area.key==="under_eye")!;
  area.instruction+=" Sampled expression-video comparisons showed smile or squint movement. Preserve natural eyelid folds and smile-related eye creases. These movement observations do not establish under-eye pigmentation, hollowness or a treatment need.";
 }
 plan.prompt=renderRealismPrompt(plan.areas);
 const editRegions:PortraitEditRegions={hair:hair && texture!=="bald",skin,contour,underEye,forehead};
 return {...plan,editRegions};
}
