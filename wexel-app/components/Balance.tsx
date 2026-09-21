"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletActions } from "./WalletActions";

export function Balance() {
  const { publicKey } = useWallet();
  const [data, setData] = useState<{ totalUsd: number; holdings: any[] } | null>(null);

  const load = useCallback(() => {
    if (!publicKey) { setData(null); return; }
    fetch(`/api/portfolio?owner=${publicKey.toBase58()}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => setData({ totalUsd: 0, holdings: [] }));
  }, [publicKey]);

  useEffect(() => { load(); }, [load]);

  const holdings = data?.holdings ?? [];
  const total = data?.totalUsd ?? 0;
  const inStocks = holdings.filter(h => h.isStock).reduce((s, h) => s + h.valueUsd, 0);
  const other = total - inStocks;
  const [whole, cents] = total.toFixed(2).split(".");

  return (
    <div style={{ padding: "4px 20px 22px" }}>
      <div className="card" style={{ padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 11 }}>
          <span style={{ fontSize: 13.5, color: "var(--muted)" }}>Total balance</span>
          <span className="mono" style={{
            fontSize: 11, padding: "5px 10px", borderRadius: 999,
            background: "var(--idle)", color: "var(--muted)",
          }}>USD</span>
        </div>

        <div className="num" style={{ fontSize: 33, lineHeight: 1, marginBottom: 15 }}>
          ${Number(whole).toLocaleString()}
          <span style={{ fontSize: 19, color: "var(--faint)" }}>.{cents}</span>
        </div>

        <Line label="In stocks" value={inStocks} />
        <Line label="Cash & crypto" value={other} />

        <div style={{ marginTop: 15 }}>
          <WalletActions onSent={load} />
        </div>

        {!publicKey && (
          <div style={{ fontSize: 12, color: "var(--faint)", marginTop: 11, textAlign: "center" }}>
            Connect a wallet to see and move your funds
          </div>
        )}
      </div>
    </div>
  );
}

function Line({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0" }}>
      <span style={{ color: "var(--muted)" }}>{label}</span>
      <span className="num">${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
    </div>
  );
}
