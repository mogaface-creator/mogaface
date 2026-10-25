"use client";
import { detectFace } from "../facial-analysis/faceLandmarker.ts";
import { foreheadEditRegion, type LocalEditRegion } from "./localEditRegion.ts";
export async function findForeheadRegion(file: File): Promise<LocalEditRegion> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const detected = await detectFace(image);
    if (detected.faces.length !== 1) throw new Error("Use a clear front portrait with exactly one face.");
    const region = foreheadEditRegion(detected.faces[0]);
    if (!region) throw new Error("The forehead could not be located safely. Use a level, front-facing photo.");
    return region;
  } finally { URL.revokeObjectURL(url); }
}

export async function findPortraitGeometry(file: File) {
  const { portraitGeometry } = await import("./portraitGeometry.ts");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image(); image.src = url; await image.decode();
    const detected = await detectFace(image);
    if (detected.faces.length !== 1) throw new Error("Use a clear front portrait with exactly one face.");
    const geometry = portraitGeometry(detected.faces[0]);
    if (!geometry) throw new Error("Could not safely locate the face. Use a level front portrait.");
    return geometry;
  } finally { URL.revokeObjectURL(url); }
}
