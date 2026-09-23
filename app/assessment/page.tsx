"use client";

import dynamic from "next/dynamic";

// The assessment wizard reads/writes localStorage and blob URLs from its
// very first render — there is no meaningful server-rendered version of it,
// so it's loaded client-only rather than worked around with effects.
const AssessmentShell = dynamic(() => import("@/components/assessment/AssessmentShell").then((m) => m.AssessmentShell), {
  ssr: false,
  loading: () => <div className="flex-1" />,
});

export default function AssessmentPage() {
  return <AssessmentShell />;
}
