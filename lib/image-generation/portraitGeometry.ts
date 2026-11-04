import type { NaturalRefinementKey } from "./naturalRefinements.ts";
import { LANDMARK } from "../facial-analysis/landmarkMapping.ts";
import type { LandmarkList } from "../facial-analysis/types.ts";
export interface Ellipse { cx: number; cy: number; rx: number; ry: number }
export interface PortraitGeometry { face: Ellipse; hair: Ellipse; protected: Ellipse[]; refinements?: Record<NaturalRefinementKey, Ellipse[]> }
export type PortraitEditRegions = { hair: boolean; skin: boolean; contour: boolean; underEye: boolean; forehead: boolean; beard?:boolean } & Partial<Record<NaturalRefinementKey, boolean>>;
export const ALL_PORTRAIT_EDIT_REGIONS: PortraitEditRegions = { hair: true, skin: true, contour: true, underEye: true, forehead: true };
export function validPortraitGeometry(value: unknown): value is PortraitGeometry {
  if (!value || typeof value !== "object") return false;
  const g = value as PortraitGeometry;
  const valid = (e: Ellipse) => e && [e.cx,e.cy,e.rx,e.ry].every(Number.isFinite) && e.cx>=0 && e.cx<=1 && e.cy>=0 && e.cy<=1 && e.rx>.001 && e.rx<=.5 && e.ry>.001 && e.ry<=.5;
  const keys:NaturalRefinementKey[]=["brow_opening","lip_vermilion","lower_face_balance","mentolabial","chin_projection"];
  if(g.refinements && (!keys.every(key=>Array.isArray(g.refinements?.[key]) && g.refinements[key].length>0 && g.refinements[key].length<=2 && g.refinements[key].every(valid)) || Object.keys(g.refinements).some(key=>!keys.includes(key as NaturalRefinementKey))))return false;
  return !!valid(g.face) && !!valid(g.hair) && Array.isArray(g.protected) && g.protected.length===5 && g.protected.every(valid);
}
export function portraitGeometry(points: LandmarkList): PortraitGeometry | null {
  const p = (name: keyof typeof LANDMARK) => points[LANDMARK[name]];
  const top=p("foreheadTop"),chin=p("chin"),left=p("faceLeftEdge"),right=p("faceRightEdge");
  const re=p("rightEyeOuter"),ri=p("rightEyeInner"),le=p("leftEyeOuter"),li=p("leftEyeInner");
  const rb=p("rightEyebrowMid"),lb=p("leftEyebrowMid"),nose=p("noseTip"),mouth=p("upperLip");
  if (![top,chin,left,right,re,ri,le,li,rb,lb,nose,mouth].every(Boolean)) return null;
  const fw=Math.abs(left.x-right.x),fh=chin.y-top.y;
  if(fw<=0 || fh<=0)return null;
  const cx=(left.x+right.x)/2;
  const g: PortraitGeometry={
    face:{cx,cy:top.y+fh*.52,rx:fw*.56,ry:fh*.56},
    hair:{cx,cy:Math.max(.01,top.y-fh*.13),rx:fw*.7,ry:fh*.4},
    protected:[
      {cx:(re.x+ri.x)/2,cy:(re.y+ri.y+rb.y)/3,rx:Math.abs(re.x-ri.x)*.8,ry:fh*.09},
      {cx:(le.x+li.x)/2,cy:(le.y+li.y+lb.y)/3,rx:Math.abs(le.x-li.x)*.8,ry:fh*.09},
      {cx:nose.x,cy:nose.y-fh*.04,rx:fw*.15,ry:fh*.17},
      {cx:mouth.x,cy:mouth.y+fh*.02,rx:fw*.23,ry:fh*.09},
      {cx,cy:top.y+fh*.05,rx:fw*.32,ry:fh*.03},
    ],
  };
  const lower=p("lowerLip"),mr=p("mouthRight"),ml=p("mouthLeft"),rj=p("rightJaw"),lj=p("leftJaw");
  if([lower,mr,ml,rj,lj].every(Boolean)){
    const mouthWidth=Math.abs(mr.x-ml.x),lipCy=(mouth.y+lower.y)/2;
    const chinGap=chin.y-lower.y;
    g.refinements={
      brow_opening:[rb,lb].map(b=>({cx:b.x,cy:b.y-fh*.015,rx:fw*.18,ry:fh*.045})),
      lip_vermilion:[{cx:(mr.x+ml.x)/2,cy:lipCy,rx:mouthWidth*.55,ry:Math.max(fh*.025,Math.abs(lower.y-mouth.y)*.7)}],
      mentolabial:[{cx,cy:lower.y+chinGap*.35,rx:mouthWidth*.5,ry:chinGap*.19}],
      chin_projection:[{cx:chin.x,cy:chin.y-chinGap*.2,rx:fw*.17,ry:chinGap*.3}],
      lower_face_balance:[rj,lj].map(j=>({cx:j.x,cy:j.y-fh*.015,rx:fw*.13,ry:fh*.14})),
    };
  }
  return validPortraitGeometry(g)?g:null;
}
export function ellipseWeight(x:number,y:number,e:Ellipse):number {
  const d=Math.sqrt(((x-e.cx)/e.rx)**2+((y-e.cy)/e.ry)**2);
  return d>=1?0:Math.min(1,(1-d)/.15);
}
/** Protect eye/brow, nose and lip regions while allowing the selected appearance changes. */
export function portraitEditWeight(x:number,y:number,g:PortraitGeometry):number {
  const selected=Math.max(ellipseWeight(x,y,g.face),ellipseWeight(x,y,g.hair));
  const protectedWeight=Math.max(...g.protected.map(e=>ellipseWeight(x,y,e)));
  return selected*(1-protectedWeight);
}

const smoothstep=(edge0:number,edge1:number,value:number)=>{
  const t=Math.max(0,Math.min(1,(value-edge0)/(edge1-edge0)));
  return t*t*(3-2*t);
};

/** Targeted edit weights. The hair edit excludes the estimated face oval; face features remain protected. */
export function portraitRegionWeights(x:number,y:number,g:PortraitGeometry,regions:PortraitEditRegions){
  const face=ellipseWeight(x,y,g.face);
  const protectedFeatureWeight=Math.max(...g.protected.slice(0,4).map(e=>ellipseWeight(x,y,e)));
  const foreheadProtection=ellipseWeight(x,y,g.protected[4]);
  const eyeRegions=g.protected.slice(0,2).map(e=>({cx:e.cx,cy:e.cy+e.ry*1.25,rx:e.rx*1.25,ry:e.ry*.9}));
  const underEyeArea=Math.max(...eyeRegions.map(e=>ellipseWeight(x,y,e)));
  const foreheadArea=ellipseWeight(x,y,{cx:g.face.cx,cy:g.face.cy-g.face.ry*.72,rx:g.face.rx*.58,ry:g.face.ry*.17});
  const exposedFace=face*(1-protectedFeatureWeight)*(regions.forehead?1:1-foreheadProtection)*(regions.underEye?1:1-underEyeArea);
  const hairOutline=ellipseWeight(x,y,g.hair);
  const hair=regions.hair ? hairOutline*(1-face) : 0;
  const skin=regions.skin ? exposedFace : 0;
  const underEye=regions.underEye ? face*underEyeArea*(1-protectedFeatureWeight) : 0;
  const forehead=regions.forehead ? face*foreheadArea*(1-protectedFeatureWeight) : 0;
  const normalizedY=(y-(g.face.cy-g.face.ry))/(2*g.face.ry);
  const normalizedX=Math.abs((x-g.face.cx)/g.face.rx);
  const jaw=regions.contour
    ? face*(1-protectedFeatureWeight)*smoothstep(.52,.86,normalizedY)*smoothstep(.48,.88,normalizedX)
    : 0;
  // Soft fullness under the chin sits just below the face oval; without this area a double chin can never be edited.
  const underChin=regions.contour
    ? ellipseWeight(x,y,{cx:g.face.cx,cy:g.face.cy+g.face.ry*.98,rx:g.face.rx*.72,ry:g.face.ry*.3})*(1-protectedFeatureWeight)
    : 0;
  const jawArea=Math.max(jaw,underChin);
  const beard=regions.beard ? Math.max(face*smoothstep(.46,.62,normalizedY),ellipseWeight(x,y,{cx:g.face.cx,cy:g.face.cy+g.face.ry*.98,rx:g.face.rx*.72,ry:g.face.ry*.3}))*(1-protectedFeatureWeight) : 0;
  const selected=(key:NaturalRefinementKey)=>regions[key] && g.refinements ? Math.max(...g.refinements[key].map(e=>ellipseWeight(x,y,e))) : 0;
  // Every added target is separate. Brow patches never open the globe/lid region;
  // other new patches preserve nose and both eye/brow guards.
  const noseGuard=ellipseWeight(x,y,g.protected[2]);
  const eyeGuard=Math.max(...g.protected.slice(0,2).map(e=>ellipseWeight(x,y,{...e,cy:e.cy+e.ry*.35,ry:e.ry*.7})));
  const guards=Math.max(noseGuard,...g.protected.slice(0,2).map(e=>ellipseWeight(x,y,e)));
  const browOpening=selected("brow_opening")*(1-eyeGuard)*(1-noseGuard);
  const lipVermilion=selected("lip_vermilion")*(1-guards);
  const mentolabial=selected("mentolabial")*(1-guards)*(1-ellipseWeight(x,y,g.protected[3]));
  const chinProjection=selected("chin_projection")*(1-protectedFeatureWeight);
  const lowerFaceBalance=selected("lower_face_balance")*(1-protectedFeatureWeight);
  return {hair,skin,jaw:jawArea,underEye,forehead,browOpening,lipVermilion,mentolabial,chinProjection,lowerFaceBalance,beard,
    combined:Math.max(hair,skin,jawArea,underEye,forehead,browOpening,lipVermilion,mentolabial,chinProjection,lowerFaceBalance,beard)};
}
