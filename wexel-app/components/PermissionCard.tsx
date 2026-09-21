"use client";

import { useCallback, useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Transaction } from "@solana/web3.js";
import { createRevokeInstruction, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { ShieldCheck } from "lucide-react";
import { authorityPda } from "@/lib/program";
import { USDC_MINT } from "@/lib/network";

// Shows exactly what Wexel is allowed to spend, token by token, with revoke.
export function PermissionCard() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();
  const [items, setItems] = useState<any[]>([]);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    if (!publicKey) return;
    const authority = authorityPda().toBase58();
    const found: any[] = [];
    for (const programId of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
      const res = await connection.getParsedTokenAccountsByOwner(publicKey, { programId });
      for (const a of res.value) {
        const info = a.account.data.parsed.info;
        if (info.delegate === authority && Number(info.delegatedAmount?.amount ?? 0) > 0) {
          found.push({ account: a.pubkey, mint: info.mint, programId, ui: info.delegatedAmount.uiAmountString });
        }
      }
    }
    setItems(found);
  }, [connection, publicKey]);

  useEffect(() => { load(); }, [load]);

  if (!publicKey) return null;

  const label = (m: string) => m === USDC_MINT.toBase58() ? "USDC" : `${m.slice(0, 4)}…${m.slice(-4)}`;

  async function revoke() {
    if (!publicKey) return;
    setBusy(true);
    try {
      const tx = new Transaction();
      for (const i of items) tx.add(createRevokeInstruction(i.account, publicKey, [], i.programId));
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
      setItems([]);
      setMsg("Approval removed. Wexel can't spend anything now.");
    } catch (e: any) {
      setMsg(e.message?.includes("rejected") ? "Kept — cancelled in wallet" : "Could not revoke");
    } finally {
      setBusy(false);
      setConfirm(false);
    }
  }

  return (
    <>
      <div className="card" style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <ShieldCheck size={17} color={items.length ? "var(--good)" : "var(--faint)"} />
          <span style={{ fontSize: 14, fontWeight: 500 }}>Spending permission</span>
        </div>

        {items.length === 0 ? (
          <p style={{ fontSize: 12.5, color: "var(--muted)", lineHeight: 1.6, margin: 0 }}>
            {msg || "Wexel can't spend anything from your wallet. Setting a rule asks for a capped approval."}
          </p>
        ) : (
          <>
            {items.map(i => (
              <div key={i.account.toBase58()} style={{
                display: "flex", justifyContent: "space-between", fontSize: 13, padding: "6px 0",
              }}>
                <span style={{ color: "var(--muted)" }}>Can spend up to</span>
                <span className="num">{i.ui} {label(i.mint)}</span>
              </div>
            ))}
            <p style={{ fontSize: 12, color: "var(--faint)", lineHeight: 1.6, margin: "8px 0 12px" }}>
              Your funds stay in your wallet. Wexel can only move them to execute your rules, within these limits.
            </p>
            <button onClick={() => setConfirm(true)} style={{
              width: "100%", padding: 11, borderRadius: 11, border: 0, cursor: "pointer",
              background: "var(--idle)", color: "var(--bad)", fontSize: 13,
            }}>Revoke</button>
          </>
        )}
      </div>

      {confirm && (
        <div className="sheet-bg" onClick={() => setConfirm(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="grab" />
            <h2 style={{ fontSize: 19, marginBottom: 8 }}>Revoke Wexel's permission?</h2>
            <p style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.6, margin: "0 0 20px" }}>
              Wexel won't be able to spend anything from your wallet. Your active rules will
              stop trading until you set them up again.
            </p>
            <div style={{ display: "flex", gap: 9 }}>
              <button className="btn" onClick={() => setConfirm(false)}>Keep it</button>
              <button className="btn" disabled={busy} onClick={revoke}
                      style={{ background: "var(--bad)", color: "#fff", border: 0 }}>
                {busy ? "Working…" : "Revoke"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
