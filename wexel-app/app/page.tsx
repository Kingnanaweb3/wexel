"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Greeting } from "@/components/Greeting";
import { Balance } from "@/components/Balance";
import { ActiveRules } from "@/components/ActiveRules";

export default function Markets() {
  const [tab, setTab] = useState<"stocks" | "preipo">("stocks");
  const [stocks, setStocks] = useState<any[]>([]);
  const [pre, setPre] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const [failed, setFailed] = useState({ stocks: false, pre: false });

  // Each list loads on its own: PreStocks being down never hides stocks.
  const loadMarkets = useCallback(() => {
    setLoading(true);
    fetch("/api/stocks")
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(s => { setStocks(Array.isArray(s) ? s : []); setFailed(f => ({ ...f, stocks: false })); })
      .catch(() => setFailed(f => ({ ...f, stocks: true })))
      .finally(() => setLoading(false));
    fetch("/api/prestocks")
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then(p => { setPre(Array.isArray(p) ? p : []); setFailed(f => ({ ...f, pre: false })); })
      .catch(() => setFailed(f => ({ ...f, pre: true })));
  }, []);

  useEffect(() => { loadMarkets(); }, [loadMarkets]);

  useEffect(() => {
    if (!query || query.length < 2 || tab !== "stocks") return;
    const t = setTimeout(() => {
      fetch(`/api/stocks?q=${encodeURIComponent(query)}`)
        .then(r => r.json())
        .then(s => Array.isArray(s) && s.length && setStocks(s))
        .catch(() => {});
    }, 450);
    return () => clearTimeout(t);
  }, [query, tab]);

  const list = tab === "stocks" ? stocks : pre;

  return (
    <>
      <Greeting />
      <Balance />

      <div style={{ padding: "0 20px" }}>
        <ActiveRules rules={[]} />

        {/* Movers — compact strip, no longer the hero */}
        {!loading && stocks.length > 0 && (
          <div style={{ marginBottom: 26 }}>
            <div className="label" style={{ marginBottom: 10 }}>Movers today</div>
            <div className="swipe">
              {stocks.slice(0, 8).map(s => (
                <Link key={s.mint} href={`/stock/${s.ticker}`} className="card"
                      style={{ textDecoration: "none", color: "inherit", padding: 13 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 10 }}>
                    {s.icon
                      ? <img src={s.icon} alt="" width={20} height={20} style={{ borderRadius: 6 }} />
                      : <div className="icon-chip" style={{ width: 20, height: 20, fontSize: 9 }}>{s.ticker.slice(0,2)}</div>}
                    <div className="mono" style={{ fontSize: 12 }}>{s.ticker}</div>
                  </div>
                  <div className="num" style={{ fontSize: 16, marginBottom: 3 }}>
                    ${s.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </div>
                  <div className="num" style={{
                    fontSize: 11,
                    color: s.change24h >= 0 ? "var(--good)" : "var(--bad)",
                  }}>
                    {s.change24h >= 0 ? "+" : ""}{pct(s.change24h)}%
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Markets */}
        <div className="label" style={{ marginBottom: 11 }}>Markets</div>

        <div className="seg" style={{ marginBottom: 13 }}>
          <button className={tab === "stocks" ? "on" : ""}
                  onClick={() => setTab("stocks")}>Stocks</button>
          <button className={tab === "preipo" ? "on" : ""}
                  onClick={() => setTab("preipo")}>Pre-IPO</button>
        </div>

        {tab === "stocks" && (
          <input placeholder="Search any ticker…" value={query}
                 onChange={e => setQuery(e.target.value)}
                 style={{ marginBottom: 13 }} />
        )}

        {tab === "preipo" && (
          <div className="card" style={{
            marginBottom: 13, background: "rgba(224,168,90,.08)", padding: 13,
          }}>
            <div style={{ fontSize: 12.5, color: "var(--warn)", lineHeight: 1.55 }}>
              Buy and hold only. These prices move on single trades,
              so rules can't fire on them.
            </div>
          </div>
        )}

        {loading && <Muted>Loading live prices…</Muted>}

        {!loading && (
          <div className="card" style={{ padding: "2px 15px" }}>
            {list.map((s: any, i: number) => {
              const isPre = tab === "preipo";
              const ticker = isPre ? s.symbol : s.ticker;
              const price = isPre ? s.tokenPrice : s.price;
              const note = isPre
                ? `${s.premiumPct > 0 ? "+" : ""}${s.premiumPct.toFixed(1)}% vs mark`
                : `${s.change24h >= 0 ? "+" : ""}${pct(s.change24h)}%`;
              const tone = isPre
                ? (Math.abs(s.premiumPct) > 10 ? "var(--warn)" : "var(--faint)")
                : (s.change24h >= 0 ? "var(--good)" : "var(--bad)");

              return (
                <Link key={s.mint} href={`/stock/${ticker}${isPre ? "?pre=1" : ""}`}
                      style={{
                        display: "flex", alignItems: "center", gap: 12,
                        padding: "13px 0", textDecoration: "none", color: "inherit",
                        borderBottom: i < list.length - 1 ? "1px solid var(--line)" : "none",
                      }}>
                  {(isPre ? s.image : s.icon)
                    ? <img src={isPre ? s.image : s.icon} alt="" width={34} height={34}
                           style={{ borderRadius: 10, flexShrink: 0 }} />
                    : <div className="icon-chip">{ticker.slice(0, 2)}</div>}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="mono" style={{ fontSize: 13.5 }}>{ticker}</div>
                    <div style={{
                      fontSize: 11.5, color: "var(--faint)", marginTop: 1,
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>{s.name}</div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div className="num" style={{ fontSize: 14 }}>
                      ${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </div>
                    <div className="num" style={{ fontSize: 11, color: tone, marginTop: 2 }}>
                      {note}
                    </div>
                  </div>
                </Link>
              );
            })}
            {!list.length && (failed[tab === "stocks" ? "stocks" : "pre"]
              ? <button onClick={loadMarkets} style={{ width: "100%", padding: "36px 20px", background: "none",
                  border: 0, color: "var(--warn)", fontSize: 13, cursor: "pointer" }}>
                  Couldn't load {tab === "stocks" ? "stock prices" : "pre-IPO prices"}. Tap to retry.
                </button>
              : <Muted>Nothing to show.</Muted>)}
          </div>
        )}
      </div>
    </>
  );
}

// Jupiter's priceChange is ALREADY a percentage (0.1997 = 0.20%), so it is
// used as-is. Multiplying it turns a 0.2% move into 20%.
function pct(v: number | undefined) {
  return (v ?? 0).toFixed(2);
}

function Muted({ children }: { children: React.ReactNode }) {
  return <div style={{
    textAlign: "center", padding: "36px 20px",
    color: "var(--faint)", fontSize: 13,
  }}>{children}</div>;
}
