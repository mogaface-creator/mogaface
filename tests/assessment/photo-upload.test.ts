import test from "node:test";
import assert from "node:assert/strict";
import { preparePhotoUpload } from "../../lib/submissions/photoUpload.ts";

async function harness(mode:"bitmap"|"missing"|"rejected"|"unreadable",oversize=false){
  const names=["createImageBitmap","document","Image"] as const;
  const previous=names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)] as const);
  const create=URL.createObjectURL,revoke=URL.revokeObjectURL;
  let closed=0,revoked=0,draws=0;
  const canvas={width:0,height:0,getContext:()=>({drawImage:()=>{draws++;}}),
    toBlob:(callback:(blob:Blob)=>void,type:string)=>callback(new Blob([new Uint8Array(oversize?1_100_001:100)],{type}))};
  class TestImage {
    naturalWidth=2400;naturalHeight=3200;
    onload:(()=>void)|null=null;onerror:(()=>void)|null=null;
    set src(value:string){assert.equal(value,"blob:test-photo");queueMicrotask(()=>mode==="unreadable"?this.onerror?.():this.onload?.());}
  }
  const replace=(name:string,value:unknown)=>Object.defineProperty(globalThis,name,{configurable:true,writable:true,value});
  replace("createImageBitmap",mode==="missing"||mode==="unreadable"?undefined:async()=>{
    if(mode==="rejected")throw new Error("browser decoder unavailable");
    return {width:2400,height:3200,close:()=>{closed++;}};
  });
  replace("document",{createElement:()=>canvas});replace("Image",TestImage);
  URL.createObjectURL=()=>"blob:test-photo";URL.revokeObjectURL=()=>{revoked++;};
  try {
    const operation=preparePhotoUpload(new File(["test"],"portrait.jpg",{type:"image/jpeg"}));
    if(mode==="unreadable"||oversize){
      await assert.rejects(operation,/photo_preparation_failed|photo_too_large/);
    }else{
      const blob=await operation;
      assert.equal(blob.type,"image/jpeg");assert.equal(canvas.width,900);assert.equal(canvas.height,1200);assert.equal(draws,1);
    }
    assert.equal(closed,mode==="bitmap"?1:0);
    assert.equal(revoked,mode==="bitmap"?0:1);
  } finally {
    for(const [name,descriptor] of previous){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else Reflect.deleteProperty(globalThis,name);}
    URL.createObjectURL=create;URL.revokeObjectURL=revoke;
  }
}
test("photo upload bounds modern-browser images and releases decoded resources",()=>harness("bitmap"));
test("photo upload works without ImageBitmap support",()=>harness("missing"));
test("photo upload falls back when the browser bitmap decoder rejects a photo",()=>harness("rejected"));
test("photo upload rejects unreadable and oversized output and releases resources",async()=>{
  await harness("unreadable");await harness("bitmap",true);await harness("missing",true);
});
