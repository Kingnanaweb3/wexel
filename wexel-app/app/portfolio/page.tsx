"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { RefreshCw, DollarSign } from "lucide-react";
import { WalletActions } from "@/components/WalletActions";
import { PermissionCard } from "@/components/PermissionCard";
import { AssetRow, BigUsd, Change, Chips } from "@/components/ui";
import { fmtAmount } from "@/lib/format";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "stocks", label: "Stocks" },
  { id: "pre", label: "Pre-IPO" },
  { id: "crypto", label: "Crypto" },
];

export default function Wallet() {
  const { publicKey } = useWallet();
  const [data, setData] = useState<any>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("all");

  const load = useCallback(async () => {
    if (!publicKey) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/portfolio?owner=${publicKey.toBase58()}`);
      if (!res.ok) throw new Error();
      setData(await res.json());
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => { load(); }, [load]);

  const holdings: any[] = data?.holdings ?? [];
  const total = data?.totalUsd ?? 0;
  const cash = holdings.filter((h) => h.isStable).reduce((s, h) => s + h.valueUsd, 0);
  const dayChange = holdings.reduce((s, h) =>
    s + (h.change24h ? h.valueUsd * (h.change24h / (100 + h.change24h)) : 0), 0);

  // Cash has its own line, so positions are everything else.
  const positions = useMemo(() => holdings.filter((h) => !h.isStable).filter((h) =>
    filter === "all" ? true
    : filter === "stocks" ? h.isStock && !h.isPre
    : filter === "pre" ? h.isPre
    : !h.isStock), [holdings, filter]);

  return (
    <>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px 0" }}>
        <h1 style={{ fontSize: 21 }}>Wallet</h1>
        {publicKey && (
          <button onClick={load} aria-label="Refresh" style={{
            width: 38, height: 38, borderRadius: 999, border: 0, cursor: "pointer",
            background: "var(--raised)", color: "var(--ink)", display: "grid", placeItems: "center",
          }}>
            <RefreshCw size={16} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          </button>
        )}
      </header>

      <div style={{ padding: "0 20px" }}>
        {!publicKey && <Muted>Connect a wallet to see what you hold.</Muted>}

        {publicKey && (
          <>
            <div style={{ padding: "22px 0 22px" }}>
              {failed && !data ? (
                <button onClick={load} style={{ background: "none", border: 0, padding: 0, cursor: "pointer", color: "var(--warn)", fontSize: 14 }}>
                  Couldn't reach Solana · tap to retry
                </button>
              ) : (
                <>
                  <BigUsd value={total} size={36} />
                  <div className="num" style={{ fontSize: 14, fontWeight: 500, marginTop: 10,
                                                color: dayChange >= 0 ? "var(--good)" : "var(--bad)" }}>
                    {dayChange >= 0 ? "+" : "-"}${Math.abs(dayChange).toFixed(2)}
                    <span style={{ color: "var(--faint)", marginLeft: 8 }}>24h</span>
                  </div>
                  {failed && <div style={{ fontSize: 12, color: "var(--warn)", marginTop: 8 }}>Showing last known balances.</div>}
                  {data?.partial && <div style={{ fontSize: 12, color: "var(--warn)", marginTop: 8 }}>Prices delayed — some values may be missing.</div>}
                </>
              )}
            </div>

            <WalletActions onSent={load} />

            {/* Cash */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "26px 0 22px" }}>
              <div style={{ width: 54, height: 54, borderRadius: "50%", background: "var(--raised)",
                            display: "grid", placeItems: "center", flexShrink: 0 }}>
                <DollarSign size={24} />
              </div>
              <div>
                <div style={{ fontSize: 14, color: "var(--muted)" }}>Total cash</div>
                <div className="num" style={{ fontSize: 18, fontWeight: 600, marginTop: 2 }}>
                  ${cash.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
            </div>

            {/* Positions */}
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 14 }}>
              Positions <span style={{ color: "var(--faint)", fontWeight: 500 }}>({holdings.filter((h) => !h.isStable).length})</span>
            </div>
            <Chips items={FILTERS} value={filter} onChange={setFilter} />

            <div style={{ paddingTop: 8 }}>
              {!data && !failed && <Muted>Reading your wallet…</Muted>}
              {data && !positions.length && <Muted>{filter === "all" ? "No positions yet." : "Nothing in this category."}</Muted>}
              {positions.map((h) => (
                <AssetRow key={h.account}
                  href={h.isPre ? `/stock/${h.symbol}?pre=1` : h.isStock ? `/stock/${h.symbol.replace(/x$/, "")}` : "/portfolio"}
                  logo={h.icon} title={h.name === "Unknown token" ? h.symbol : h.name}
                  sub={`${fmtAmount(h.amount)} ${h.symbol}`}
                  price={h.price > 0 ? `$${h.valueUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                  change={<Change pct={h.isPre || !h.price ? null : h.change24h} />} />
              ))}
            </div>

            {holdings.some((h) => h.price === 0) && (
              <p style={{ fontSize: 12, color: "var(--faint)", lineHeight: 1.6, margin: "10px 0 0" }}>
                Tokens marked — have no market price. On devnet that's most test tokens;
                they're shown so nothing in your wallet is hidden.
              </p>
            )}

            <div style={{ marginTop: 26 }}><PermissionCard /></div>
          </>
        )}
      </div>
    </>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <div style={{ textAlign: "center", padding: "40px 10px", color: "var(--faint)", fontSize: 13 }}>{children}</div>;
}
