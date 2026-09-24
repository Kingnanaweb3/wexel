"use client";

import { useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Check, ExternalLink, Info } from "lucide-react";
import { IS_DEVNET, explorerTx } from "@/lib/network";
import { TokenPicker } from "./TokenPicker";
import { friendly, getQuote, loadHoldings, runSwap, spendable, toRaw, type Holding } from "@/lib/swap";
import { fmtAmount } from "@/lib/format";

const SLIPPAGE = [50, 100, 300];

type Props = {
  ticker: string; mint: string; price: number;
  canAutomate: boolean; decimals?: number; onClose: () => void;
};

export function BuySheet({ ticker, mint, price, canAutomate, decimals, onClose }: Props) {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();

  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [pay, setPay] = useState<Holding | undefined>();
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState(100);
  const [quote, setQuote] = useState<any>(null);
  const [quoteError, setQuoteError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sig, setSig] = useState("");

  // Anything in the wallet can pay, except the stock being bought.
  useEffect(() => {
    if (!publicKey) return;
    loadHoldings(publicKey.toBase58()).then((hs) => {
      const usable = hs.filter((h) => h.mint !== mint);
      setHoldings(usable);
      const first = usable.find((h) => h.symbol === "USDC") ?? usable[0];
      setPay(first);
      if (first) setAmount(first.symbol === "USDC" ? "25" : "");
    });
  }, [publicKey, mint]);

  useEffect(() => {
    const v = Number(amount);
    setQuote(null); setQuoteError("");
    if (!pay || !v || v <= 0) return;
    if (v > spendable(pay)) { setQuoteError(`You only have ${fmtAmount(spendable(pay))} ${pay.symbol}.`); return; }

    const t = setTimeout(async () => {
      try { setQuote(await getQuote(pay.mint, mint, toRaw(pay, v), slippage)); }
      catch { setQuoteError(`No route from ${pay.symbol} to ${ticker} right now.`); }
    }, 400);
    return () => clearTimeout(t);
  }, [pay, amount, slippage, mint, ticker]);

  async function buy() {
    if (!publicKey || !signTransaction || !quote) return;
    setBusy(true); setError("");
    try { setSig(await runSwap(connection, quote, publicKey, signTransaction)); }
    catch (e) { console.error("[wexel] raw error:", e); setError(friendly(e)); }
    finally { setBusy(false); }
  }

  const shares = quote && decimals !== undefined ? Number(quote.outAmount) / 10 ** decimals : null;
  const impact = quote ? Number(quote.priceImpactPct) * 100 : 0;
  const usdValue = pay && Number(amount) > 0 ? Number(amount) * pay.price : 0;

  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="grab" />

        {sig ? (
          <div style={{ textAlign: "center", padding: "10px 0 4px" }}>
            <div style={{ width: 54, height: 54, borderRadius: "50%", margin: "0 auto 16px", display: "grid",
                          placeItems: "center", background: "var(--selected)", color: "var(--good)" }}>
              <Check size={26} />
            </div>
            <h2 style={{ fontSize: 18, marginBottom: 6 }}>Bought {ticker}</h2>
            <p className="num" style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 20px" }}>
              {shares !== null ? `${shares.toFixed(6)} ${ticker}` : ticker} is in your wallet.
            </p>
            <a href={explorerTx(sig)} target="_blank" rel="noreferrer" style={{
              display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13,
              color: "var(--accent)", textDecoration: "none", marginBottom: 20 }}>
              View on explorer <ExternalLink size={13} />
            </a>
            <button className="btn" onClick={onClose}>Done</button>
          </div>
        ) : (
          <>
            <h2 style={{ fontSize: 18, marginBottom: 4 }}>Buy {ticker}</h2>
            <p className="num" style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 18px" }}>
              ${price.toLocaleString(undefined, { maximumFractionDigits: 2 })} per share
            </p>

            <div className="label" style={{ marginBottom: 8 }}>Pay with</div>
            {holdings.length ? (
              <TokenPicker holdings={holdings} value={pay} onChange={(h) => { setPay(h); setAmount(""); }} />
            ) : (
              <div style={{ fontSize: 13, color: "var(--faint)" }}>
                {publicKey ? "Nothing in this wallet to pay with yet." : "Connect a wallet first."}
              </div>
            )}

            {pay && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", margin: "18px 0 8px" }}>
                  <span className="label">Amount</span>
                  <span className="num" style={{ fontSize: 12, color: "var(--faint)" }}>
                    {fmtAmount(spendable(pay))} {pay.symbol} available
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  <input type="number" inputMode="decimal" placeholder="0.00" value={amount}
                         onChange={(e) => setAmount(e.target.value)} className="num" style={{ flex: 1 }} />
                  <button onClick={() => setAmount(String(spendable(pay)))} style={{
                    padding: "0 16px", borderRadius: 14, border: 0, cursor: "pointer",
                    background: "var(--idle)", color: "var(--ink)", fontSize: 14 }}>Max</button>
                </div>
                {usdValue > 0 && (
                  <div className="num" style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 14 }}>
                    ≈ ${usdValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </div>
                )}
              </>
            )}

            <div className="label" style={{ marginBottom: 8 }}>Max slippage</div>
            <div style={{ display: "flex", gap: 7, marginBottom: 18 }}>
              {SLIPPAGE.map((s) => (
                <button key={s} onClick={() => setSlippage(s)} style={{
                  flex: 1, padding: "10px 6px", borderRadius: 14, border: 0, cursor: "pointer",
                  fontSize: 14, fontFamily: "var(--sans)",
                  background: slippage === s ? "var(--selected)" : "var(--idle)",
                  color: slippage === s ? "var(--ink)" : "var(--muted)",
                  fontWeight: slippage === s ? 600 : 400 }}>{s / 100}%</button>
              ))}
            </div>

            <div className="card" style={{ padding: "4px 16px", marginBottom: 14, minHeight: 48 }}>
              {quote ? (
                <>
                  <Row label="You receive" value={shares !== null ? `≈ ${shares.toFixed(6)} ${ticker}` : `≈ ${ticker}`} />
                  <Row label="Price impact" value={`${impact.toFixed(2)}%`} tone={impact > 2 ? "var(--bad)" : undefined} />
                  <Row label="Route" value={`${quote.routePlan?.length ?? 1} step${quote.routePlan?.length === 1 ? "" : "s"}`} last />
                </>
              ) : (
                <div style={{ padding: "13px 0", fontSize: 13, color: quoteError ? "var(--warn)" : "var(--faint)" }}>
                  {quoteError || (Number(amount) > 0 ? "Finding the best price…" : "Enter an amount")}
                </div>
              )}
            </div>

            {!canAutomate && (
              <p style={{ fontSize: 12.5, color: "var(--warn)", lineHeight: 1.55, margin: "0 0 14px" }}>
                Pre-IPO prices move on single trades, so Wexel won't automate this one. You can still buy and hold it.
              </p>
            )}
            {IS_DEVNET && (
              <div style={{ display: "flex", gap: 8, fontSize: 12.5, color: "var(--muted)", lineHeight: 1.55, marginBottom: 14 }}>
                <Info size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                You're on devnet. This is a live mainnet quote, but real stocks can only be bought on mainnet.
              </div>
            )}

            <button className="btn btn-primary" disabled={IS_DEVNET || !publicKey || !quote || busy} onClick={buy}>
              {IS_DEVNET ? "Buying needs mainnet" : !publicKey ? "Connect wallet"
                : busy ? "Working…" : `Buy ${ticker}`}
            </button>

            {error && (
              <p style={{ fontSize: 12.5, color: "var(--warn)", lineHeight: 1.55, textAlign: "center", margin: "12px 0 0" }}>
                {error}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, tone, last }: { label: string; value: string; tone?: string; last?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "11px 0", fontSize: 13,
                  borderBottom: last ? "none" : "1px solid var(--line)" }}>
      <span style={{ color: "var(--faint)" }}>{label}</span>
      <span className="num" style={{ color: tone ?? "var(--ink)" }}>{value}</span>
    </div>
  );
}
