"use client";

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { RefreshCw } from "lucide-react";
import { WalletActions } from "./WalletActions";

export function Balance() {
  const { publicKey } = useWallet();
  const [data, setData] = useState<any>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!publicKey) { setData(null); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/portfolio?owner=${publicKey.toBase58()}`);
      if (!res.ok) throw new Error();
      setData(await res.json());
      setFailed(false);
    } catch {
      setFailed(true); // keep any previous data on screen
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => { load(); }, [load]);

  const holdings = data?.holdings ?? [];
  const total = data?.totalUsd ?? 0;
  const inStocks = holdings.filter((h: any) => h.isStock).reduce((s: number, h: any) => s + h.valueUsd, 0);
  const [whole, cents] = total.toFixed(2).split(".");
  const unknown = failed && !data;

  return (
    <div style={{ padding: "4px 20px 22px" }}>
      <div className="card" style={{ padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 11 }}>
          <span style={{ fontSize: 13.5, color: "var(--muted)" }}>Total balance</span>
          <span className="mono" style={{ fontSize: 11, padding: "5px 10px", borderRadius: 999,
                background: "var(--idle)", color: "var(--muted)" }}>USD</span>
        </div>

        <div className="num" style={{ fontSize: 33, lineHeight: 1, marginBottom: 15 }}>
          {unknown ? <span style={{ color: "var(--faint)" }}>—</span> : <>
            ${Number(whole).toLocaleString()}
            <span style={{ fontSize: 19, color: "var(--faint)" }}>.{cents}</span>
          </>}
        </div>

        {failed && (
          <button onClick={load} style={{
            display: "flex", alignItems: "center", gap: 7, background: "none", border: 0,
            color: "var(--warn)", fontSize: 12.5, cursor: "pointer", padding: 0, marginBottom: 12,
          }}>
            <RefreshCw size={13} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
            {data ? "Couldn't refresh — showing last known balance. Tap to retry." : "Couldn't reach Solana. Tap to retry."}
          </button>
        )}
        {!failed && data?.partial && (
          <div style={{ fontSize: 12, color: "var(--warn)", marginBottom: 12 }}>
            Prices delayed — some values may be missing.
          </div>
        )}

        {!unknown && <>
          <Line label="In stocks" value={inStocks} />
          <Line label="Cash & crypto" value={total - inStocks} />
        </>}

        <div style={{ marginTop: 15 }}><WalletActions onSent={load} /></div>

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
