import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Per-route maxDuration is set via route segment config (export const maxDuration = N)
  // in each route file, not here. See app/api/process-submissions/route.ts.
};

export default nextConfig;
