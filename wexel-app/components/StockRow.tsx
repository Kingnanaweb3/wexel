"use client";

export type StockRowProps = {
  ticker: string;
  name: string;
  price: number;
  change?: number;
  icon?: string;
  badge?: string;       // e.g. "+12.4% vs mark"
  badgeTone?: "ok" | "bad" | "warn" | "muted";
  onClick?: () => void;
};

export function StockRow(p: StockRowProps) {
  const toneColor = {
    ok: "var(--ok)", bad: "var(--bad)",
    warn: "var(--warn)", muted: "var(--text-3)",
  }[p.badgeTone ?? "muted"];

  return (
    <button
      onClick={p.onClick}
      className="card"
      style={{
        display: "flex", alignItems: "center", gap: 13, width: "100%",
        textAlign: "left", cursor: "pointer", marginBottom: 8,
      }}
    >
      {p.icon ? (
        <img src={p.icon} alt="" width={34} height={34}
             style={{ borderRadius: 9, flexShrink: 0 }} />
      ) : (
        <div style={{
          width: 34, height: 34, borderRadius: 9, flexShrink: 0,
          background: "rgba(255,255,255,0.06)", display: "grid",
          placeItems: "center", fontSize: 12, fontWeight: 500,
        }}>{p.ticker.slice(0, 2)}</div>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "Inter", fontWeight: 500, fontSize: 14 }}>
          {p.ticker}
        </div>
        <div style={{
          fontSize: 12, color: "var(--text-3)", whiteSpace: "nowrap",
          overflow: "hidden", textOverflow: "ellipsis",
        }}>{p.name}</div>
      </div>

      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div className="mono" style={{ fontSize: 13.5 }}>
          ${p.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </div>
        {p.badge && (
          <div className="mono" style={{ fontSize: 11, color: toneColor, marginTop: 2 }}>
            {p.badge}
          </div>
        )}
      </div>
    </button>
  );
}
