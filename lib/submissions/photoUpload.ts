/** Decode using the browser's available image APIs, then bound the upload size. */
async function decodePhoto(file: File): Promise<{source: CanvasImageSource; width: number; height: number; release: () => void}> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return {source:bitmap,width:bitmap.width,height:bitmap.height,release:()=>bitmap.close()};
    } catch {
      // Some mobile browsers decode a format in <img> but not ImageBitmap.
    }
  }
  const url=URL.createObjectURL(file);
  try {
    const image=await new Promise<HTMLImageElement>((resolve,reject)=>{
      const element=new Image();
      element.onload=()=>resolve(element);
      element.onerror=()=>reject(new Error("photo_preparation_failed"));
      element.src=url;
    });
    return {source:image,width:image.naturalWidth,height:image.naturalHeight,release:()=>URL.revokeObjectURL(url)};
  } catch(error) {URL.revokeObjectURL(url);throw error;}
}

export async function preparePhotoUpload(file: File): Promise<Blob> {
  const image=await decodePhoto(file);
  try {
    if(image.width<=0 || image.height<=0)throw new Error("photo_preparation_failed");
    const scale=Math.min(1,1200/Math.max(image.width,image.height));
    const canvas=document.createElement("canvas");
    canvas.width=Math.max(1,Math.round(image.width*scale));
    canvas.height=Math.max(1,Math.round(image.height*scale));
    const ctx=canvas.getContext("2d");
    if(!ctx)throw new Error("photo_preparation_failed");
    ctx.drawImage(image.source,0,0,canvas.width,canvas.height);
    const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,"image/jpeg",0.82));
    if(!blob || blob.size>1_100_000)throw new Error("photo_too_large");
    return blob;
  } finally {image.release();}
}
