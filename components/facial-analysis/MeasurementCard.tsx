interface MeasurementCardProps {
  title: string;
  rows: { label: string; value: string }[];
}

export function MeasurementCard({ title, rows }: MeasurementCardProps) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <h3 className="text-sm font-medium uppercase tracking-wide text-muted">{title}</h3>
      <dl className="mt-4 space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-4">
            <dt className="text-sm text-muted">{row.label}</dt>
            <dd className="font-serif text-lg">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
