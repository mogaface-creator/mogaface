"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";

/**
 * The live camera preview. `autoPlay playsInline muted` (muted is required for
 * inline autoplay on phones; there is no audio track anyway). The picture is
 * mirrored for a natural selfie feel — that is DISPLAY ONLY: captured photos
 * are drawn from the raw video frame and are not mirrored.
 *
 * The container takes the stream's real aspect ratio, so what the person sees
 * is exactly the frame the analysis sees (no hidden cropping).
 */
export function CameraPreview({
  stream,
  videoRef,
  mirrored = true,
  children,
}: {
  stream: MediaStream | null;
  videoRef?: RefObject<HTMLVideoElement | null>;
  mirrored?: boolean;
  children?: ReactNode;
}) {
  const internal = useRef<HTMLVideoElement | null>(null);
  const ref = videoRef ?? internal;
  const [aspect, setAspect] = useState(3 / 4);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.srcObject = stream;
    if (stream) void video.play().catch(() => {}); // a blocked autoplay must not throw
    return () => {
      video.srcObject = null; // detach so the element does not keep the camera alive
    };
  }, [stream, ref]);

  return (
    <div
      className="relative mx-auto w-full max-w-md overflow-hidden rounded-3xl bg-black sm:max-w-lg"
      style={{ aspectRatio: aspect, maxHeight: "72vh" }}
      data-testid="camera-preview"
    >
      <video
        ref={ref}
        autoPlay
        playsInline
        muted
        aria-label="Live camera preview"
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          if (v.videoWidth && v.videoHeight) setAspect(v.videoWidth / v.videoHeight);
        }}
        className="h-full w-full object-contain"
        style={mirrored ? { transform: "scaleX(-1)" } : undefined}
      />
      {children}
    </div>
  );
}
