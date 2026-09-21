"use client";

type Point = { t: number; c: number };

export function PriceChart({ data, up }: { data: Point[]; up: boolean }) {
  if (data.length < 2) {
    return (
      <div style={{
        height: 150, display: "grid", placeItems: "center",
        color: "var(--faint)", fontSize: 12.5,
      }}>No price history available</div>
    );
  }

  const W = 340, H = 150, PAD = 6;
  const prices = data.map(d => d.c);
  const min = Math.min(...prices), max = Math.max(...prices);
  const range = max - min || 1;

  // Map each point into the SVG box.
  const pts = data.map((d, i) => {
    const x = PAD + (i / (data.length - 1)) * (W - PAD * 2);
    const y = PAD + (1 - (d.c - min) / range) * (H - PAD * 2);
    return [x, y];
  });

  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  // Close the path along the bottom so it can be filled as a soft area.
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${H} L${pts[0][0].toFixed(1)},${H} Z`;

  const color = up ? "var(--good)" : "var(--bad)";
  const id = up ? "gUp" : "gDown";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={150}
         preserveAspectRatio="none" style={{ display: "block" }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.8"
            strokeLinejoin="round" strokeLinecap="round"
            vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
