const THIRDS = [38, 65, 92];
const POINTS = [
  { x: 32, y: 55 },
  { x: 68, y: 55 },
  { x: 50, y: 72 },
  { x: 36, y: 84 },
  { x: 64, y: 84 },
  { x: 26, y: 62 },
  { x: 74, y: 62 },
];

/**
 * Bespoke facial-geometry diagram used as the hero visual: an outline with
 * thirds lines, a symmetry axis and landmark points, echoing what the
 * analysis actually measures rather than a stock photo of a face.
 */
export function MeasurementDiagram() {
  return (
    <svg
      viewBox="0 0 100 130"
      className="h-full w-full"
      role="img"
      aria-label="Diagram of facial thirds, symmetry axis and measurement points"
    >
      <ellipse cx="50" cy="65" rx="34" ry="48" fill="none" stroke="var(--border)" strokeWidth="1" />

      <line x1="50" y1="12" x2="50" y2="118" stroke="var(--border)" strokeWidth="0.6" strokeDasharray="2 3" />

      {THIRDS.map((y) => (
        <line key={y} x1="14" y1={y} x2="86" y2={y} stroke="var(--border)" strokeWidth="0.6" />
      ))}

      {POINTS.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="1.4" fill="var(--accent)" opacity="0.85" />
      ))}

      <line x1="32" y1="55" x2="68" y2="55" stroke="var(--accent)" strokeWidth="0.7" opacity="0.6" />
      <line x1="36" y1="84" x2="64" y2="84" stroke="var(--accent)" strokeWidth="0.7" opacity="0.6" />
    </svg>
  );
}
