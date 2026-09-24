"use client";

import Link from "next/link";

export function Logo({ src, label, size = 44 }: { src?: string; label: string; size?: number }) {
  if (src) {
    return <img src={src} alt="" width={size} height={size}
                style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover",
                         flexShrink: 0, background: "var(--raised)" }} />;
  }
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, background: "var(--raised)",
                  display: "grid", placeItems: "center", fontWeight: 600, fontSize: size * 0.32 }}>
      {label.slice(0, 2)}
    </div>
  );
}

export function Change({ pct, suffix, size = 13 }: { pct?: number | null; suffix?: string; size?: number }) {
  if (pct === null || pct === undefined || !isFinite(pct)) {
    return <span style={{ color: "var(--faint)", fontSize: size }}>—</span>;
  }
  const up = pct >= 0;
  return (
    <span className="num" style={{ color: up ? "var(--good)" : "var(--bad)", fontSize: size,
                                   fontWeight: 500, whiteSpace: "nowrap" }}>
      <span style={{ fontSize: size * 0.72, marginRight: 4 }}>{up ? "▲" : "▼"}</span>
      {Math.abs(pct).toFixed(2)}%
      {suffix && <span style={{ color: "var(--faint)", fontWeight: 400 }}>{suffix}</span>}
    </span>
  );
}

// One asset row, straight on the background — no card.
export function AssetRow({ href, logo, title, sub, price, change }: {
  href: string; logo?: string; title: string; sub: React.ReactNode; price: string; change: React.ReactNode;
}) {
  return (
    <Link href={href} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 0",
                               textDecoration: "none", color: "inherit" }}>
      <Logo src={logo} label={title} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 16, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{title}</div>
        <div className="num" style={{ fontSize: 13, color: "var(--muted)", marginTop: 3 }}>{sub}</div>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div className="num" style={{ fontSize: 16, fontWeight: 600 }}>{price}</div>
        <div style={{ marginTop: 3 }}>{change}</div>
      </div>
    </Link>
  );
}

export function Chips({ items, value, onChange }: {
  items: { id: string; label: React.ReactNode }[]; value: string; onChange: (id: string) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none",
                  margin: "0 -20px", padding: "0 20px 2px" }}>
      {items.map((i) => {
        const on = i.id === value;
        return (
          <button key={i.id} onClick={() => onChange(i.id)} style={{
            flexShrink: 0, padding: "9px 16px", borderRadius: 14, cursor: "pointer",
            fontSize: 14, fontWeight: on ? 600 : 500, fontFamily: "var(--sans)",
            border: `1px solid ${on ? "transparent" : "var(--line2)"}`,
            background: on ? "var(--selected)" : "transparent",
            color: on ? "var(--ink)" : "var(--muted)",
            display: "inline-flex", alignItems: "center", gap: 6,
          }}>{i.label}</button>
        );
      })}
    </div>
  );
}

export function UnderTabs({ items, value, onChange }: {
  items: { id: string; label: React.ReactNode }[]; value: string; onChange: (id: string) => void;
}) {
  return (
    <div style={{ display: "flex", borderBottom: "1px solid var(--line)", margin: "0 -20px" }}>
      {items.map((i) => {
        const on = i.id === value;
        return (
          <button key={i.id} onClick={() => onChange(i.id)} style={{
            flex: 1, padding: "14px 0 13px", background: "none", border: 0, cursor: "pointer",
            fontSize: 16, fontWeight: 600, fontFamily: "var(--sans)",
            color: on ? "var(--ink)" : "var(--faint)",
            boxShadow: on ? "inset 0 -3px 0 var(--accent)" : "none",
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 7,
          }}>{i.label}</button>
        );
      })}
    </div>
  );
}

export function BigUsd({ value, size = 36, dim = true }: { value: number; size?: number; dim?: boolean }) {
  const [w, c] = Math.abs(value).toFixed(2).split(".");
  return (
    <span className="num" style={{ fontSize: size, fontWeight: 600, lineHeight: 1, letterSpacing: "-0.03em" }}>
      {value < 0 ? "-" : ""}${Number(w).toLocaleString()}
      <span style={{ color: dim ? "var(--faint)" : "inherit" }}>.{c}</span>
    </span>
  );
}
