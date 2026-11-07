import { ASSESSMENT_CATEGORIES } from "../assessment/aestheticCatalog.ts";
export const REVIEW_ITEMS=ASSESSMENT_CATEGORIES.flatMap(category=>category.items.map(label=>({category:category.name,label}))).map((item,i)=>({...item,id:i+1}));
export type ReviewConfidence="high"|"moderate"|"limited"|"not_assessable";
export interface ReviewFinding {id:number;observation:string;confidence:ReviewConfidence;source:"front"|"left45"|"right45"|"video"|"none"}
export interface DetailedReview {summary:string;priorities:string[];findings:ReviewFinding[]}
export interface ReviewImage {base64:string;mime:string;receipt:string}
export const REVISION_TARGETS=[
 {key:"under_eye",label:"Under-eye / lid–cheek transition"},
 {key:"skin",label:"Inner-cheek texture and marks"},
 {key:"hair",label:"Hair styling"},
 {key:"beard",label:"Beard outline and grooming"},
 {key:"brow_opening",label:"Brow opening"},
 {key:"lip_vermilion",label:"Vermilion body and border"},
 {key:"lower_face_balance",label:"Lower-face balance"},
 {key:"mentolabial",label:"Lip–chin crease"},
 {key:"chin_projection",label:"Chin contour"},
] as const;
export type RevisionTarget=typeof REVISION_TARGETS[number]["key"];
export function parseTargets(value:unknown):RevisionTarget[]{
 if(!Array.isArray(value)||!value.length||value.length>9||new Set(value).size!==value.length||value.some(v=>!REVISION_TARGETS.some(t=>t.key===v)))throw new Error("invalid_targets");
 return value as RevisionTarget[];
}
/** Missing evidence is explicit; a catalog entry never implies a completed measurement. */
export function parseDetailedReview(value:unknown,videoAvailable=false):DetailedReview|null{
 if(!value||typeof value!=="object")return null;
 const v=value as Record<string,unknown>;
 if(typeof v.summary!=="string"||!v.summary.trim()||!Array.isArray(v.priorities)||!Array.isArray(v.findings))return null;
 const rows=new Map<number,ReviewFinding>();
 for(const raw of v.findings){
  if(!raw||typeof raw!=="object")return null;
  const r=raw as Record<string,unknown>;
  if(typeof r.id!=="number"||!Number.isInteger(r.id)||r.id<1||r.id>169||rows.has(r.id)||typeof r.observation!=="string"||!r.observation.trim()||r.observation.length>500||!["high","moderate","limited","not_assessable"].includes(String(r.confidence))||!["front","left45","right45","video","none"].includes(String(r.source)))return null;
  if(r.source==="video"&&!videoAvailable)return null;
  if(r.confidence!=="not_assessable"&&r.source==="none")return null;
  rows.set(r.id,r as unknown as ReviewFinding);
 }
 return {summary:v.summary.trim().slice(0,1800),priorities:v.priorities.filter((p):p is string=>typeof p==="string"&&!!p.trim()).slice(0,5).map(p=>p.slice(0,600)),findings:REVIEW_ITEMS.map(item=>rows.get(item.id)??{id:item.id,observation:"Not assessed from the available original evidence. No finding is inferred.",confidence:"not_assessable",source:"none"})};
}

/** Describe the original view needed when the report has no reliable regional image. */
export function featurePhotoGuidance(category:string):string{
 if(category==="ears")return "Add a clear original photo of each side with hair pulled back and both ears unobstructed across the two views.";
 if(category==="neck")return "Add an upright original photo showing the jaw, underside of the chin and upper neck. A side view helps show the contour.";
 return "Use a clear, well-lit original photo with this area in frame to support a closer view.";
}
