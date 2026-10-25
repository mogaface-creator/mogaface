import sharp from "sharp";
import { portraitEditWeight, validPortraitGeometry, type PortraitGeometry } from "./portraitGeometry.ts";
export async function preparePortraitEdit(source:Buffer, geometry:PortraitGeometry){
  if(!validPortraitGeometry(geometry))throw new Error("invalid_portrait_geometry");
  const normalized=await sharp(source).rotate().removeAlpha().toColourspace("srgb").png().toBuffer();
  const {width,height}=await sharp(normalized).metadata();
  if(!width||!height)throw new Error("invalid_source");
  const minX=Math.max(0,Math.min(geometry.face.cx-geometry.face.rx,geometry.hair.cx-geometry.hair.rx));
  const maxX=Math.min(1,Math.max(geometry.face.cx+geometry.face.rx,geometry.hair.cx+geometry.hair.rx));
  const minY=Math.max(0,Math.min(geometry.face.cy-geometry.face.ry,geometry.hair.cy-geometry.hair.ry));
  const maxY=Math.min(1,Math.max(geometry.face.cy+geometry.face.ry,geometry.hair.cy+geometry.hair.ry));
  const crop={left:Math.floor(minX*width),top:Math.floor(minY*height),width:Math.min(width-Math.floor(minX*width),Math.ceil((maxX-minX)*width)),height:Math.min(height-Math.floor(minY*height),Math.ceil((maxY-minY)*height))};
  const image=await sharp(normalized).extract(crop).png().toBuffer();
  const maskRaw=Buffer.alloc(crop.width*crop.height*4,255);
  for(let y=0;y<crop.height;y++)for(let x=0;x<crop.width;x++){
    const a=portraitEditWeight((x+crop.left)/width,(y+crop.top)/height,geometry);
    if(a>.05)maskRaw[(y*crop.width+x)*4+3]=0;
  }
  const mask=await sharp(maskRaw,{raw:{width:crop.width,height:crop.height,channels:4}}).png().toBuffer();
  return {normalized,image,mask,crop,width,height,geometry};
}
export async function compositePortraitEdit(prepared:Awaited<ReturnType<typeof preparePortraitEdit>>,candidate:Uint8Array):Promise<Buffer>{
  const original=await sharp(prepared.normalized).raw().toBuffer();
  const generated=await sharp(candidate).resize(prepared.crop.width,prepared.crop.height,{fit:"fill"}).removeAlpha().toColourspace("srgb").raw().toBuffer();
  const result=Buffer.from(original);
  const {crop,width,height,geometry}=prepared;
  for(let y=0;y<crop.height;y++)for(let x=0;x<crop.width;x++){
    const alpha=portraitEditWeight((x+crop.left)/width,(y+crop.top)/height,geometry);
    if(alpha===0)continue;
    const oi=((y+crop.top)*width+x+crop.left)*3,gi=(y*crop.width+x)*3;
    // Visible edit: no twelve-level cap. Protected features and surrounding photograph remain original.
    for(let c=0;c<3;c++)result[oi+c]=Math.round(original[oi+c]*(1-alpha)+generated[gi+c]*alpha);
  }
  return sharp(result,{raw:{width,height,channels:3}}).png().toBuffer();
}
