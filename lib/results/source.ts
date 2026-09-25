/**
 * Which stored thing /results should show. Two flows can leave data in the
 * tab: the assessment (→ consumer result) and the single-photo /analyze
 * debug flow (→ legacy measurement view). The MOST RECENT one wins, so a
 * fresh /analyze run is never hidden behind an older assessment.
 */

export type ResultSource = "snapshot" | "legacy" | "none";

export function chooseResultSource(snapshotCreatedAt: string | null, legacyTimestamp: string | null): ResultSource {
  const snap = snapshotCreatedAt ? Date.parse(snapshotCreatedAt) : Number.NaN;
  const legacy = legacyTimestamp ? Date.parse(legacyTimestamp) : Number.NaN;
  const hasSnap = !Number.isNaN(snap);
  const hasLegacy = !Number.isNaN(legacy);
  if (hasSnap && hasLegacy) return legacy > snap ? "legacy" : "snapshot";
  if (hasSnap) return "snapshot";
  return hasLegacy ? "legacy" : "none";
}
