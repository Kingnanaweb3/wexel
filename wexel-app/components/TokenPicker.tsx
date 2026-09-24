"use client";

import { Logo } from "./ui";
import { fmtAmount } from "@/lib/format";
import { spendable, type Holding } from "@/lib/swap";

// Horizontal strip of what the wallet holds, with balances.
export function TokenPicker({ holdings, value, onChange }: {
  holdings: Holding[]; value?: Holding; onChange: (h: Holding) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 8, overflowX: "auto", scrollbarWidth: "none",
                  margin: "0 -20px", padding: "0 20px 2px" }}>
      {holdings.map((h) => {
        const on = value?.mint === h.mint;
        return (
          <button key={h.mint} onClick={() => onChange(h)} style={{
            flexShrink: 0, display: "flex", alignItems: "center", gap: 9, cursor: "pointer",
            padding: "9px 14px 9px 10px", borderRadius: 14, border: 0,
            background: on ? "var(--selected)" : "var(--idle)", color: "var(--ink)", textAlign: "left",
          }}>
            <Logo src={h.icon} label={h.symbol} size={26} />
            <span>
              <span style={{ fontSize: 14, fontWeight: 600, display: "block" }}>{h.symbol}</span>
              <span className="num" style={{ fontSize: 11.5, color: "var(--muted)" }}>
                {fmtAmount(spendable(h))}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
