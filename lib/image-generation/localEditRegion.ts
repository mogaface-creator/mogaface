import { LANDMARK } from "../facial-analysis/landmarkMapping.ts";
import type { LandmarkList } from "../facial-analysis/types.ts";
export interface LocalEditRegion { x: number; y: number; width: number; height: number }
export function validLocalEditRegion(value: unknown): value is LocalEditRegion {
  if (!value || typeof value !== "object") return false;
  const r = value as LocalEditRegion;
  return [r.x, r.y, r.width, r.height].every(Number.isFinite) && r.x >= 0 && r.y >= 0 && r.width >= .02 && r.height >= .01 && r.width <= .5 && r.height <= .3 && r.x + r.width <= 1 && r.y + r.height <= 1;
}
/** Conservative central forehead, kept above eyebrows and below the mesh's approximate hairline. */
export function foreheadEditRegion(points: LandmarkList): LocalEditRegion | null {
  const top = points[LANDMARK.foreheadTop];
  const right = points[LANDMARK.rightEyebrowOuter];
  const left = points[LANDMARK.leftEyebrowOuter];
  const browRight = points[LANDMARK.rightEyebrowMid];
  const browLeft = points[LANDMARK.leftEyebrowMid];
  if (![top, right, left, browRight, browLeft].every(Boolean)) return null;
  const browY = Math.min(browRight.y, browLeft.y);
  const height = browY - top.y;
  const width = Math.abs(right.x - left.x);
  if (height <= 0 || width <= 0) return null;
  const region = { x: (right.x + left.x) / 2 - width * .35, y: top.y + height * .2, width: width * .7, height: height * .6 };
  return validLocalEditRegion(region) ? region : null;
}
