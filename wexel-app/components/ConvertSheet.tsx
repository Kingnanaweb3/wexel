"use client";

import { useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Check, ExternalLink } from "lucide-react";
import { explorerTx } from "@/lib/network";
import { TokenPicker } from "./TokenPicker";
import { friendly, getQuote, loadHoldings, runSwap, spendable, toRaw, USDC_MINT_STR, type Holding } from "@/lib/swap";
import { fmtAmount } from "@/lib/format";

// Turn any token into cash (USDC), the way you'd sell a coin before buying.
export function ConvertSheet({ onClose, onDone }: { onClose: () => void; onDone?: () => void }) {
  const { connection } = useConnection();
  const { publicKey, signTransaction } = useWallet();

  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [from, setFrom] = useState<Holding | undefined>();
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<any>(null);
  const [quoteError, setQuoteError] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sig, setSig] = useState("");

  useEffect(() => {
    if (!publicKey) return;
    loadHoldings(publicKey.toBase58()).then((hs) => {
      const usable = hs.filter((h) => h.mint !== USDC_MINT_STR);
      setHoldings(usable);
      setFrom(usable[0]);
    });
  }, [publicKey]);

  useEffect(() => {
    const v = Number(amount);
    setQuote(null); setQuoteError("");
    if (!from || !v || v <= 0) return;
    if (v > spendable(from)) { setQuoteError(`You only have ${fmtAmount(spendable(from))} ${from.symbol}.`); return; }
    const t = setTimeout(async () => {
      try { setQuote(await getQuote(from.mint, USDC_MINT_STR, toRaw(from, v), 100)); }
      catch { setQuoteError(`No route from ${from.symbol} to USDC right now.`); }
    }, 400);
    return () => clearTimeout(t);
  }, [from, amount]);

  async function convert() {
    if (!publicKey || !signTransaction || !quote) return;
    setBusy(true); setError("");
    try {
      setSig(await runSwap(connection, quote, publicKey, signTransaction));
      onDone?.();
    } catch (e) { console.error("[wexel] raw error:", e); setError(friendly(e)); }
    finally { setBusy(false); }
  }

  const cash = quote ? Number(quote.outAmount) / 1e6 : 0;

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
            <h2 style={{ fontSize: 18, marginBottom: 6 }}>Converted to cash</h2>
            <p className="num" style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 20px" }}>
              ${cash.toFixed(2)} USDC is in your wallet.
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
            <h2 style={{ fontSize: 18, marginBottom: 4 }}>Convert to cash</h2>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 18px" }}>
              Turn any token into USDC, ready to buy stocks with.
            </p>

            <div className="label" style={{ marginBottom: 8 }}>Convert</div>
            {holdings.length ? (
              <TokenPicker holdings={holdings} value={from} onChange={(h) => { setFrom(h); setAmount(""); }} />
            ) : (
              <div style={{ fontSize: 13, color: "var(--faint)" }}>Nothing to convert — you're all in cash.</div>
            )}

            {from && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", margin: "18px 0 8px" }}>
                  <span className="label">Amount</span>
                  <span className="num" style={{ fontSize: 12, color: "var(--faint)" }}>
                    {fmtAmount(spendable(from))} {from.symbol} available
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
                  <input type="number" inputMode="decimal" placeholder="0.00" value={amount}
                         onChange={(e) => setAmount(e.target.value)} className="num" style={{ flex: 1 }} />
                  <button onClick={() => setAmount(String(spendable(from)))} style={{
                    padding: "0 16px", borderRadius: 14, border: 0, cursor: "pointer",
                    background: "var(--idle)", color: "var(--ink)", fontSize: 14 }}>Max</button>
                </div>

                <div className="card" style={{ padding: 16, marginBottom: 16, minHeight: 48 }}>
                  {quote ? (
                    <div className="num" style={{ fontSize: 20, fontWeight: 600 }}>
                      ≈ ${cash.toFixed(2)} <span style={{ fontSize: 14, color: "var(--faint)", fontWeight: 400 }}>USDC</span>
                    </div>
                  ) : (
                    <div style={{ fontSize: 13, color: quoteError ? "var(--warn)" : "var(--faint)" }}>
                      {quoteError || (Number(amount) > 0 ? "Finding the best price…" : "Enter an amount")}
                    </div>
                  )}
                </div>
              </>
            )}

            <button className="btn btn-primary" disabled={!publicKey || !quote || busy} onClick={convert}>
              {busy ? "Working…" : "Convert"}
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
