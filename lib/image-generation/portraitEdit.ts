import sharp from "sharp";
import { ALL_PORTRAIT_EDIT_REGIONS, portraitRegionWeights, validPortraitGeometry, type PortraitEditRegions, type PortraitGeometry } from "./portraitGeometry.ts";
export async function preparePortraitEdit(source:Buffer, geometry:PortraitGeometry, regions:PortraitEditRegions=ALL_PORTRAIT_EDIT_REGIONS){
  if(!validPortraitGeometry(geometry))throw new Error("invalid_portrait_geometry");
  const normalized=await sharp(source).rotate().removeAlpha().toColourspace("srgb").png().toBuffer();
  const {width,height}=await sharp(normalized).metadata();
  if(!width||!height)throw new Error("invalid_source");
  const maskRaw=Buffer.alloc(width*height*4,255);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const weights=portraitRegionWeights((x+.5)/width,(y+.5)/height,geometry,regions);
    if(weights.combined>.035)maskRaw[(y*width+x)*4+3]=0;
  }
  const mask=await sharp(maskRaw,{raw:{width,height,channels:4}}).png().toBuffer();
  return {normalized,image:normalized,mask,width,height,geometry,regions};
}
export async function compositePortraitEdit(prepared:Awaited<ReturnType<typeof preparePortraitEdit>>,candidate:Uint8Array):Promise<Buffer>{
  const original=await sharp(prepared.normalized).removeAlpha().toColourspace("srgb").raw().toBuffer();
  const candidateMetadata=await sharp(candidate).metadata();
  if(!candidateMetadata.width||!candidateMetadata.height||Math.abs(candidateMetadata.width/candidateMetadata.height-prepared.width/prepared.height)>.015)throw new Error(`candidate_aspect_mismatch:${candidateMetadata.width||0}x${candidateMetadata.height||0}:${prepared.width}x${prepared.height}`);
  const generated=await sharp(candidate).resize(prepared.width,prepared.height,{fit:"fill"}).removeAlpha().toColourspace("srgb").raw().toBuffer();
  const result=Buffer.from(original);
  const {width,height,geometry,regions}=prepared;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const weights=portraitRegionWeights((x+.5)/width,(y+.5)/height,geometry,regions);
    const alpha=Math.max(weights.hair*.88,weights.skin*.38,weights.jaw*.42,weights.underEye*.32,weights.forehead*.35);
    if(alpha<.005)continue;
    const i=(y*width+x)*3;
    for(let c=0;c<3;c++)result[i+c]=Math.round(original[i+c]*(1-alpha)+generated[i+c]*alpha);
  }
  return sharp(result,{raw:{width,height,channels:3}}).png().toBuffer();
}
