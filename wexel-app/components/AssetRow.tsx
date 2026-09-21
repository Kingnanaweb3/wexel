"use client";

import Link from "next/link";

export type AssetRowProps = {
  href?: string;
  ticker: string;
  name: string;
  price: number;
  icon?: string;
  note?: string;
  tone?: "good" | "bad" | "warn" | "faint";
  onClick?: () => void;
};

export function AssetRow(p: AssetRowProps) {
  const color = {
    good: "var(--good)", bad: "var(--bad)",
    warn: "var(--warn)", faint: "var(--faint)",
  }[p.tone ?? "faint"];

  const inner = (
    <>
      {p.icon ? (
        <img src={p.icon} alt="" width={36} height={36}
             style={{ borderRadius: 10, flexShrink: 0, background: "#222" }} />
      ) : (
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: "rgba(255,255,255,.06)", display: "grid",
          placeItems: "center", fontSize: 12, fontWeight: 500,
        }}>{p.ticker.slice(0, 2)}</div>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: var_step(1), fontWeight: 450 }}>{p.ticker}</div>
        <div style={{
          fontSize: 12, color: "var(--faint)", whiteSpace: "nowrap",
          overflow: "hidden", textOverflow: "ellipsis", marginTop: 1,
        }}>{p.name}</div>
      </div>

      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div className="num" style={{ fontSize: 14 }}>
          ${p.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </div>
        {p.note && (
          <div className="num" style={{ fontSize: 11.5, color, marginTop: 2 }}>
            {p.note}
          </div>
        )}
      </div>
    </>
  );

  const style: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 13,
    padding: "13px 0",
    width: "100%", textAlign: "left", background: "none",
    border: 0, borderBottom: "1px solid var(--line)",
    color: "inherit", cursor: "pointer", textDecoration: "none",
  };

  if (p.href) return <Link href={p.href} style={style}>{inner}</Link>;
  return <button onClick={p.onClick} style={style}>{inner}</button>;
}

function var_step(n: number) { return `var(--step-${n})`; }
