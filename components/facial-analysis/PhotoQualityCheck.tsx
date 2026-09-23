import type { PhotoQualityResult } from "@/lib/facial-analysis/types.ts";

export function PhotoQualityCheck({ quality }: { quality: PhotoQualityResult }) {
  if (quality.valid && quality.warnings.length === 0) return null;

  return (
    <div
      role="status"
      className={`rounded-xl border px-5 py-4 text-sm ${
        quality.valid ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30" : "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30"
      }`}
    >
      {quality.errors.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-red-700 dark:text-red-300">
          {quality.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
      {quality.warnings.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-amber-700 dark:text-amber-300">
          {quality.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
