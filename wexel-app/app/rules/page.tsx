"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useConnection, useAnchorWallet, useWallet } from "@solana/wallet-adapter-react";
import { RefreshCw, Plus, ChevronDown } from "lucide-react";
import { getProgram, fetchMyRules } from "@/lib/program";
import { livePrices, Quote } from "@/lib/prices";
import { RuleTrack } from "@/components/RuleTrack";
import { SwipeRow } from "@/components/SwipeRow";
import { PermissionCard } from "@/components/PermissionCard";

const ACTIVE = new Set(["watching", "triggered"]);

export default function Rules() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const { publicKey } = useWallet();

  const [rules, setRules] = useState<any[]>([]);
  const [quotes, setQuotes] = useState<Map<string, Quote>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [view, setView] = useState<"active" | "history">("active");
  const [open, setOpen] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<any>(null);
  const [toast, setToast] = useState("");

  const load = useCallback(async (quiet = false) => {
    if (!wallet || !publicKey) { setLoading(false); return; }
    quiet ? setRefreshing(true) : setLoading(true);
    try {
      const mine = await fetchMyRules(getProgram(connection, wallet), publicKey);
      setRules(mine);
      setQuotes(await livePrices(mine.map((r: any) => r.asset)));
    } catch {
      flash("Could not read rules");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [connection, wallet, publicKey]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const id = setInterval(() => load(true), 30_000);
    return () => clearInterval(id);
  }, [load]);

  function flash(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 2400);
  }

  async function cancel(r: any) {
    if (!wallet || !publicKey) return;
    setConfirm(null);
    try {
      await getProgram(connection, wallet).methods.cancelRule()
        .accountsPartial({ rule: r.pubkey, owner: publicKey }).rpc();
      setRules(rs => rs.map(x => x.pubkey === r.pubkey ? { ...x, status: "cancelled" } : x));
      flash("Rule cancelled");
    } catch (e: any) {
      flash(e.message?.includes("rejected") ? "Kept — cancelled in wallet" : "Could not cancel");
    }
  }

  const active = rules.filter(r => ACTIVE.has(r.status));
  const history = rules.filter(r => !ACTIVE.has(r.status));
  const shown = view === "active" ? active : history;

  return (
    <>
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "22px 20px 4px",
      }}>
        <h1 style={{ fontSize: 26 }}>Rules</h1>
        {publicKey && (
          <button onClick={() => load(true)} className="icon-chip" style={{ border: 0, cursor: "pointer" }}>
            <RefreshCw size={15} style={{ animation: refreshing ? "spin 1s linear infinite" : "none" }} />
          </button>
        )}
      </header>

      <div style={{ padding: "0 20px" }}>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: "4px 0 18px" }}>
          {active.length
            ? `${active.length} watching · swipe left on a rule to cancel it`
            : "These run on-chain whether the app is open or not."}
        </p>

        {!publicKey && <Muted>Connect a wallet to see your rules.</Muted>}
        {publicKey && loading && [0, 1].map(i => (
          <div key={i} className="card" style={{ height: 76, marginBottom: 10, opacity: .5 }} />
        ))}

        {publicKey && !loading && (
          <>
            <PermissionCard />

            <div className="seg" style={{ marginBottom: 14 }}>
              <button className={view === "active" ? "on" : ""} onClick={() => setView("active")}>
                Active · {active.length}
              </button>
              <button className={view === "history" ? "on" : ""} onClick={() => setView("history")}>
                History · {history.length}
              </button>
            </div>

            {!shown.length && view === "active" && (
              <Link href="/markets" className="card" style={{
                display: "flex", alignItems: "center", gap: 13,
                textDecoration: "none", color: "inherit",
              }}>
                <div className="icon-chip" style={{ background: "var(--accent)", color: "#fff" }}>
                  <Plus size={17} />
                </div>
                <div>
                  <div style={{ fontSize: 14.5, fontWeight: 500 }}>No active rules</div>
                  <div style={{ fontSize: 12, color: "var(--faint)", marginTop: 2 }}>
                    Open any stock and tap Set rule
                  </div>
                </div>
              </Link>
            )}
            {!shown.length && view === "history" && <Muted>Nothing here yet.</Muted>}

            {shown.map(r => {
              const q = quotes.get(r.asset);
              const isActive = ACTIVE.has(r.status);
              const down = r.direction === "down";
              const trigger = down
                ? r.entryPrice * (1 - r.thresholdPct / 100)
                : r.entryPrice * (1 + r.thresholdPct / 100);
              const away = q ? Math.abs((trigger - q.price) / q.price) * 100 : null;
              const buying = r.action === "buy";
              const shares = r.amount / trigger;
              const expanded = open === r.pubkey;

              const card = (
                <div className="card" style={{ padding: 0, opacity: isActive ? 1 : .6 }}>
                  {/* Compact row — the summary */}
                  <button onClick={() => setOpen(expanded ? null : r.pubkey)} style={{
                    display: "flex", alignItems: "center", gap: 12, width: "100%",
                    padding: "14px 15px", background: "none", border: 0,
                    color: "inherit", textAlign: "left", cursor: "pointer",
                  }}>
                    {q?.icon
                      ? <img src={q.icon} alt="" width={38} height={38} style={{ borderRadius: 11, flexShrink: 0 }} />
                      : <div className="icon-chip" style={{ width: 38, height: 38 }}>{r.asset.slice(0, 2)}</div>}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 500 }}>
                        {r.asset} <span style={{ color: "var(--faint)", fontWeight: 400 }}>· {label(r)}</span>
                      </div>
                      <div className="num" style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
                        {buying ? "Buys" : "Sells"} ${r.amount} at ${trigger.toFixed(2)}
                      </div>
                    </div>

                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      {r.status === "watching" && away !== null ? (
                        <>
                          <div className="num" style={{
                            fontSize: 17, color: away < 2 ? "var(--warn)" : "var(--ink)",
                          }}>{away.toFixed(1)}%</div>
                          <div style={{ fontSize: 10.5, color: "var(--faint)" }}>to trigger</div>
                        </>
                      ) : (
                        <Status status={r.status} />
                      )}
                    </div>

                    <ChevronDown size={15} color="var(--faint)" style={{
                      flexShrink: 0, transform: expanded ? "rotate(180deg)" : "none",
                      transition: "transform 200ms",
                    }} />
                  </button>

                  {/* Expanded — the detail */}
                  {expanded && (
                    <div style={{ padding: "4px 15px 16px", animation: "fade .2s ease" }}>
                      <RuleTrack
                        entry={r.entryPrice} trigger={trigger}
                        current={isActive ? q?.price ?? null : null}
                        direction={r.direction}
                      />

                      <div style={{ marginTop: 16, borderTop: "1px solid var(--line)" }}>
                        <Row label="Status" value={<Status status={r.status} />} />
                        <Row label="When it fires"
                             value={`${buying ? "Buys" : "Sells"} ~${shares.toFixed(4)} ${r.asset}`} />
                        <Row label="Spend cap" value={`$${r.amount} per trigger`} />
                        <Row label="Max slippage" value={`${r.maxSlippageBps / 100}%`} />
                        <Row label="Expires" value={expiresIn(r.expiryUnix)} />
                      </div>

                      {r.status === "watching" && (
                        <button onClick={() => setConfirm(r)} style={{
                          width: "100%", marginTop: 12, padding: 11, borderRadius: 11,
                          border: 0, background: "var(--idle)", color: "var(--bad)",
                          fontSize: 13, cursor: "pointer",
                        }}>Cancel rule</button>
                      )}
                    </div>
                  )}
                </div>
              );

              return (
                <SwipeRow key={r.pubkey} actionLabel="Cancel"
                          disabled={r.status !== "watching" || expanded}
                          action={() => setConfirm(r)}>
                  {card}
                </SwipeRow>
              );
            })}
          </>
        )}
      </div>

      {/* Confirm sheet */}
      {confirm && (
        <div className="sheet-bg" onClick={() => setConfirm(null)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="grab" />
            <h2 style={{ fontSize: 19, marginBottom: 8 }}>Cancel this rule?</h2>
            <p style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.6, margin: "0 0 20px" }}>
              {confirm.asset} · {label(confirm)} will stop watching immediately.
              This can't be undone — you'd need to set it again.
            </p>
            <div style={{ display: "flex", gap: 9 }}>
              <button className="btn" onClick={() => setConfirm(null)}>Keep it</button>
              <button className="btn" onClick={() => cancel(confirm)}
                      style={{ background: "var(--bad)", color: "#fff", border: 0 }}>
                Cancel rule
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div style={{
          position: "fixed", left: "50%", bottom: 100, transform: "translateX(-50%)",
          zIndex: 70, background: "var(--navpill)", color: "var(--ink-inv)",
          padding: "10px 16px", borderRadius: 999, fontSize: 13,
          boxShadow: "var(--shadow-nav)", animation: "fade .2s ease",
        }}>{toast}</div>
      )}
    </>
  );
}

function label(r: any) {
  const buy = r.action === "buy";
  if (r.direction === "down") return buy ? `Buy the dip −${r.thresholdPct}%` : `Stop loss −${r.thresholdPct}%`;
  return buy ? `Buy breakout +${r.thresholdPct}%` : `Take profit +${r.thresholdPct}%`;
}

function expiresIn(unix: number) {
  const s = unix - Date.now() / 1000;
  if (s <= 0) return "Expired";
  const d = Math.floor(s / 86400);
  return d >= 1 ? `in ${d} day${d === 1 ? "" : "s"}` : `in ${Math.ceil(s / 3600)}h`;
}

// Soft filled pill — no outline, matching the selection style.
function Status({ status }: { status: string }) {
  const tone = ({
    watching: "var(--accent)", triggered: "var(--warn)", settling: "var(--warn)",
    executed: "var(--good)", expired: "var(--faint)", cancelled: "var(--faint)",
  } as Record<string, string>)[status] ?? "var(--faint)";

  return (
    <span className="mono" style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: 10, textTransform: "uppercase", color: tone,
      background: "var(--idle)", borderRadius: 999, padding: "4px 9px",
    }}>
      {status === "watching" && (
        <span style={{
          width: 5, height: 5, borderRadius: "50%", background: tone,
          animation: "pulse 1.8s ease-in-out infinite",
        }} />
      )}
      {status}
    </span>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "10px 0", fontSize: 13, borderBottom: "1px solid var(--line)",
    }}>
      <span style={{ color: "var(--faint)" }}>{label}</span>
      <span className="num">{value}</span>
    </div>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return <div style={{
    textAlign: "center", padding: "46px 20px",
    color: "var(--faint)", fontSize: 13, lineHeight: 1.6,
  }}>{children}</div>;
}
