"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";

interface BeforeAfterToggleProps {
  beforeSrc: string;
  afterSrc: string;
  beforeLabel?: string;
  afterLabel?: string;
  aspectRatio?: string;
  className?: string;
  autoCycle?: boolean;
  cycleIntervalMs?: number;
}

export function BeforeAfterToggle({
  beforeSrc,
  afterSrc,
  beforeLabel = "Baseline (Before)",
  afterLabel = "Targeted Simulation (After)",
  aspectRatio = "aspect-[4/5]",
  className = "",
  autoCycle = true,
  cycleIntervalMs = 3500,
}: BeforeAfterToggleProps) {
  const [sliderPosition, setSliderPosition] = useState<number>(50);
  const [isInteracting, setIsInteracting] = useState<boolean>(false);
  const [mode, setMode] = useState<"slider" | "toggle">("slider");
  const [isShowingAfter, setIsShowingAfter] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-cycle for toggle mode when not actively interacting
  useEffect(() => {
    if (!autoCycle || mode !== "toggle" || isInteracting) return;
    const interval = setInterval(() => {
      setIsShowingAfter((prev) => !prev);
    }, cycleIntervalMs);
    return () => clearInterval(interval);
  }, [autoCycle, mode, isInteracting, cycleIntervalMs]);

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPosition(percent);
  }, []);

  const handleTouchMove = (e: React.TouchEvent) => {
    setIsInteracting(true);
    handleMove(e.touches[0].clientX);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (e.buttons === 1 || isInteracting) {
      handleMove(e.clientX);
    }
  };

  return (
    <div className={`relative flex flex-col ${className}`}>
      {/* Mode Switcher Tabs */}
      <div className="mb-2 flex items-center justify-between px-1">
        <div className="flex rounded-full bg-surface-warm p-0.5 border border-border text-[11px] font-medium text-muted">
          <button
            type="button"
            onClick={() => setMode("slider")}
            className={`rounded-full px-3 py-1 transition-all ${
              mode === "slider" ? "bg-accent text-white shadow-xs" : "hover:text-foreground"
            }`}
          >
            Drag Slider
          </button>
          <button
            type="button"
            onClick={() => setMode("toggle")}
            className={`rounded-full px-3 py-1 transition-all ${
              mode === "toggle" ? "bg-accent text-white shadow-xs" : "hover:text-foreground"
            }`}
          >
            Tap to Morph
          </button>
        </div>
        <span className="text-[11px] tracking-wide text-muted hidden sm:inline">
          {mode === "slider" ? "Slide left/right to compare" : "Click anywhere to toggle"}
        </span>
      </div>

      {/* Main Comparison Container */}
      <div
        ref={containerRef}
        onClick={() => {
          if (mode === "toggle") {
            setIsInteracting(true);
            setIsShowingAfter((prev) => !prev);
          }
        }}
        onMouseDown={() => setIsInteracting(true)}
        onMouseUp={() => setIsInteracting(false)}
        onMouseLeave={() => setIsInteracting(false)}
        onMouseMove={handleMouseMove}
        onTouchStart={() => setIsInteracting(true)}
        onTouchEnd={() => setIsInteracting(false)}
        onTouchMove={handleTouchMove}
        className={`group relative w-full ${aspectRatio} select-none overflow-hidden rounded-3xl border border-border/80 bg-surface shadow-elevated cursor-ew-resize`}
      >
        {mode === "slider" ? (
          <>
            {/* After Image (Full width background) */}
            <div className="absolute inset-0">
              <Image
                src={afterSrc}
                alt={afterLabel}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover object-center pointer-events-none"
                priority
              />
              <span className="absolute bottom-3 right-3 rounded-full bg-accent/90 backdrop-blur-md px-3 py-1 text-[11px] font-bold tracking-wide text-white shadow-sm pointer-events-none">
                {afterLabel}
              </span>
            </div>

            {/* Before Image (Clipped overlay using clip-path) */}
            <div
              className="absolute inset-0 overflow-hidden pointer-events-none"
              style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
            >
              <Image
                src={beforeSrc}
                alt={beforeLabel}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover object-center pointer-events-none"
                priority
              />
              <span className="absolute bottom-3 left-3 rounded-full bg-dark-surface/90 backdrop-blur-md px-3 py-1 text-[11px] font-bold tracking-wide text-dark-foreground shadow-sm pointer-events-none whitespace-nowrap">
                {beforeLabel}
              </span>
            </div>

            {/* Divider Line & Draggable Handle */}
            <div
              className="absolute top-0 bottom-0 z-20 w-0.5 bg-white shadow-[0_0_10px_rgba(0,0,0,0.5)] pointer-events-none"
              style={{ left: `${sliderPosition}%` }}
            >
              <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-accent text-white shadow-elevated">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                  <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                  <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </>
        ) : (
          /* Tap-to-Toggle Cross-Fade Mode */
          <>
            <Image
              src={beforeSrc}
              alt={beforeLabel}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className={`object-cover object-center pointer-events-none transition-opacity duration-700 ease-in-out ${
                isShowingAfter ? "opacity-0" : "opacity-100"
              }`}
              priority
            />
            <Image
              src={afterSrc}
              alt={afterLabel}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className={`object-cover object-center pointer-events-none transition-opacity duration-700 ease-in-out ${
                isShowingAfter ? "opacity-100" : "opacity-0"
              }`}
              priority
            />

            {/* Toggle Badge */}
            <div className="absolute top-4 left-4 z-10 pointer-events-none">
              <span
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold tracking-wide transition-all shadow-md ${
                  isShowingAfter
                    ? "bg-accent text-white"
                    : "bg-dark-surface/90 text-dark-foreground backdrop-blur-md"
                }`}
              >
                {isShowingAfter ? afterLabel : beforeLabel}
              </span>
            </div>

            <div className="absolute bottom-4 inset-x-0 flex justify-center pointer-events-none">
              <span className="rounded-full bg-black/60 backdrop-blur-md px-4 py-1.5 text-xs font-medium text-white shadow-lg">
                Tap anywhere to see {isShowingAfter ? "Baseline" : "Simulation"}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
