import type { Assessment } from "../assessment/types.ts";
import { replyOf, pickedOf } from "../assessment/clinicIntake.ts";
import { buildAppearancePlan } from "./appearancePlan.ts";
/** Only allowlisted cosmetic preferences reach the renderer. No history, budget, medication, or raw free text. */
export function appearancePlanFromAssessment(a:Assessment){
 const intake=a.clinicIntake,places=new Set(intake.places);
 const hair=places.has("HAIR") && replyOf(intake,"protocolHairGoal")!=="maintain";
 const skin=["SKIN_TEXTURE","SKIN_TONE","PIGMENTATION","BLEMISHES"].some(k=>places.has(k as typeof intake.places[number])) && !pickedOf(intake,"protocolSkinConcerns").includes("none");
 const contour=places.has("FACIAL_DEFINITION");
 const plan=buildAppearancePlan({hair:hair?"balanced":"preserve",skin:skin?"balanced":"preserve",contour:contour?"subtle":"preserve"},{simulateHair:hair,focus:"all"});
 // Full reports cover all areas; image changes still require the user's selection.
 plan.areas=plan.areas.map(area=>area.key==="under_eye" && !places.has("UNDER_EYE") ? {...area,level:"preserve",instruction:"Preserve under-eye shadows, eye shape and eyelids unchanged."} : area.key==="forehead" && !places.has("FACIAL_LINES") ? {...area,level:"preserve",instruction:"Preserve forehead lines and expression unchanged."} : area);
 const texture=replyOf(intake,"protocolHairTexture");
 if(hair && ["straight","wavy","curly","coily","bald"].includes(texture)){
  const h=plan.areas.find(area=>area.key==="hair")!;
  h.instruction=texture==="bald" ? "Preserve the bald or shaved scalp unchanged; do not invent hair." : `${h.instruction} The user reports ${texture} hair: preserve that texture.`;
  if(texture==="bald")h.level="preserve";
 }
 const style=replyOf(intake,"protocolHairGoal");
 const styleText:Record<string,string>={short:"Use a short, neatly shaped version of the existing texture; preserve the original hairline.",texture:"Define and groom the existing natural texture without changing hair type.",volume:"Add modest lift and shape; avoid a rounded wig-like mass."};
 if(hair && styleText[style] && texture!=="bald"){const h=plan.areas.find(area=>area.key==="hair")!;h.instruction+=` ${styleText[style]}`;}
 plan.prompt=["Edit the original portrait into one illustrative after photograph. Return only the photo.","Preserve identity, eyes, nose, lips, eyebrows, ears, expression, complexion, head pose, crop, camera perspective, clothing, background and lighting. Changes require a selected area; preservation overrides enhancement.",...plan.areas.map(area=>`- ${area.key} (${area.level}): ${area.instruction}`),"Retain real pores, hair strands and photographic texture. No face swap, global relighting, bleaching or radically thinner neck. This is an illustration, not a treatment prediction."].join("\n");
 return plan;
}
