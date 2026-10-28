/** Appearance instructions shared by the preview and its eventual report. No diagnosis or treatment claims. */
export const EDIT_LEVELS = ["preserve", "subtle", "balanced"] as const;
export type EditLevel = typeof EDIT_LEVELS[number];
export interface AppearanceControls { hair: EditLevel; skin: EditLevel; contour: EditLevel }
export const DEFAULT_APPEARANCE_CONTROLS: AppearanceControls = {hair:"balanced",skin:"balanced",contour:"subtle"};
export function parseAppearanceControls(value: unknown): AppearanceControls {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_appearance_controls");
  const v=value as Record<string,unknown>;
  if(Object.keys(v).some(k=>!["hair","skin","contour"].includes(k)) || !["hair","skin","contour"].every(k=>EDIT_LEVELS.includes(v[k] as EditLevel))) throw new Error("invalid_appearance_controls");
  return {hair:v.hair as EditLevel,skin:v.skin as EditLevel,contour:v.contour as EditLevel};
}
export function buildAppearancePlan(controls: AppearanceControls, options: {focus?:string;simulateHair?:boolean;directive?:string}={}) {
  const c=parseAppearanceControls(controls);
  const focus=options.focus || "all";
  const all=focus==="all" || focus==="combined";
  const region=(key:string)=>all || focus===key;
  const areas: {key:string;level:EditLevel;instruction:string}[]=[];
  const add=(key:string,level:EditLevel,instruction:string)=>areas.push({key,level,instruction});
  const hair=options.simulateHair && (all || focus==="hair") ? c.hair : "preserve";
  add("hair",hair,hair==="preserve" ? "Preserve the entire hairstyle, hairline and density unchanged." : `${hair==="subtle" ? "Gently tidy" : "Visibly restyle"} the existing hair into a groomed, naturally curly or wavy style matching its original texture. Give the top lift and shape, groom bulky sides, and add only plausible fullness at sparse areas. Preserve hair colour, irregular hairline and individual strands. No wig-like cap or painted-on hair. Preserve a completely bald or shaved scalp.`);
  const skin=region("skin") ? c.skin : "preserve";
  add("skin",skin,skin==="preserve" ? "Preserve skin texture, marks and complexion unchanged." : `${skin==="subtle" ? "Gently reduce" : "Clearly reduce"} visible blemish and post-blemish mark contrast. Keep pores, fine facial hair, permanent identifying marks and natural variation. Retain the original skin colour and undertones; no bleaching or airbrushing.`);
  const contour=region("jawline") || region("midface") ? c.contour : "preserve";
  add("contour",contour,contour==="preserve" ? "Preserve the original face outline, cheek fullness, jaw and neck exactly." : `${contour==="subtle" ? "Make a small refinement limited to soft fullness immediately beneath the jaw. Preserve cheek width and the original overall face silhouette." : "Make a moderate refinement of outer-cheek and beneath-jaw soft fullness, keeping the original overall face silhouette recognizable."} Keep chin shape, jawbone width, neck width and neck length. No hollow cheeks, pointed chin, long thin neck or dramatic weight-loss transformation.`);
  if(region("under_eye"))add("under_eye","subtle","Gently reduce under-eye shadow contrast. Keep the eye shape, eyelids, folds and gaze unchanged.");
  if(region("forehead"))add("forehead","subtle","Soften the deepest visible forehead crease slightly, preserving fine lines and brow position.");
  const prompt=[
    "Edit the ORIGINAL attached portrait into one realistic illustrative after photograph. Return only the edited photo, without text or a collage.",
    "PRESERVE: exact eye shape and spacing, nose, lips, eyebrows, ears, expression and age appearance. Preserve head position, camera perspective, crop, original lighting, exposure, skin colour, background and clothes. Keep the source photo's natural photographic quality.",
    "Apply this specific appearance plan. Preserve instructions override any request for a stronger transformation:",
    ...areas.map(a=>`- ${a.key} (${a.level}): ${a.instruction}`),
    ...(options.directive?.trim() ? [`Additional direction within these constraints: ${options.directive.trim()}`] : []),
    "The hair and skin improvements should be noticeable without using facial reshaping or relighting to create the difference. Retain photographic skin texture. This is an illustration, not a prediction of treatment outcomes.",
  ].join("\n");
  return {version:1,areas,prompt};
}
