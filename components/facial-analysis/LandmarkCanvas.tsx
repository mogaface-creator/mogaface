"use client";

import { useEffect, useRef, useState } from "react";
import type { Point2D } from "@/lib/facial-analysis/types.ts";

interface LandmarkCanvasProps {
  imageUrl: string;
  landmarks: Point2D[];
}

export function LandmarkCanvas({ imageUrl, landmarks }: LandmarkCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showLandmarks, setShowLandmarks] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const image = new window.Image();
    image.src = imageUrl;
    image.onerror = () => setLoadFailed(true);
    image.onload = () => {
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0);

      if (showLandmarks) {
        const radius = Math.max(1.5, canvas.width * 0.0025);
        ctx.fillStyle = "rgba(205, 216, 198, 0.9)";
        for (const point of landmarks) {
          ctx.beginPath();
          ctx.arc(point.x * canvas.width, point.y * canvas.height, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };
  }, [imageUrl, landmarks, showLandmarks]);

  if (loadFailed) {
    return (
      <p className="rounded-2xl border border-border bg-surface px-5 py-8 text-center text-sm text-muted">
        Image preview is unavailable (photos aren&apos;t stored, so a page reload clears it). Your analysis
        results below are unaffected.
      </p>
    );
  }

  return (
    <div>
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <canvas ref={canvasRef} className="h-auto w-full" />
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm text-muted">
        <input
          type="checkbox"
          checked={showLandmarks}
          onChange={(e) => setShowLandmarks(e.target.checked)}
          className="h-4 w-4 rounded border-border accent-[var(--accent)]"
        />
        Show facial landmarks
      </label>
    </div>
  );
}
