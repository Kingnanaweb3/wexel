"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Search, Star, TrendingUp, Sun, Moon, Info } from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";
import { ReceiveSheet } from "@/components/ReceiveSheet";
import { AssetRow, BigUsd, Change, Chips, Logo, UnderTabs } from "@/components/ui";
import { compact, fmtPrice } from "@/lib/format";
import { useWatchlist } from "@/lib/watchlist";
import { IS_PAPER } from "@/lib/network";
import { LogoMark } from "@/components/LogoMark";

const WalletMultiButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((m) => m.WalletMultiButton), { ssr: false });

const FILTERS = [
  { id: "trending", label: "Trending" },
  { id: "gainers", label: "Top gainers" },
  { id: "losers", label: "Top losers" },
  { id: "liquid", label: "Most liquid" },
];

export default function Markets() {
  const { publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const { theme, toggle } = useTheme();
  const wl = useWatchlist();

  const [tab, setTab] = useState("stocks");
  const [filter, setFilter] = useState("trending");
  const [stocks, setStocks] = useState<any[]>([]);
  const [pre, setPre] = useState<any[]>([]);
  const [failed, setFailed] = useState({ stocks: false, pre: false });
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[] | null>(null);
  const [extra, setExtra] = useState<any[]>([]);
  const [bal, setBal] = useState<any>(null);
  const [balFailed, setBalFailed] = useState(false);
  const [receiving, setReceiving] = useState(false);
  const [funding, setFunding] = useState(false);

  async function practiceFunds() {
    if (!publicKey) return setVisible(true);
    setFunding(true);
    try {
      await fetch("/api/faucet", { method: "POST", headers: { "Content-Type": "application/json" },
                                   body: JSON.stringify({ owner: publicKey.toBase58() }) });
      setTimeout(loadBalance, 800);
    } finally { setFunding(false); }
  }

  const loadMarkets = useCallback(() => {
    setLoading(true);
    fetch("/api/stocks").then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((s) => { setStocks(Array.isArray(s) ? s : []); setFailed((f) => ({ ...f, stocks: false })); })
      .catch(() => setFailed((f) => ({ ...f, stocks: true })))
      .finally(() => setLoading(false));
    fetch("/api/prestocks").then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((p) => { setPre(Array.isArray(p) ? p : []); setFailed((f) => ({ ...f, pre: false })); })
      .catch(() => setFailed((f) => ({ ...f, pre: true })));
  }, []);
  useEffect(() => { loadMarkets(); }, [loadMarkets]);

  const loadBalance = useCallback(() => {
    if (!publicKey) { setBal(null); return; }
    fetch(`/api/portfolio?owner=${publicKey.toBase58()}`).then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { setBal(d); setBalFailed(false); })
      .catch(() => setBalFailed(true));
  }, [publicKey]);
  useEffect(() => { loadBalance(); }, [loadBalance]);

  // Search reaches every xStock, not just the featured ten.
  useEffect(() => {
    if (!query.trim()) { setResults(null); return; }
    const t = setTimeout(() => {
      fetch(`/api/stocks?q=${encodeURIComponent(query.trim())}`).then((r) => (r.ok ? r.json() : []))
        .then((s) => setResults(Array.isArray(s) ? s : [])).catch(() => setResults([]));
    }, 400);
    return () => clearTimeout(t);
  }, [query]);

  // Starred stocks that aren't in the featured list get fetched individually.
  useEffect(() => {
    if (tab !== "watchlist") return;
    const missing = wl.list.filter((id) => !id.startsWith("pre:") && !stocks.some((s) => s.ticker === id));
    Promise.all(missing.map((t) => fetch(`/api/stocks?q=${t}`).then((r) => r.json()).catch(() => [])))
      .then((all) => setExtra(all.flat().filter((s: any) => missing.includes(s.ticker))));
  }, [tab, wl.list, stocks]);

  const sorted = useMemo(() => {
    const s = [...stocks];
    if (filter === "gainers") s.sort((a, b) => b.change24h - a.change24h);
    if (filter === "losers") s.sort((a, b) => a.change24h - b.change24h);
    if (filter === "liquid") s.sort((a, b) => b.liquidity - a.liquidity);
    return s;
  }, [stocks, filter]);

  const movers = useMemo(() =>
    stocks.filter((s) => !s.thin).sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h)).slice(0, 6), [stocks]);

  const holdings: any[] = bal?.holdings ?? [];
  const total = bal?.totalUsd ?? 0;
  // Value 24h ago, from each holding's own 24h change.
  const dayChange = holdings.reduce((s, h) =>
    s + (h.change24h ? h.valueUsd * (h.change24h / (100 + h.change24h)) : 0), 0);

  const stockRow = (s: any) => (
    <AssetRow key={s.mint} href={`/stock/${s.ticker}`} logo={s.icon} title={s.ticker}
      sub={s.thin ? <>{compact(s.liquidity)} liq. · <span style={{ color: "var(--warn)" }}>Thin</span></> : `${compact(s.liquidity)} liq.`} price={fmtPrice(s.price)} change={<Change pct={s.change24h} />} />
  );
  const preRow = (t: any) => (
    <AssetRow key={t.mint} href={`/stock/${t.symbol}?pre=1`} logo={t.image} title={t.symbol}
      sub={t.valuation ? `${compact(Number(t.valuation))} val.` : t.name} price={fmtPrice(t.tokenPrice)}
      change={<Change pct={t.premiumPct} suffix=" vs mark" size={12} />} />
  );

  const watchStocks = [...stocks, ...extra].filter((s) => wl.has(s.ticker));
  const watchPre = pre.filter((t) => wl.has(`pre:${t.symbol}`));

  return (
    <>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 6px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <LogoMark size={32} />
          {IS_PAPER && (
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", padding: "5px 9px",
                           borderRadius: 999, background: "var(--selected)", color: "var(--muted)" }}>
              PAPER · RESETS EVERY 2H
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={toggle} aria-label="Theme" style={iconBtn}>
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <WalletMultiButton style={{ background: "var(--raised)", color: "var(--ink)", borderRadius: 999,
            height: 38, fontSize: 13, fontFamily: "var(--sans)", fontWeight: 600, padding: "0 14px" }} />
        </div>
      </header>

      <div style={{ padding: "0 20px" }}>
        {/* Balance */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "18px 0 24px" }}>
          <div>
            {balFailed && !bal ? (
              <button onClick={loadBalance} style={{ background: "none", border: 0, padding: 0, cursor: "pointer", color: "var(--warn)", fontSize: 13 }}>
                Couldn't reach Solana · retry
              </button>
            ) : (
              <>
                <BigUsd value={total} />
                <div className="num" style={{ fontSize: 14, marginTop: 8, color: dayChange >= 0 ? "var(--muted)" : "var(--bad)" }}>
                  {dayChange >= 0 ? "+" : "-"}${Math.abs(dayChange).toFixed(2)} <span style={{ color: "var(--faint)" }}>24h</span>
                </div>
              </>
            )}
          </div>
          <button className="btn btn-primary" style={{ width: "auto", padding: "15px 30px" }}
                  disabled={funding}
                  onClick={() => (IS_PAPER ? practiceFunds() : publicKey ? setReceiving(true) : setVisible(true))}>
            {IS_PAPER ? (funding ? "Adding…" : "Get $1,000") : "Deposit"}
          </button>
        </div>

        {/* Top movers */}
        {movers.length > 0 && (
          <div style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 16, fontWeight: 600, marginBottom: 12 }}>
              <TrendingUp size={19} color="var(--faint)" /> Top movers today
            </div>
            <div className="swipe" style={{ gap: 10 }}>
              {movers.map((s) => (
                <Link key={s.mint} href={`/stock/${s.ticker}`} style={{
                  flex: "0 0 150px", border: "1px solid var(--line2)", borderRadius: 18,
                  padding: "13px 14px", textDecoration: "none", color: "inherit",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
                    <Logo src={s.icon} label={s.ticker} size={24} />
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{s.ticker}</span>
                  </div>
                  <Change pct={s.change24h} size={16} />
                </Link>
              ))}
            </div>
          </div>
        )}

        <UnderTabs value={tab} onChange={setTab} items={[
          { id: "watchlist", label: <><Star size={18} /> Watchlist</> },
          { id: "stocks", label: "Stocks" },
          { id: "preipo", label: "Pre-IPO" },
        ]} />

        <div style={{ padding: "16px 0 6px" }}>
          {tab === "stocks" && (
            <Chips value={searching ? "search" : filter}
              onChange={(id) => { if (id === "search") setSearching((s) => !s); else { setSearching(false); setQuery(""); setFilter(id); } }}
              items={[{ id: "search", label: <Search size={17} /> }, ...FILTERS]} />
          )}
          {tab === "preipo" && (
            <div style={{ display: "flex", gap: 9, fontSize: 13, color: "var(--muted)", lineHeight: 1.5 }}>
              <Info size={16} style={{ flexShrink: 0, marginTop: 2, color: "var(--warn)" }} />
              Buy and hold only. These prices move on single trades, so rules can't fire on them.
            </div>
          )}
          {tab === "stocks" && searching && (
            <input autoFocus placeholder="Any ticker — NKE, DIS, AMD…" value={query}
                   onChange={(e) => setQuery(e.target.value)} style={{ marginTop: 12 }} />
          )}
        </div>

        {tab === "stocks" && (
          loading ? <Muted>Loading live prices…</Muted>
          : failed.stocks && !stocks.length ? <Retry onClick={loadMarkets}>Couldn't load stock prices. Tap to retry.</Retry>
          : results ? (results.length ? results.map(stockRow) : <Muted>No stock called "{query}".</Muted>)
          : sorted.map(stockRow)
        )}

        {tab === "preipo" && (
          failed.pre && !pre.length ? <Retry onClick={loadMarkets}>Couldn't load pre-IPO prices. Tap to retry.</Retry>
          : pre.length ? pre.map(preRow) : <Muted>Loading…</Muted>
        )}

        {tab === "watchlist" && (
          watchStocks.length + watchPre.length
            ? <>{watchStocks.map(stockRow)}{watchPre.map(preRow)}</>
            : <Muted>Tap the star on any stock to keep it here.</Muted>
        )}
      </div>

      {receiving && <ReceiveSheet onClose={() => setReceiving(false)} />}
    </>
  );
}

const iconBtn: React.CSSProperties = {
  width: 38, height: 38, borderRadius: 999, border: 0, cursor: "pointer",
  background: "var(--raised)", color: "var(--ink)", display: "grid", placeItems: "center",
};

function Muted({ children }: { children: React.ReactNode }) {
  return <div style={{ textAlign: "center", padding: "40px 10px", color: "var(--faint)", fontSize: 13 }}>{children}</div>;
}

function Retry({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ width: "100%", padding: "40px 10px", background: "none", border: 0,
      color: "var(--warn)", fontSize: 13, cursor: "pointer" }}>{children}</button>
  );
}
