"use client";

import { useState, useEffect, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Zap } from "lucide-react";
import { PriceChart, fmtTime, type ChartView } from "@/components/PriceChart";
import { BuySheet } from "@/components/BuySheet";
import { RuleSheet } from "@/components/RuleSheet";

const RANGES = ["1D", "1W", "1M", "1Y"];

export default function StockDetail({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = use(params);
  const router = useRouter();
  const isPre = useSearchParams().get("pre") === "1";

  const [asset, setAsset] = useState<any>(null);
  const [chart, setChart] = useState<any[]>([]);
  const [chartReason, setChartReason] = useState("loading");
  const [chartWindow, setChartWindow] = useState<number | undefined>(undefined);
  const [view, setView] = useState<ChartView | null>(null);
  const [scrub, setScrub] = useState<{ t: number; c: number } | null>(null);
  const [range, setRange] = useState("1D");
  const [buying, setBuying] = useState(false);
  const [ruling, setRuling] = useState(false);

  useEffect(() => {
    const url = isPre ? "/api/prestocks" : `/api/stocks?q=${ticker}`;
    fetch(url).then(r => r.json()).then((list) => {
      const hit = isPre
        ? list.find((t: any) => t.symbol === ticker)
        : list.find((t: any) => t.ticker === ticker) ?? list[0];
      setAsset(hit ?? null);
    }).catch(() => setAsset(null));
  }, [ticker, isPre]);

  useEffect(() => {
    if (!asset?.mint) return;
    setChartReason("loading");
    setView(null);
    fetch(`/api/chart?mint=${asset.mint}&range=${range}`)
      .then(r => r.json())
      .then(d => { setChart(d.items ?? []); setChartWindow(d.window); setChartReason(d.reason ?? ""); })
      .catch(() => { setChart([]); setChartReason("unavailable"); });
  }, [asset?.mint, range]);

  if (!asset) {
    return <div style={{ padding: 60, textAlign: "center", color: "var(--faint)", fontSize: 13 }}>
      Loading {ticker}…
    </div>;
  }

  const price = isPre ? asset.tokenPrice : asset.price;
  // Both are already percentages — no scaling.
  const change = isPre ? asset.premiumPct : (asset.change24h ?? 0);
  const up = change >= 0;
  // While scrubbing the chart, the big number shows that moment's price.
  const [whole, cents] = Number(scrub ? scrub.c : price).toFixed(2).split(".");

  return (
    <>
      <header style={{
        display: "flex", alignItems: "center", gap: 12,
        height: 56, padding: "0 20px", position: "sticky", top: 0, zIndex: 30,
        background: "var(--bg)",
      }}>
        <button onClick={() => router.back()} className="icon-chip"
                style={{ border: 0, cursor: "pointer" }}>
          <ArrowLeft size={17} />
        </button>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 14.5, fontWeight: 500 }}>{asset.name}</div>
          <div className="mono" style={{ fontSize: 11, color: "var(--faint)" }}>
            {isPre ? asset.symbol : asset.ticker}
          </div>
        </div>
        <div style={{ width: 34 }} />
      </header>

      <div style={{ padding: "8px 20px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 5 }}>
          {(isPre ? asset.image : asset.icon) && (
            <img src={isPre ? asset.image : asset.icon} alt="" width={30} height={30}
                 style={{ borderRadius: 9 }} />
          )}
          <span style={{ fontSize: 14, color: "var(--muted)" }}>
            {isPre ? "Pre-IPO" : "Tokenized stock"}
          </span>
        </div>

        <div className="num" style={{ fontSize: 40, lineHeight: 1.05 }}>
          ${Number(whole).toLocaleString()}
          <span style={{ fontSize: 23, color: "var(--faint)" }}>.{cents}</span>
        </div>

        <div className="num" style={{
          fontSize: 13.5, color: up ? "var(--good)" : "var(--bad)", marginTop: 5,
        }}>
          {up ? "▲" : "▼"} {Math.abs(change).toFixed(2)}%
          <span style={{ color: "var(--faint)" }}>
            {isPre ? " vs issuer mark" : " today"}
          </span>
        </div>

        <div style={{ margin: "20px -4px 6px" }}>
          {view && (() => {
            const end = scrub ? scrub.c : view.last.c;
            const ch = ((end - view.first.c) / view.first.c) * 100;
            const label = scrub ? `at ${fmtTime(scrub.t, range)}`
              : view.atLatest ? (range === "1Y" ? "since launch" : `over ${range}`)
              : `${fmtTime(view.first.t, range)} – ${fmtTime(view.last.t, range)}`;
            return (
              <div className="num" style={{ fontSize: 12, color: ch >= 0 ? "var(--good)" : "var(--bad)", margin: "0 4px 6px" }}>
                {ch >= 0 ? "+" : ""}{ch.toFixed(2)}% <span style={{ color: "var(--faint)" }}>{label}</span>
              </div>
            );
          })()}
          <PriceChart data={chart} windowSize={chartWindow} reason={chartReason}
            range={range} onScrub={setScrub} onView={setView} />
        </div>

        <div className="seg" style={{ marginBottom: 20 }}>
          {RANGES.map(r => (
            <button key={r} className={range === r ? "on" : ""}
                    onClick={() => setRange(r)}>{r === "1Y" ? "All" : r}</button>
          ))}
        </div>

        {isPre && (
          <div className="card" style={{
            marginBottom: 14, background: "rgba(224,168,90,.08)", padding: 13,
          }}>
            <div style={{ fontSize: 12.5, color: "var(--warn)", lineHeight: 1.55 }}>
              Prices here move on single trades. You can buy and hold,
              but Wexel won't fire a rule on this.
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 9, marginBottom: 26 }}>
          {!isPre && (
            <button className="btn" onClick={() => setRuling(true)}>
              <Zap size={15} /> Set rule
            </button>
          )}
          <button className="btn btn-primary" onClick={() => setBuying(true)}>
            Buy {isPre ? asset.symbol : asset.ticker}
          </button>
        </div>

        <div className="label" style={{ marginBottom: 10 }}>About</div>
        <p style={{
          fontSize: 13.5, lineHeight: 1.7, color: "var(--muted)", margin: 0,
        }}>
          {asset.description ??
            `${asset.name} trades on Solana as a token backed 1:1 by the real share. It keeps trading when the stock market is closed.`}
        </p>
      </div>

      {ruling && (
        <RuleSheet
          ticker={isPre ? asset.symbol : asset.ticker}
          price={price}
          mint={asset.mint}
          onClose={() => setRuling(false)}
        />
      )}

      {buying && (
        <BuySheet
          ticker={isPre ? asset.symbol : asset.ticker}
          mint={asset.mint}
          price={price}
          canAutomate={!isPre}
          decimals={isPre ? undefined : asset.decimals}
          onClose={() => setBuying(false)}
        />
      )}
    </>
  );
}
