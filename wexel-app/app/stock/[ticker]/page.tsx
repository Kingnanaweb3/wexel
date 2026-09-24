"use client";

import { useEffect, useState, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, Star, Share, Zap } from "lucide-react";
import { PriceChart, fmtTime, type ChartView } from "@/components/PriceChart";
import { BuySheet } from "@/components/BuySheet";
import { RuleSheet } from "@/components/RuleSheet";
import { Logo, Change } from "@/components/ui";
import { compact } from "@/lib/format";
import { useWatchlist } from "@/lib/watchlist";

const RANGES = ["1D", "1W", "1M", "1Y"];

export default function StockDetail({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = use(params);
  const router = useRouter();
  const isPre = useSearchParams().get("pre") === "1";
  const wl = useWatchlist();
  const watchId = isPre ? `pre:${ticker}` : ticker;

  const [asset, setAsset] = useState<any>(null);
  const [failed, setFailed] = useState(false);
  const [chart, setChart] = useState<any[]>([]);
  const [chartReason, setChartReason] = useState("loading");
  const [chartWindow, setChartWindow] = useState<number | undefined>(undefined);
  const [view, setView] = useState<ChartView | null>(null);
  const [scrub, setScrub] = useState<{ t: number; c: number } | null>(null);
  const [range, setRange] = useState("1D");
  const [buying, setBuying] = useState(false);
  const [ruling, setRuling] = useState(false);

  useEffect(() => {
    setFailed(false);
    fetch(isPre ? "/api/prestocks" : `/api/stocks?q=${ticker}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((list) => {
        const hit = isPre ? list.find((t: any) => t.symbol === ticker)
                          : list.find((t: any) => t.ticker === ticker) ?? list[0];
        if (!hit) throw new Error();
        setAsset(hit);
      })
      .catch(() => setFailed(true));
  }, [ticker, isPre]);

  useEffect(() => {
    if (!asset?.mint) return;
    setChartReason("loading");
    setView(null);
    fetch(`/api/chart?mint=${asset.mint}&range=${range}`)
      .then((r) => r.json())
      .then((d) => { setChart(d.items ?? []); setChartWindow(d.window); setChartReason(d.reason ?? ""); })
      .catch(() => { setChart([]); setChartReason("unavailable"); });
  }, [asset?.mint, range]);

  if (failed) {
    return <Center>Couldn't load {ticker}. <button onClick={() => location.reload()} style={linkBtn}>Retry</button></Center>;
  }
  if (!asset) return <Center>Loading {ticker}…</Center>;

  const price = isPre ? asset.tokenPrice : asset.price;
  const shown = scrub ? scrub.c : price;
  const [whole, cents] = Number(shown).toFixed(2).split(".");
  const label = isPre ? asset.symbol : asset.ticker;

  // The change line follows what's on the chart: scrubbed point, the
  // visible window, or — before the chart loads — the last 24 hours.
  let delta: { abs: number; pct: number; when: string } | null = null;
  if (view) {
    const end = scrub ? scrub.c : view.last.c;
    const abs = end - view.first.c;
    delta = {
      abs, pct: (abs / view.first.c) * 100,
      when: scrub ? fmtTime(scrub.t, range)
        : view.atLatest ? (range === "1Y" ? "since launch" : range)
        : `${fmtTime(view.first.t, range)} – ${fmtTime(view.last.t, range)}`,
    };
  } else if (!isPre && asset.change24h) {
    const pct = asset.change24h;
    delta = { abs: price - price / (1 + pct / 100), pct, when: "24h" };
  }

  async function share() {
    const url = location.href;
    try { await navigator.share?.({ title: `${label} on Wexel`, url }); }
    catch { try { await navigator.clipboard.writeText(url); } catch {} }
  }

  return (
    <div style={{ paddingBottom: 130 }}>
      <header style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 20px 4px" }}>
        <button onClick={() => router.back()} aria-label="Back" style={{ ...iconBtn, background: "none", width: 30 }}>
          <ChevronLeft size={26} />
        </button>
        <Logo src={isPre ? asset.image : asset.icon} label={label} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{label}</div>
          <div style={{ fontSize: 13, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {asset.name}
          </div>
        </div>
        <button onClick={() => wl.toggle(watchId)} aria-label="Watchlist" style={iconBtn}>
          <Star size={21} fill={wl.has(watchId) ? "var(--ink)" : "none"} />
        </button>
        <button onClick={share} aria-label="Share" style={iconBtn}><Share size={20} /></button>
      </header>

      <div style={{ padding: "18px 20px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12 }}>
        <div>
          <div className="num" style={{ fontSize: 34, fontWeight: 600, lineHeight: 1, letterSpacing: "-0.03em" }}>
            ${Number(whole).toLocaleString()}.{cents}
          </div>
          {delta && (
            <div className="num" style={{ fontSize: 14, fontWeight: 500, marginTop: 10,
                                          color: delta.abs >= 0 ? "var(--good)" : "var(--bad)" }}>
              {delta.abs >= 0 ? "▲" : "▼"} ${Math.abs(delta.abs).toFixed(2)} ({Math.abs(delta.pct).toFixed(2)}%)
              <span style={{ color: "var(--faint)", marginLeft: 8 }}>{delta.when}</span>
            </div>
          )}
          {isPre && (
            <div style={{ marginTop: 8, fontSize: 13 }}>
              <Change pct={asset.premiumPct} suffix=" vs issuer mark" />
            </div>
          )}
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="num" style={{ fontSize: 17, fontWeight: 600 }}>
            {isPre ? compact(Number(asset.valuation)) : compact(asset.liquidity)}
          </div>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>{isPre ? "Valuation" : "Liquidity"}</div>
        </div>
      </div>

      {/* Edge to edge, on a dotted field */}
      <div style={{ marginTop: 20, backgroundImage: "radial-gradient(var(--dot) 1px, transparent 1.2px)",
                    backgroundSize: "14px 14px" }}>
        <PriceChart data={chart} windowSize={chartWindow} reason={chartReason}
                    range={range} onScrub={setScrub} onView={setView} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 20px 0" }}>
        {RANGES.map((r) => (
          <button key={r} onClick={() => setRange(r)} style={{
            padding: "9px 16px", borderRadius: 12, border: 0, cursor: "pointer", fontFamily: "var(--sans)",
            fontSize: 14, fontWeight: 600,
            background: range === r ? "var(--selected)" : "transparent",
            color: range === r ? "var(--ink)" : "var(--faint)",
          }}>{r === "1Y" ? "All" : r}</button>
        ))}
      </div>

      <div style={{ padding: "30px 20px 0" }}>
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 10 }}>About</div>
        <p style={{ fontSize: 14, lineHeight: 1.65, color: "var(--muted)", margin: 0 }}>
          {asset.description ??
            `${asset.name} trades on Solana as a token tracking the real share. It keeps trading when the stock market is closed.`}
        </p>
        {!isPre && asset.thin && (
          <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--warn)", margin: "14px 0 0" }}>
            Thin liquidity: under $10K trades on-chain, so prices can jump on a single order. You can buy it, but Wexel won't run rules on it.
          </p>
        )}
        {isPre && (
          <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--faint)", margin: "14px 0 0" }}>
            Gives economic exposure to the company, not ownership or voting rights. Prices move on single trades,
            so Wexel won't automate this one.
          </p>
        )}
      </div>

      {/* Pinned actions */}
      <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 40,
                    padding: "18px 20px calc(16px + env(safe-area-inset-bottom, 0px))",
                    background: "linear-gradient(to top, var(--bg) 72%, transparent)" }}>
        <div style={{ maxWidth: 390, margin: "0 auto", display: "flex", gap: 10 }}>
          {!isPre && !asset.thin && (
            <button className="btn" style={{ flex: "0 0 36%" }} onClick={() => setRuling(true)}>
              <Zap size={17} /> Set rule
            </button>
          )}
          <button className="btn btn-primary" onClick={() => setBuying(true)}>Buy {label}</button>
        </div>
      </div>

      {ruling && <RuleSheet ticker={label} price={price} mint={asset.mint} onClose={() => setRuling(false)} />}
      {buying && (
        <BuySheet ticker={label} mint={asset.mint} price={price} canAutomate={!isPre}
                  decimals={isPre ? undefined : asset.decimals} onClose={() => setBuying(false)} />
      )}
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  width: 40, height: 40, borderRadius: 999, border: 0, cursor: "pointer", flexShrink: 0,
  background: "transparent", color: "var(--muted)", display: "grid", placeItems: "center",
};
const linkBtn: React.CSSProperties = { background: "none", border: 0, color: "var(--accent)", cursor: "pointer", fontSize: 14 };

function Center({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: "90px 20px", textAlign: "center", color: "var(--faint)", fontSize: 14 }}>{children}</div>;
}
