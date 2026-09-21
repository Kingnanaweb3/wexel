"use client";

import { useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";
import { Check, ExternalLink, Info } from "lucide-react";
import { IS_DEVNET, explorerTx } from "@/lib/network";

const PAY = [
  { symbol: "USDC", mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", decimals: 6 },
  { symbol: "SOL",  mint: "So11111111111111111111111111111111111111112", decimals: 9 },
];
const AMOUNTS = ["10", "25", "50"];
const SLIPPAGE = [50, 100, 300];

type Props = {
  ticker: string; mint: string; price: number;
  canAutomate: boolean; decimals?: number; onClose: () => void;
};

// Turns wallet/RPC errors into something a person can act on — and always
// says whether money moved.
function friendly(e: any): string {
  const m = String(e?.message ?? e ?? "").toLowerCase();
  if (m.includes("rejected")) return "Cancelled in your wallet. Nothing was spent.";
  if (m.includes("address table") || m.includes("blockhash not found"))
    return "This network can't run the trade. Nothing was spent.";
  if (m.includes("0x1771") || m.includes("slippage"))
    return "Price moved more than your slippage limit. Nothing was spent — try again or allow more slippage.";
  if (m.includes("insufficient") || m.includes("0x1"))
    return "Not enough balance for this trade, including fees. Nothing was spent.";
  return "Trade didn't go through. Nothing left your wallet.";
}

export function BuySheet({ ticker, mint, price, canAutomate, decimals, onClose }: Props) {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();

  const [pay, setPay] = useState(PAY[0]);
  const [amount, setAmount] = useState("25");
  const [slippage, setSlippage] = useState(100);
  const [quote, setQuote] = useState<any>(null);
  const [quoteError, setQuoteError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sig, setSig] = useState("");

  // Live quote, debounced so typing doesn't spam the API.
  useEffect(() => {
    const v = Number(amount);
    setQuote(null); setQuoteError("");
    if (!v || v <= 0) return;
    const t = setTimeout(async () => {
      try {
        const raw = Math.floor(v * 10 ** pay.decimals);
        const res = await fetch(`/api/quote?inputMint=${pay.mint}&outputMint=${mint}&amount=${raw}&slippageBps=${slippage}`);
        if (!res.ok) throw new Error();
        setQuote(await res.json());
      } catch {
        setQuoteError(`No route from ${pay.symbol} to ${ticker} right now.`);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [pay, amount, slippage, mint, ticker]);

  async function buy() {
    if (!publicKey || !signTransaction || !quote) return;
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/swap", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quote, user: publicKey.toBase58() }),
      });
      if (!res.ok) throw new Error("build failed");
      const { swapTransaction } = await res.json();

      const tx = VersionedTransaction.deserialize(Buffer.from(swapTransaction, "base64"));
      const signed = await signTransaction(tx);
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      const s = await connection.sendRawTransaction(signed.serialize(), { maxRetries: 3 });
      await connection.confirmTransaction({ signature: s, blockhash, lastValidBlockHeight }, "confirmed");
      setSig(s);
    } catch (e) {
      setError(friendly(e));
    } finally {
      setBusy(false);
    }
  }

  const impact = quote ? Number(quote.priceImpactPct) * 100 : 0;
  const shares = quote && decimals !== undefined ? Number(quote.outAmount) / 10 ** decimals : null;

  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="grab" />

        {sig ? (
          <div style={{ textAlign: "center", padding: "10px 0 4px" }}>
            <div style={{ width: 54, height: 54, borderRadius: "50%", margin: "0 auto 16px", display: "grid",
                          placeItems: "center", background: "var(--selected)", color: "var(--good)" }}>
              <Check size={26} />
            </div>
            <h2 style={{ fontSize: 20, marginBottom: 6 }}>Bought {ticker}</h2>
            <p className="num" style={{ fontSize: 13.5, color: "var(--muted)", margin: "0 0 20px" }}>
              {shares !== null ? `${shares.toFixed(6)} ${ticker}` : `$${amount} of ${ticker}`} is in your wallet.
            </p>
            <a href={explorerTx(sig)} target="_blank" rel="noreferrer" style={{
              display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13,
              color: "var(--accent)", textDecoration: "none", marginBottom: 20,
            }}>View on explorer <ExternalLink size={13} /></a>
            <button className="btn" onClick={onClose}>Done</button>
          </div>
        ) : (
          <>
            <h2 style={{ fontSize: 20, marginBottom: 4 }}>Buy {ticker}</h2>
            <p className="num" style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 20px" }}>
              ${price.toLocaleString(undefined, { maximumFractionDigits: 2 })} per share
            </p>

            <div className="label" style={{ marginBottom: 8 }}>Pay with</div>
            <div style={{ display: "flex", gap: 7, marginBottom: 18 }}>
              {PAY.map(p => (
                <button key={p.symbol} onClick={() => setPay(p)} style={chip(pay.symbol === p.symbol)}>{p.symbol}</button>
              ))}
            </div>

            <div className="label" style={{ marginBottom: 8 }}>Amount ({pay.symbol})</div>
            <div style={{ display: "flex", gap: 7, marginBottom: 18 }}>
              {pay.symbol === "USDC" && AMOUNTS.map(a => (
                <button key={a} onClick={() => setAmount(a)} style={chip(amount === a)}>${a}</button>
              ))}
              <input type="number" inputMode="decimal" value={amount}
                     onChange={e => setAmount(e.target.value)}
                     className="num" style={{ flex: 1.4, padding: "10px 12px", fontSize: 14, borderRadius: 11 }} />
            </div>

            <div className="label" style={{ marginBottom: 8 }}>Max slippage</div>
            <div style={{ display: "flex", gap: 7, marginBottom: 20 }}>
              {SLIPPAGE.map(s => (
                <button key={s} onClick={() => setSlippage(s)} style={chip(slippage === s)}>{s / 100}%</button>
              ))}
            </div>

            <div className="card" style={{ padding: "4px 16px", marginBottom: 14, minHeight: 50 }}>
              {quote ? (
                <>
                  <Row label="You receive" value={shares !== null ? `≈ ${shares.toFixed(6)} ${ticker}` : `≈ $${amount} of ${ticker}`} />
                  <Row label="Price impact" value={`${impact.toFixed(2)}%`} tone={impact > 2 ? "var(--bad)" : undefined} />
                  <Row label="Route" value={`${quote.routePlan?.length ?? 1} step${quote.routePlan?.length === 1 ? "" : "s"}`} last />
                </>
              ) : (
                <div style={{ padding: "14px 0", fontSize: 13, color: quoteError ? "var(--warn)" : "var(--faint)" }}>
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
              {IS_DEVNET ? "Buying needs mainnet"
                : !publicKey ? "Connect wallet"
                : busy ? "Approve in your wallet…"
                : `Buy ${ticker}`}
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

function chip(on: boolean): React.CSSProperties {
  return {
    flex: 1, padding: "10px 6px", borderRadius: 11, cursor: "pointer", fontSize: 13,
    fontFamily: "var(--sans)", border: 0,
    background: on ? "var(--selected)" : "var(--idle)",
    color: on ? "var(--ink)" : "var(--muted)", fontWeight: on ? 500 : 400,
  };
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
