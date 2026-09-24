import type { GrayImage } from "./regions.ts";

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
export function sampleMeanBrightness(image: HTMLImageElement | HTMLCanvasElement): number | undefined {
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

/**
 * Luminance copy of the image, scaled so its longest side is at most
 * `maxSide` px. Used by the region-texture/luminance measurements; returns
 * undefined (never throws) when the canvas is unavailable or tainted.
 */
export function sampleGrayImage(image: HTMLImageElement | HTMLCanvasElement, maxSide = 800): GrayImage | undefined {
  const srcW = image instanceof HTMLImageElement ? image.naturalWidth : image.width;
  const srcH = image instanceof HTMLImageElement ? image.naturalHeight : image.height;
  if (!srcW || !srcH) return undefined;
  const scale = Math.min(1, maxSide / Math.max(srcW, srcH));
  const width = Math.max(1, Math.round(srcW * scale));
  const height = Math.max(1, Math.round(srcH * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return undefined;
  try {
    ctx.drawImage(image, 0, 0, width, height);
    const { data } = ctx.getImageData(0, 0, width, height);
    const gray = new Uint8ClampedArray(width * height);
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
    return { width, height, data: gray };
  } catch {
    return undefined;
  }
}
