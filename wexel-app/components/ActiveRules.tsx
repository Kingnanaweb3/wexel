"use client";

import Link from "next/link";
import { Plus, Zap } from "lucide-react";

// Rules the user has set. Reads from chain once the program client is wired;
// until then it shows the empty state, which is the honest default.
export function ActiveRules({ rules }: { rules: any[] }) {
  if (rules.length === 0) {
    return (
      <Link href="/rules" className="card" style={{
        display: "flex", alignItems: "center", gap: 13,
        textDecoration: "none", color: "inherit", marginBottom: 26,
      }}>
        <div className="icon-chip" style={{ background: "var(--accent)", color: "#fff" }}>
          <Plus size={17} strokeWidth={2.2} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14.5, fontWeight: 500, marginBottom: 2 }}>
            Set your first rule
          </div>
          <div style={{ fontSize: 12, color: "var(--faint)", lineHeight: 1.45 }}>
            Buy the dip, take profit, or stop a loss — automatically
          </div>
        </div>
      </Link>
    );
  }

  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: "center", marginBottom: 10,
      }}>
        <span className="label">Active rules</span>
        <Link href="/rules" style={{
          fontSize: 12, color: "var(--accent)", textDecoration: "none",
        }}>See all</Link>
      </div>

      <div className="card" style={{ padding: "4px 16px" }}>
        {rules.slice(0, 3).map((r, i, arr) => (
          <div key={r.pubkey} style={{
            display: "flex", alignItems: "center", gap: 12, padding: "13px 0",
            borderBottom: i < arr.length - 1 ? "1px solid var(--line)" : "none",
          }}>
            <div className="icon-chip" style={{ width: 30, height: 30 }}>
              <Zap size={14} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="mono" style={{ fontSize: 13.5 }}>{r.asset}</div>
              <div style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 1 }}>
                {r.direction === "down" ? "↓" : "↑"} {r.thresholdPct}% → {r.action}
              </div>
            </div>
            <div className="mono" style={{
              fontSize: 10.5, color: "var(--faint)", textTransform: "uppercase",
            }}>{r.status}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
