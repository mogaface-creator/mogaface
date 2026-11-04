import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep a private local report preview separate from production build output.
  distDir: process.env.REPORT_PREVIEW_DATA ? ".next-report-preview" : ".next",
  // Per-route maxDuration is set via route segment config (export const maxDuration = N)
  // in each route file, not here. See app/api/process-submissions/route.ts.
};

export default nextConfig;
