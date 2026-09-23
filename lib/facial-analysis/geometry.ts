/**
 * Pure geometry primitives. No React, no browser APIs, no MediaPipe types —
 * just numbers and Point2D in/out so this stays trivially unit-testable.
 */

import type { Point2D } from "./types.ts";

export function distance(a: Point2D, b: Point2D): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function horizontalDistance(a: Point2D, b: Point2D): number {
  return Math.abs(b.x - a.x);
}

export function verticalDistance(a: Point2D, b: Point2D): number {
  return Math.abs(b.y - a.y);
}

export function midpoint(a: Point2D, b: Point2D): Point2D {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Angle at vertex `b`, formed by rays b->a and b->c, in degrees. */
export function angle(a: Point2D, b: Point2D, c: Point2D): number {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const mag1 = Math.hypot(v1.x, v1.y);
  const mag2 = Math.hypot(v2.x, v2.y);
  if (mag1 === 0 || mag2 === 0) return NaN;
  const cos = (v1.x * v2.x + v1.y * v2.y) / (mag1 * mag2);
  const clamped = Math.min(1, Math.max(-1, cos));
  return (Math.acos(clamped) * 180) / Math.PI;
}

/** a / b, or null when b is zero (never returns Infinity/NaN into the pipeline). */
export function ratio(a: number, b: number): number | null {
  if (b === 0) return null;
  return a / b;
}

/** |a - b| as a percentage of the larger of the two, or null if both are zero. */
export function percentageDifference(a: number, b: number): number | null {
  const denom = Math.max(a, b);
  if (denom === 0) return null;
  return (Math.abs(a - b) / denom) * 100;
}

/** |a - b| / reference, as a percentage — for symmetry differences normalized against face width. */
export function normalizedDifference(a: number, b: number, reference: number): number | null {
  if (reference === 0) return null;
  return (Math.abs(a - b) / reference) * 100;
}

export interface BoundingBox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** Axis-aligned bounding box of a set of points. Returns all-Infinity fields for an empty input. */
export function boundingBox(points: Point2D[]): BoundingBox {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, maxX, minY, maxY };
}
