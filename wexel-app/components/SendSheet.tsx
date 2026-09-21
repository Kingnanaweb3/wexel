"use client";

import { useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
} from "@solana/spl-token";
import { ArrowLeft, Check, ExternalLink, AlertTriangle } from "lucide-react";

// Left behind on SOL "Max", so the wallet can still pay future fees.
const SOL_RESERVE = 0.002;

export function SendSheet({ onClose, onSent }: { onClose: () => void; onSent?: () => void }) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  const [holdings, setHoldings] = useState<any[]>([]);
  const [token, setToken] = useState<any>(null);
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<"edit" | "review" | "done">("edit");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [sig, setSig] = useState("");

  const devnet = (process.env.NEXT_PUBLIC_RPC_URL ?? "").includes("devnet");

  useEffect(() => {
    if (!publicKey) return;
    fetch(`/api/portfolio?owner=${publicKey.toBase58()}`)
      .then(r => r.json())
      .then(d => {
        const list = (d.holdings ?? []).filter((h: any) => h.raw && h.programId);
        setHoldings(list);
        setToken(list[0] ?? null);
      })
      .catch(() => setHoldings([]));
  }, [publicKey]);

  const isSol = token?.programId === "native";
  const max = token ? (isSol ? Math.max(0, token.amount - SOL_RESERVE) : token.amount) : 0;

  const recipient = useMemo(() => {
    try { return to.trim() ? new PublicKey(to.trim()) : null; } catch { return null; }
  }, [to]);

  const problem = useMemo(() => {
    if (to && !recipient) return "That isn't a valid Solana address.";
    if (recipient && publicKey && recipient.equals(publicKey)) return "That's your own address.";
    if (Number(amount) > max) return isSol
      ? `More than you can send — ${SOL_RESERVE} SOL stays behind for fees.`
      : "More than you hold.";
    return "";
  }, [to, recipient, publicKey, amount, max, isSol]);

  const ready = token && recipient && Number(amount) > 0 && !problem;

  async function send() {
    if (!publicKey || !recipient || !token) return;
    setBusy(true);
    try {
      const tx = new Transaction();

      if (isSol) {
        tx.add(SystemProgram.transfer({
          fromPubkey: publicKey, toPubkey: recipient,
          lamports: Math.round(Number(amount) * LAMPORTS_PER_SOL),
        }));
      } else {
        const programId = new PublicKey(token.programId);
        const mint = new PublicKey(token.mint);
        const source = new PublicKey(token.account);
        // allowOwnerOffCurve = true so program-owned recipients also work.
        const dest = getAssociatedTokenAddressSync(mint, recipient, true, programId);

        // Opens the recipient's account for this token if they've never held it.
        tx.add(createAssociatedTokenAccountIdempotentInstruction(
          publicKey, dest, recipient, mint, programId));

        // Convert the typed amount to base units IN PROPORTION to the raw
        // balance, rather than via decimals. This stays right for tokens whose
        // displayed amount is scaled, like PreStocks.
        const typed = Number(amount);
        const raw = typed >= token.amount
          ? BigInt(token.raw)
          : (BigInt(token.raw) * BigInt(Math.round(typed * 1e9))) /
            BigInt(Math.round(token.amount * 1e9));

        tx.add(createTransferCheckedInstruction(
          source, mint, dest, publicKey, raw, token.decimals, [], programId));
      }

      setStatus("Approve in your wallet…");
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;

      const s = await sendTransaction(tx, connection);
      setStatus("Confirming…");
      await connection.confirmTransaction({ signature: s, blockhash, lastValidBlockHeight }, "confirmed");

      setSig(s);
      setStep("done");
      onSent?.();
    } catch (e: any) {
      setStatus(e.message?.includes("rejected") ? "Cancelled in wallet" : "Send failed — nothing left your wallet");
    } finally {
      setBusy(false);
    }
  }

  const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-6)}`;

  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="grab" />

        {step === "edit" && (
          <>
            <h2 style={{ fontSize: 20, marginBottom: 4 }}>Send or withdraw</h2>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 18px" }}>
              To another wallet, or an exchange deposit address.
            </p>

            <div className="label" style={{ marginBottom: 8 }}>Token</div>
            {!holdings.length && (
              <div style={{ fontSize: 13, color: "var(--faint)", marginBottom: 16 }}>
                Nothing in this wallet to send yet.
              </div>
            )}
            <div style={{ display: "flex", gap: 7, overflowX: "auto", marginBottom: 18, paddingBottom: 2 }}>
              {holdings.map(h => (
                <button key={h.account} onClick={() => { setToken(h); setAmount(""); }}
                  style={{
                    flexShrink: 0, display: "flex", alignItems: "center", gap: 7,
                    padding: "9px 12px", borderRadius: 11, border: 0, cursor: "pointer",
                    background: token?.account === h.account ? "var(--selected)" : "var(--idle)",
                    color: "var(--ink)", fontSize: 13,
                  }}>
                  {h.icon && <img src={h.icon} alt="" width={18} height={18} style={{ borderRadius: 5 }} />}
                  <span className="mono">{h.symbol}</span>
                </button>
              ))}
            </div>

            <div className="label" style={{ marginBottom: 8 }}>To</div>
            <input placeholder="Solana address" value={to}
                   onChange={e => setTo(e.target.value)}
                   spellCheck={false} autoCapitalize="off" autoCorrect="off"
                   className="mono" style={{ fontSize: 13, marginBottom: 16 }} />

            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span className="label">Amount</span>
              {token && (
                <span className="num" style={{ fontSize: 12, color: "var(--faint)" }}>
                  Available {max.toLocaleString(undefined, { maximumFractionDigits: 6 })} {token.symbol}
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <input type="number" inputMode="decimal" placeholder="0.00"
                     value={amount} onChange={e => setAmount(e.target.value)}
                     className="num" style={{ flex: 1, fontSize: 16 }} />
              <button onClick={() => setAmount(String(max))} style={{
                padding: "0 16px", borderRadius: 11, border: 0, cursor: "pointer",
                background: "var(--idle)", color: "var(--ink)", fontSize: 13,
              }}>Max</button>
            </div>

            {token?.price > 0 && Number(amount) > 0 && (
              <div className="num" style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 12 }}>
                ≈ ${(Number(amount) * token.price).toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
            )}

            {problem && (
              <div style={{
                display: "flex", gap: 8, fontSize: 12.5, color: "var(--warn)",
                lineHeight: 1.5, marginBottom: 14,
              }}>
                <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} /> {problem}
              </div>
            )}

            <button className="btn btn-primary" disabled={!ready} onClick={() => setStep("review")}>
              Review
            </button>
          </>
        )}

        {step === "review" && token && recipient && (
          <>
            <button onClick={() => setStep("edit")} style={{
              display: "flex", alignItems: "center", gap: 6, background: "none", border: 0,
              color: "var(--muted)", fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 16,
            }}><ArrowLeft size={15} /> Edit</button>

            <h2 style={{ fontSize: 20, marginBottom: 16 }}>Review</h2>

            <div className="card" style={{ padding: "4px 16px", marginBottom: 14 }}>
              <Row label="Sending" value={`${amount} ${token.symbol}`} />
              {token.price > 0 && (
                <Row label="Worth about" value={`$${(Number(amount) * token.price).toFixed(2)}`} />
              )}
              <Row label="To" value={short(recipient.toBase58())} />
              <Row label="Network fee" value="< 0.0001 SOL" last={isSol} />
              {!isSol && (
                <Row label="If they're new to this token" value="+ ~0.002 SOL to open their account" last />
              )}
            </div>

            <div className="mono" style={{
              fontSize: 11.5, color: "var(--faint)", wordBreak: "break-all",
              lineHeight: 1.6, marginBottom: 14,
            }}>
              {recipient.toBase58()}
            </div>

            <p style={{ fontSize: 12, color: "var(--faint)", lineHeight: 1.6, margin: "0 0 16px" }}>
              Check the address. Transfers on Solana can't be reversed. If your exchange
              asks for a memo or tag, don't send from here yet.
            </p>

            <button className="btn btn-primary" disabled={busy} onClick={send}>
              {busy ? "Working…" : `Send ${amount} ${token.symbol}`}
            </button>

            {status && (
              <div className="mono" style={{
                fontSize: 11.5, color: "var(--faint)", marginTop: 12, textAlign: "center",
              }}>{status}</div>
            )}
          </>
        )}

        {step === "done" && (
          <div style={{ textAlign: "center", padding: "10px 0 4px" }}>
            <div style={{
              width: 54, height: 54, borderRadius: "50%", margin: "0 auto 16px",
              display: "grid", placeItems: "center",
              background: "var(--selected)", color: "var(--good)",
            }}><Check size={26} /></div>
            <h2 style={{ fontSize: 20, marginBottom: 6 }}>Sent</h2>
            <p className="num" style={{ fontSize: 13.5, color: "var(--muted)", margin: "0 0 20px" }}>
              {amount} {token?.symbol} to {recipient && short(recipient.toBase58())}
            </p>
            <a href={`https://explorer.solana.com/tx/${sig}${devnet ? "?cluster=devnet" : ""}`}
               target="_blank" rel="noreferrer"
               style={{
                 display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13,
                 color: "var(--accent)", textDecoration: "none", marginBottom: 20,
               }}>
              View on explorer <ExternalLink size={13} />
            </a>
            <button className="btn" onClick={onClose}>Done</button>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", gap: 12, padding: "11px 0",
      fontSize: 13, borderBottom: last ? "none" : "1px solid var(--line)",
    }}>
      <span style={{ color: "var(--faint)" }}>{label}</span>
      <span className="num" style={{ textAlign: "right" }}>{value}</span>
    </div>
  );
}
