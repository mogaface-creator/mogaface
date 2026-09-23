import type { SymmetryResult } from "@/lib/facial-analysis/types.ts";
import { formatRatio } from "./format";

export function SymmetryCard({ symmetry }: { symmetry: SymmetryResult }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-medium uppercase tracking-wide text-muted">Geometric symmetry</h3>
        <span className="font-serif text-2xl">{formatRatio(symmetry.overallSymmetryIndex)}</span>
      </div>
      <dl className="mt-4 space-y-3">
        {symmetry.metrics.map((metric) => (
          <div key={metric.metric} className="flex items-baseline justify-between gap-4">
            <dt className="text-sm text-muted">{metric.metric}</dt>
            <dd className="text-sm">{formatRatio(metric.symmetryIndex)} / 100</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-xs leading-5 text-muted">
        A measure of left/right mirror-symmetry in this photo&apos;s geometry — not a judgment of appearance.
      </p>
    </div>
  );
}
