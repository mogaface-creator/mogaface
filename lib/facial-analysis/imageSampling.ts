/**
 * Small browser-only image helpers shared by the single-photo and
 * multi-photo pipelines. Client-only, like faceLandmarker.ts — relies on
 * the DOM Image element and canvas.
 */

/** Decodes a blob/object URL into a loaded HTMLImageElement, or rejects with a user-facing message. */
export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read this image. Try a different photo."));
    img.src = url;
  });
}

/** Downsamples the image onto a small canvas to estimate average brightness cheaply. */
export function sampleMeanBrightness(image: HTMLImageElement): number | undefined {
  const canvas = document.createElement("canvas");
  const size = 32;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return undefined;
  try {
    ctx.drawImage(image, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);
    let total = 0;
    for (let i = 0; i < data.length; i += 4) {
      total += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
    return total / (data.length / 4);
  } catch {
    return undefined; // canvas can be tainted in rare cross-origin edge cases; brightness is optional
  }
}
