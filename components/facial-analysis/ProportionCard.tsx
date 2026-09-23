import type { ProportionResult } from "@/lib/facial-analysis/types.ts";
import { formatRatio } from "./format";

export function ProportionCard({ proportions }: { proportions: ProportionResult }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <h3 className="text-sm font-medium uppercase tracking-wide text-muted">Proportions</h3>
      <dl className="mt-4 space-y-3">
        {proportions.metrics.map((metric) => (
          <div key={metric.metric} className="flex items-baseline justify-between gap-4">
            <dt className="text-sm text-muted" title={metric.description}>
              {metric.metric}
            </dt>
            <dd className="font-serif text-lg">{formatRatio(metric.value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
