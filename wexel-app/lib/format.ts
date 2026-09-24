export function fmtPrice(n: number) {
  if (!n) return "$0.00";
  if (n >= 1) return "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return "$" + n.toPrecision(3);
}

// $485K, $1.2M, $3.4T
export function compact(n: number) {
  if (!n || !isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
  if (a >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

// Split a dollar amount so the cents can be dimmed.
export function splitUsd(n: number) {
  const [w, c] = Math.abs(n).toFixed(2).split(".");
  return { sign: n < 0 ? "-" : "", whole: Number(w).toLocaleString(), cents: c };
}

export function fmtAmount(n: number) {
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  return n.toPrecision(3);
}
