import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { prepareLocalEdit, compositeLocalEdit } from "../../lib/image-generation/localEdit.ts";
import { validLocalEditRegion, foreheadEditRegion } from "../../lib/image-generation/localEditRegion.ts";
import { LANDMARK } from "../../lib/facial-analysis/landmarkMapping.ts";

test("local edit accepts only bounded regions and derives the forehead without touching eyebrows", () => {
  for (const r of [null, {}, {x:NaN,y:0,width:.2,height:.1}, {x:.9,y:0,width:.2,height:.1}]) assert.equal(validLocalEditRegion(r), false);
  const points = Array.from({length:478}, () => ({x:.5,y:.5,z:0}));
  points[LANDMARK.foreheadTop] = {x:.5,y:.2,z:0};
  points[LANDMARK.rightEyebrowOuter] = {x:.3,y:.4,z:0};
  points[LANDMARK.leftEyebrowOuter] = {x:.7,y:.4,z:0};
  points[LANDMARK.rightEyebrowMid] = {x:.4,y:.4,z:0};
  points[LANDMARK.leftEyebrowMid] = {x:.6,y:.4,z:0};
  const region = foreheadEditRegion(points)!;
  assert.ok(region.y > .2);
  assert.ok(region.y + region.height < .4);
});

test("even a completely wrong generated crop cannot change any pixel outside the forehead ellipse", async () => {
  const width=240,height=320;
  const original = Buffer.alloc(width*height*3);
  for(let i=0;i<original.length;i++) original[i]=70+(i%100);
  const source=await sharp(original,{raw:{width,height,channels:3}}).png().toBuffer();
  const prepared=await prepareLocalEdit(source,{x:.35,y:.18,width:.3,height:.12});
  const candidate=await sharp({create:{width:512,height:512,channels:3,background:"#ffffff"}}).png().toBuffer();
  const result=await compositeLocalEdit(prepared,candidate);
  const meta=await sharp(result).metadata();
  assert.equal(meta.width,width);assert.equal(meta.height,height);assert.equal(meta.format,"png");
  const final=await sharp(result).removeAlpha().raw().toBuffer();
  const r=prepared.rect,cx=r.left+r.width/2,cy=r.top+r.height/2;
  let changed=0;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const outside=((x-cx)/(r.width/2))**2+((y-cy)/(r.height/2))**2>=1;
    for(let c=0;c<3;c++){
      const i=(y*width+x)*3+c;
      if(outside)assert.equal(final[i],original[i],`unchanged ${x},${y}`);
      assert.ok(Math.abs(final[i]-original[i])<=12);
      if(final[i]!==original[i])changed++;
    }
  }
  assert.ok(changed>0);
  const mask=await sharp(prepared.mask).raw().toBuffer();
  assert.equal(mask[3],255);
  const mx=Math.round(cx-prepared.crop.left),my=Math.round(cy-prepared.crop.top);
  assert.equal(mask[(my*prepared.crop.width+mx)*4+3],0);
});
