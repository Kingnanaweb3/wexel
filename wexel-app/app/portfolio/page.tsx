"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { RefreshCw } from "lucide-react";
import { WalletActions } from "@/components/WalletActions";
import { PermissionCard } from "@/components/PermissionCard";

const SWATCH = ["#2F7FFF", "#5DD68E", "#E0A85A", "#B98CFF", "#F87171", "#56C2E6"];

export default function Portfolio() {
  const { publicKey } = useWallet();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

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
  const stocks = holdings.filter(h => h.isStock).reduce((s, h) => s + h.valueUsd, 0);
  const cash = holdings.filter(h => h.isStable).reduce((s, h) => s + h.valueUsd, 0);
  const [whole, cents] = total.toFixed(2).split(".");

  return (
    <>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "22px 20px 16px" }}>
        <h1 style={{ fontSize: 26 }}>Wallet</h1>
        {publicKey && (
          <button onClick={load} className="icon-chip" style={{ border: 0, cursor: "pointer" }}>
            <RefreshCw size={15} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
          </button>
        )}
      </header>

      <div style={{ padding: "0 20px" }}>
        {!publicKey && <Muted>Connect a wallet to see what you hold.</Muted>}

        {publicKey && (
          <>
            {failed && (
              <button onClick={load} className="card" style={{
                width: "100%", marginBottom: 14, textAlign: "left", cursor: "pointer",
                color: "var(--warn)", fontSize: 13, border: 0,
              }}>
                {data ? "Couldn't refresh — showing your last known balances. Tap to retry."
                      : "Couldn't reach Solana. Tap to retry."}
              </button>
            )}

            {data && (
              <div className="card" style={{ padding: 18, marginBottom: 18 }}>
                <div style={{ fontSize: 13.5, color: "var(--muted)", marginBottom: 10 }}>Total value</div>
                <div className="num" style={{ fontSize: 34, lineHeight: 1, marginBottom: 18 }}>
                  ${Number(whole).toLocaleString()}
                  <span style={{ fontSize: 19, color: "var(--faint)" }}>.{cents}</span>
                </div>

                {total > 0 && (
                  <div style={{ display: "flex", height: 8, borderRadius: 999, overflow: "hidden", gap: 2, marginBottom: 16 }}>
                    {holdings.filter(h => h.share > 0.5).map((h, i) => (
                      <div key={h.account} style={{ width: `${h.share}%`, background: SWATCH[i % SWATCH.length] }} />
                    ))}
                  </div>
                )}

                <Split label="Stocks" value={stocks} total={total} />
                <Split label="Crypto" value={total - stocks - cash} total={total} />
                <Split label="Cash" value={cash} total={total} />

                {data.partial && (
                  <div style={{ fontSize: 12, color: "var(--warn)", marginTop: 10 }}>
                    Prices delayed — some values may be missing.
                  </div>
                )}
              </div>
            )}

            <div style={{ marginBottom: 20 }}><WalletActions onSent={load} /></div>
            <PermissionCard />

            {data && (
              <>
                <div className="label" style={{ marginBottom: 10 }}>Holdings · {holdings.length}</div>
                {!holdings.length && <Muted>This wallet holds nothing yet.</Muted>}
                {holdings.length > 0 && (
                  <div className="card" style={{ padding: "2px 15px" }}>
                    {holdings.map((h, i) => {
                      const inner = (
                        <>
                          <div style={{ position: "relative", flexShrink: 0 }}>
                            {h.icon
                              ? <img src={h.icon} alt="" width={36} height={36} style={{ borderRadius: 11 }} />
                              : <div className="icon-chip" style={{ width: 36, height: 36, fontSize: 11 }}>{h.symbol.slice(0, 3)}</div>}
                            <span style={{ position: "absolute", bottom: -1, right: -1, width: 10, height: 10, borderRadius: "50%",
                                           background: SWATCH[i % SWATCH.length], border: "2px solid var(--surface)" }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="mono" style={{ fontSize: 13.5 }}>{h.symbol}</div>
                            <div className="num" style={{ fontSize: 11.5, color: "var(--faint)", marginTop: 2 }}>
                              {h.amount.toLocaleString(undefined, { maximumFractionDigits: 4 })}
                              {h.price > 0 && ` · $${h.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                            </div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div className="num" style={{ fontSize: 14 }}>
                              {h.price > 0 ? `$${h.valueUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—"}
                            </div>
                            <div className="num" style={{ fontSize: 11, color: "var(--faint)", marginTop: 2 }}>{h.share.toFixed(1)}%</div>
                          </div>
                        </>
                      );
                      const style: React.CSSProperties = {
                        display: "flex", alignItems: "center", gap: 12, padding: "13px 0",
                        textDecoration: "none", color: "inherit",
                        borderBottom: i < holdings.length - 1 ? "1px solid var(--line)" : "none",
                      };
                      return h.isStock
                        ? <Link key={h.account} href={h.isPre ? `/stock/${h.symbol}?pre=1` : `/stock/${h.symbol.replace(/x$/, "")}`} style={style}>{inner}</Link>
                        : <div key={h.account} style={style}>{inner}</div>;
                    })}
                  </div>
                )}
                {holdings.some(h => h.price === 0) && (
                  <p style={{ fontSize: 11.5, color: "var(--faint)", lineHeight: 1.6, marginTop: 12 }}>
                    Tokens marked — have no market price. On devnet that's most test tokens;
                    they're shown so nothing in your wallet is hidden.
                  </p>
                )}
              </>
            )}

            {!data && !failed && <Muted>Reading your wallet…</Muted>}
          </>
        )}
      </div>
    </>
  );
}

function Split({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "4px 0" }}>
      <span style={{ color: "var(--muted)" }}>{label}</span>
      <span className="num">
        ${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        <span style={{ color: "var(--faint)", marginLeft: 8 }}>{pct.toFixed(0)}%</span>
      </span>
    </div>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <div style={{ textAlign: "center", padding: "46px 20px", color: "var(--faint)", fontSize: 13, lineHeight: 1.6 }}>{children}</div>;
}
