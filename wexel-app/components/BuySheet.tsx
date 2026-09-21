"use client";

import { useState, useEffect } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOL = "So11111111111111111111111111111111111111112";

type Props = {
  ticker: string;
  mint: string;
  price: number;
  canAutomate: boolean;
  onClose: () => void;
};

export function BuySheet({ ticker, mint, price, canAutomate, onClose }: Props) {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();

  const [payWith, setPayWith] = useState(USDC);
  const [amount, setAmount] = useState("25");
  const [slippage, setSlippage] = useState("100"); // basis points = 1%
  const [quote, setQuote] = useState<any>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  // Ask Jupiter what this trade would actually get you, whenever inputs change.
  useEffect(() => {
    const value = Number(amount);
    if (!value || value <= 0) { setQuote(null); return; }

    const timer = setTimeout(async () => {
      try {
        setStatus("finding best route…");
        // Input decimals: USDC is 6, SOL is 9.
        const decimals = payWith === SOL ? 9 : 6;
        const raw = Math.floor(value * 10 ** decimals);

        const res = await fetch(
          `/api/quote?inputMint=${payWith}&outputMint=${mint}&amount=${raw}&slippageBps=${slippage}`
        );
        if (!res.ok) throw new Error("no route");
        setQuote(await res.json());
        setStatus("");
      } catch {
        setQuote(null);
        setStatus("no route for this pair");
      }
    }, 400); // debounce so typing doesn't spam the API

    return () => clearTimeout(timer);
  }, [payWith, amount, slippage, mint]);

  async function buy() {
    if (!publicKey || !signTransaction || !quote) return;
    setBusy(true);
    try {
      setStatus("building transaction…");
      const res = await fetch("/api/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quote, user: publicKey.toBase58() }),
      });
      const { swapTransaction } = await res.json();

      const tx = VersionedTransaction.deserialize(
        Buffer.from(swapTransaction, "base64")
      );

      setStatus("approve in your wallet…");
      const signed = await signTransaction(tx);

      setStatus("sending…");
      const sig = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      });

      setStatus("confirming…");
      await connection.confirmTransaction(sig, "confirmed");
      setStatus(`done — ${sig.slice(0, 8)}…`);
    } catch (e: any) {
      setStatus(e.message ?? "failed");
    } finally {
      setBusy(false);
    }
  }

  const outAmount = quote
    ? Number(quote.outAmount) / 10 ** (quote.outputDecimals ?? 8)
    : 0;
  const impact = quote ? Number(quote.priceImpactPct) * 100 : 0;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "flex-end",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", background: "#0E0C16",
          borderTop: "1px solid var(--hair)",
          borderRadius: "22px 22px 0 0",
          padding: "20px 20px calc(24px + env(safe-area-inset-bottom, 0px))",
          maxHeight: "88vh", overflowY: "auto",
        }}
      >
        <div style={{
          width: 36, height: 4, borderRadius: 2, margin: "0 auto 18px",
          background: "rgba(255,255,255,0.15)",
        }} />

        <h2 style={{ fontSize: 22, marginBottom: 3 }}>Buy {ticker}</h2>
        <div className="mono" style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 20 }}>
          ${price.toLocaleString(undefined, { maximumFractionDigits: 2 })} per share
        </div>

        <label className="mono-label">Pay with</label>
        <select value={payWith} onChange={(e) => setPayWith(e.target.value)}
                style={{ marginTop: 8, marginBottom: 14 }}>
          <option value={USDC}>USDC</option>
          <option value={SOL}>SOL</option>
        </select>

        <label className="mono-label">Amount</label>
        <input type="number" inputMode="decimal" value={amount}
               onChange={(e) => setAmount(e.target.value)}
               style={{ marginTop: 8, marginBottom: 14 }} />

        <label className="mono-label">Max slippage</label>
        <select value={slippage} onChange={(e) => setSlippage(e.target.value)}
                style={{ marginTop: 8, marginBottom: 18 }}>
          <option value="50">0.5% — strict</option>
          <option value="100">1% — normal</option>
          <option value="300">3% — thin liquidity</option>
        </select>

        {quote && (
          <div className="card" style={{ marginBottom: 16 }}>
            <Row label="You receive" value={`${outAmount.toFixed(6)} ${ticker}x`} />
            <Row
              label="Price impact"
              value={`${impact.toFixed(2)}%`}
              tone={impact > 2 ? "bad" : undefined}
            />
            <Row label="Route" value={`${quote.routePlan?.length ?? 1} hop(s)`} />
          </div>
        )}

        {!canAutomate && (
          <div style={{
            fontSize: 12.5, color: "var(--warn)", marginBottom: 16,
            lineHeight: 1.5,
          }}>
            Pre-IPO prices move on single trades, so Wexel won't automate this one.
            You can still buy and hold it.
          </div>
        )}

        <button
          className="pill pill-primary"
          style={{ width: "100%", justifyContent: "center", padding: "14px" }}
          disabled={!publicKey || !quote || busy}
          onClick={buy}
        >
          {!publicKey ? "Connect wallet" : busy ? "Working…" : `Buy ${ticker}`}
        </button>

        {status && (
          <div className="mono" style={{
            fontSize: 12, color: "var(--text-3)", marginTop: 12, textAlign: "center",
          }}>{status}</div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between",
      padding: "7px 0", fontSize: 13,
    }}>
      <span style={{ color: "var(--text-3)" }}>{label}</span>
      <span className="mono" style={{ color: tone === "bad" ? "var(--bad)" : "var(--text)" }}>
        {value}
      </span>
    </div>
  );
}
