/** Server-side appearance instructions; client choices live in appearanceControls.ts. */
import { parseAppearanceControls, type AppearanceControls, type EditLevel } from "./appearanceControls.ts";
import { renderRealismPrompt, REALISM_PROMPT_VERSION } from "./realismPrompt.server.ts";
export { EDIT_LEVELS, DEFAULT_APPEARANCE_CONTROLS, parseAppearanceControls } from "./appearanceControls.ts";
export type { AppearanceControls, EditLevel } from "./appearanceControls.ts";
export function buildAppearancePlan(controls: AppearanceControls, options: {focus?:string;simulateHair?:boolean;directive?:string;targets?:string[]}={}) {
  const c=parseAppearanceControls(controls);
  const focus=options.focus || "all";
  const all=focus==="all" || focus==="combined";
  const region=(key:string)=>options.targets?.length ? options.targets.includes(key) : all || focus===key;
  const areas: {key:string;level:EditLevel;instruction:string}[]=[];
  const add=(key:string,level:EditLevel,instruction:string)=>areas.push({key,level,instruction});
  const hair=options.simulateHair && region("hair") ? c.hair : "preserve";
  add("hair",hair,hair==="preserve" ? "Preserve the entire hairstyle, hairline and density unchanged." : `${hair==="subtle" ? "Gently tidy" : "Visibly groom"} the existing hairstyle while preserving the source hair type, strand thickness, colour, irregular hairline and believable density. Tidy flyaways and bulky edges without inventing a different haircut. Keep natural root direction, varied strand groups and realistic scalp visibility. Do not add curls to straight hair, straighten curls, lower the hairline or paint in new hair. Preserve a completely bald or shaved scalp.`);
  const skin=region("skin") ? c.skin : "preserve";
  add("skin",skin,skin==="preserve" ? "Preserve skin texture, marks and complexion unchanged." : `${skin==="subtle" ? "Gently reduce" : "Gently reduce"} visible blemish and post-blemish mark contrast. Keep pores, fine facial hair, permanent identifying marks and natural variation. Retain the original skin colour and undertones; no bleaching or airbrushing. Distinguish flat marks from raised or indented scars: preserve scar geometry. Reduce localized redness only if clearly visible; do not suppress natural cheek colour or lighting shadows. Preserve normal visible pores, moles and freckles. If no selected concern is visible, preserve the region.`);
  const contour=region("jawline") || region("midface") ? c.contour : "preserve";
  add("contour",contour,contour==="preserve" ? "Preserve the original face outline, cheek fullness, jaw and neck exactly." : `${contour==="subtle" ? "Make a small refinement limited to soft fullness immediately beneath the jaw. Preserve cheek width and the original overall face silhouette." : "Make only a small refinement at the existing jaw-to-neck transition. Preserve cheek width, cheek fullness and the original overall face silhouette."} Keep chin shape, jawbone width, neck width and neck length. No hollow cheeks, pointed chin, long thin neck or dramatic weight-loss transformation. Do not manufacture definition with darker shadows. If refinement requires anatomical reconstruction, preserve the original contour.`);
  if(region("under_eye"))add("under_eye","subtle","Gently reduce under-eye shadow contrast. Keep the eye shape, size, spacing, eyelids, folds and gaze unchanged. Retain natural shadow and the eyelid-to-cheek transition. Do not whiten skin, add cheek volume or confuse pigmentation, puffiness and shadow. Preserve when unclear.");
  if(region("forehead"))add("forehead","subtle","Soften the deepest visible forehead crease slightly, preserving fine lines, pores, brow position, expression, hairline and identifying marks including bindi. Do not lift brows or create a plastic surface. If no clear crease is visible, preserve the forehead unchanged.");
  const prompt=renderRealismPrompt(areas,options.directive);
  return {version:1,promptVersion:REALISM_PROMPT_VERSION,areas,prompt};
}
