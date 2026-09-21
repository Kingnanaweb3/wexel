"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useConnection, useWallet, useAnchorWallet } from "@solana/wallet-adapter-react";
import { Keypair, SystemProgram } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { Minus, Plus, ChevronDown, ArrowLeft, AlertTriangle } from "lucide-react";
import { getProgram } from "@/lib/program";
import { RuleTrack } from "./RuleTrack";

type Props = { ticker: string; price: number; onClose: () => void };

const PRESETS = [
  { id: "dip",    label: "Buy the dip", dir: "down", pct: 5,  action: "buy"  },
  { id: "profit", label: "Take profit", dir: "up",   pct: 20, action: "sell" },
  { id: "stop",   label: "Stop loss",   dir: "down", pct: 10, action: "sell" },
] as const;

const PCT_CHIPS = [5, 10, 15, 20];
const AMOUNT_CHIPS = [25, 50, 100];

export function RuleSheet({ ticker, price, onClose }: Props) {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const { publicKey } = useWallet();
  const router = useRouter();

  const [preset, setPreset] = useState<typeof PRESETS[number]>(PRESETS[0]);
  const [mode, setMode] = useState<"pct" | "price">("pct");
  const [pct, setPct] = useState(5);
  const [amount, setAmount] = useState("50");
  const [slippage, setSlippage] = useState(100);
  const [days, setDays] = useState(30);
  const [advanced, setAdvanced] = useState(false);
  const [step, setStep] = useState<"edit" | "review">("edit");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const down = preset.dir === "down";
  const target = down ? price * (1 - pct / 100) : price * (1 + pct / 100);

  // Price mode: user types a dollar target, we derive the percentage.
  function setFromPrice(v: string) {
    const p = Number(v);
    if (!p || p <= 0) return;
    const derived = Math.abs((p - price) / price) * 100;
    setPct(Math.round(derived * 100) / 100);
  }

  function nudge(by: number) {
    setPct(p => Math.max(0.5, Math.min(90, Math.round((p + by) * 10) / 10)));
  }

  function choose(p: typeof PRESETS[number]) {
    setPreset(p);
    setPct(p.pct);
  }

  // Guard against rules that would fire on ordinary price noise,
  // or that could never realistically fire.
  const warning = useMemo(() => {
    if (pct < 2) return "Under 2% — normal daily movement could fire this.";
    if (pct > 50) return "Over 50% — this may never trigger before it expires.";
    if (Number(amount) <= 0) return "Enter an amount above zero.";
    return "";
  }, [pct, amount]);

  const sentence = `When ${ticker} ${down ? "falls" : "rises"} ${pct}% to $${target.toFixed(2)}, ${
    preset.action === "buy" ? "buy" : "sell"
  } $${amount}.`;

  async function create() {
    if (!wallet || !publicKey) return;
    setBusy(true);
    try {
      setStatus("Approve in your wallet…");
      const program = getProgram(connection, wallet);
      const rule = Keypair.generate();
      const raw = new anchor.BN(Math.floor(Number(amount) * 1e6));
      const expiry = Math.floor(Date.now() / 1000) + days * 86400;

      await program.methods
        .createRule(
          ticker,
          down ? { down: {} } : { up: {} },
          pct,
          price,
          preset.action === "buy" ? { buy: {} } : { swapToUsdc: {} },
          raw, raw, slippage, new anchor.BN(expiry)
        )
        .accounts({ rule: rule.publicKey, owner: publicKey, systemProgram: SystemProgram.programId })
        .signers([rule])
        .rpc();

      setStatus("Rule is live");
      setTimeout(() => { onClose(); router.push("/rules"); }, 900);
    } catch (e: any) {
      setStatus(e.message?.includes("rejected") ? "Cancelled in wallet" : "Could not create rule");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="grab" />

        {step === "edit" ? (
          <>
            <h2 style={{ fontSize: 20, marginBottom: 4 }}>Set a rule</h2>
            <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 18px" }}>
              {ticker} is ${price.toFixed(2)} right now.
            </p>

            {/* 1. What kind of rule */}
            <div className="seg" style={{ marginBottom: 22 }}>
              {PRESETS.map(p => (
                <button key={p.id} className={preset.id === p.id ? "on" : ""}
                        onClick={() => choose(p)}>{p.label}</button>
              ))}
            </div>

            {/* 2. When — stepper, typeable, with % / $ toggle */}
            <div style={{
              display: "flex", justifyContent: "space-between",
              alignItems: "center", marginBottom: 10,
            }}>
              <span className="label">When it {down ? "falls" : "rises"}</span>
              <div className="seg" style={{ padding: 2, boxShadow: "none" }}>
                <button className={mode === "pct" ? "on" : ""}
                        style={{ padding: "5px 12px", fontSize: 12 }}
                        onClick={() => setMode("pct")}>%</button>
                <button className={mode === "price" ? "on" : ""}
                        style={{ padding: "5px 12px", fontSize: 12 }}
                        onClick={() => setMode("price")}>$</button>
              </div>
            </div>

            <div className="card" style={{
              display: "flex", alignItems: "center", gap: 10, padding: 10, marginBottom: 10,
            }}>
              <button onClick={() => nudge(mode === "pct" ? -1 : -0.5)}
                      className="icon-chip" style={stepBtn} aria-label="Decrease">
                <Minus size={18} />
              </button>

              <div style={{ flex: 1, textAlign: "center" }}>
                {mode === "pct" ? (
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 2 }}>
                    <span className="num" style={{ fontSize: 30, color: down ? "var(--bad)" : "var(--good)" }}>
                      {down ? "−" : "+"}
                    </span>
                    <input
                      type="number" inputMode="decimal" value={pct}
                      onChange={e => setPct(Number(e.target.value) || 0)}
                      className="num"
                      style={{
                        width: `${String(pct).length + 1}ch`, minWidth: "2ch",
                        background: "none", border: 0, padding: 0,
                        fontSize: 30, textAlign: "center", color: "var(--ink)",
                      }}
                    />
                    <span className="num" style={{ fontSize: 22, color: "var(--faint)" }}>%</span>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 2 }}>
                    <span className="num" style={{ fontSize: 22, color: "var(--faint)" }}>$</span>
                    <input
                      type="number" inputMode="decimal"
                      defaultValue={target.toFixed(2)}
                      key={`${preset.id}-${pct}`}
                      onBlur={e => setFromPrice(e.target.value)}
                      className="num"
                      style={{
                        width: "6ch", background: "none", border: 0, padding: 0,
                        fontSize: 30, textAlign: "center", color: "var(--ink)",
                      }}
                    />
                  </div>
                )}
                <div className="num" style={{ fontSize: 12, color: "var(--faint)", marginTop: 2 }}>
                  {mode === "pct"
                    ? `fires at $${target.toFixed(2)}`
                    : `${down ? "−" : "+"}${pct}% from now`}
                </div>
              </div>

              <button onClick={() => nudge(mode === "pct" ? 1 : 0.5)}
                      className="icon-chip" style={stepBtn} aria-label="Increase">
                <Plus size={18} />
              </button>
            </div>

            {/* Quick chips */}
            <div style={{ display: "flex", gap: 7, marginBottom: 22 }}>
              {PCT_CHIPS.map(c => (
                <button key={c} onClick={() => setPct(c)} style={chip(pct === c)}>
                  {down ? "−" : "+"}{c}%
                </button>
              ))}
            </div>

            {/* 3. How much */}
            <div className="label" style={{ marginBottom: 10 }}>
              Then {preset.action === "buy" ? "buy" : "sell"}
            </div>
            <div style={{ display: "flex", gap: 7, marginBottom: 10 }}>
              {AMOUNT_CHIPS.map(a => (
                <button key={a} onClick={() => setAmount(String(a))}
                        style={chip(amount === String(a))}>${a}</button>
              ))}
              <input
                type="number" inputMode="decimal" placeholder="Custom"
                value={AMOUNT_CHIPS.includes(Number(amount)) ? "" : amount}
                onChange={e => setAmount(e.target.value)}
                style={{ flex: 1.4, padding: "10px 12px", fontSize: 13.5, borderRadius: 11 }}
              />
            </div>
            <div style={{ fontSize: 11.5, color: "var(--faint)", marginBottom: 20 }}>
              Paid in USDC. This is also the most one trigger can ever spend.
            </div>

            {/* 4. Advanced, collapsed by default */}
            <button onClick={() => setAdvanced(a => !a)} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              width: "100%", background: "none", border: 0, padding: "4px 0",
              color: "var(--muted)", fontSize: 13, cursor: "pointer", marginBottom: advanced ? 14 : 18,
            }}>
              <span>Advanced · {slippage / 100}% slippage · {days} days</span>
              <ChevronDown size={16} style={{
                transform: advanced ? "rotate(180deg)" : "none", transition: "transform 200ms",
              }} />
            </button>

            {advanced && (
              <div style={{ marginBottom: 18 }}>
                <div className="label" style={{ marginBottom: 8 }}>Max slippage</div>
                <div style={{ display: "flex", gap: 7, marginBottom: 14 }}>
                  {[50, 100, 300].map(s => (
                    <button key={s} onClick={() => setSlippage(s)} style={chip(slippage === s)}>
                      {s / 100}%
                    </button>
                  ))}
                </div>
                <div className="label" style={{ marginBottom: 8 }}>Expires after</div>
                <div style={{ display: "flex", gap: 7 }}>
                  {[7, 30, 90].map(d => (
                    <button key={d} onClick={() => setDays(d)} style={chip(days === d)}>
                      {d} days
                    </button>
                  ))}
                </div>
              </div>
            )}

            {warning && (
              <div style={{
                display: "flex", gap: 8, alignItems: "flex-start",
                fontSize: 12.5, color: "var(--warn)", lineHeight: 1.5, marginBottom: 14,
              }}>
                <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                {warning}
              </div>
            )}

            <button className="btn btn-primary"
                    disabled={!publicKey || Number(amount) <= 0 || pct <= 0}
                    onClick={() => setStep("review")}>
              {publicKey ? "Review rule" : "Connect wallet"}
            </button>
          </>
        ) : (
          <>
            {/* Review step — look before it goes live */}
            <button onClick={() => setStep("edit")} style={{
              display: "flex", alignItems: "center", gap: 6, background: "none",
              border: 0, color: "var(--muted)", fontSize: 13, cursor: "pointer",
              padding: 0, marginBottom: 16,
            }}>
              <ArrowLeft size={15} /> Edit
            </button>

            <h2 style={{ fontSize: 20, marginBottom: 16 }}>Review your rule</h2>

            <div className="card" style={{ marginBottom: 16 }}>
              <RuleTrack entry={price} trigger={target} current={price}
                         direction={preset.dir as "up" | "down"} compact />
              <p style={{ fontSize: 15, lineHeight: 1.55, margin: "16px 0 0" }}>{sentence}</p>
            </div>

            <div className="card" style={{ padding: "4px 16px", marginBottom: 16 }}>
              <Row label="Type" value={preset.label} />
              <Row label="Trigger" value={`${down ? "−" : "+"}${pct}% · $${target.toFixed(2)}`} />
              <Row label="Spend cap" value={`$${amount} per trigger`} />
              <Row label="Max slippage" value={`${slippage / 100}%`} />
              <Row label="Expires" value={new Date(Date.now() + days * 86400000).toLocaleDateString()} last />
            </div>

            <p style={{ fontSize: 12, color: "var(--faint)", lineHeight: 1.6, margin: "0 0 18px" }}>
              These limits are enforced by the contract, not the app. You can cancel any time from Rules.
            </p>

            <button className="btn btn-primary" disabled={busy} onClick={create}>
              {busy ? "Working…" : "Confirm & go live"}
            </button>

            {status && (
              <div className="mono" style={{
                fontSize: 11.5, color: "var(--faint)", marginTop: 12, textAlign: "center",
              }}>{status}</div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const stepBtn: React.CSSProperties = {
  width: 44, height: 44, borderRadius: 13, border: 0, cursor: "pointer", flexShrink: 0,
};

function chip(on: boolean): React.CSSProperties {
  return {
    flex: 1, padding: "10px 6px", borderRadius: 11, cursor: "pointer",
    fontSize: 13, fontFamily: "var(--sans)", border: 0,
    background: on ? "var(--selected)" : "var(--idle)",
    color: on ? "var(--ink)" : "var(--muted)",
    fontWeight: on ? 500 : 400,
    transition: "background 160ms ease, color 160ms ease",
  };
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", padding: "11px 0", fontSize: 13.5,
      borderBottom: last ? "none" : "1px solid var(--line)",
    }}>
      <span style={{ color: "var(--faint)" }}>{label}</span>
      <span className="num">{value}</span>
    </div>
  );
}
