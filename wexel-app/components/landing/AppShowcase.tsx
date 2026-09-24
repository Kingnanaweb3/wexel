import { CandlestickChart, Moon, ShieldCheck, Signal, Wifi, BatteryFull } from "lucide-react";

// A phone showing Wexel's wallet screen, built in HTML rather than a
// screenshot, so it stays sharp at every size. It fades out at the bottom.
const POSITIONS = [
  { t: "SPY",  name: "SP500 xStock",  amt: "0.0647 SPYx",  val: "$49.94",  ch: "0.24%", up: false, c: "#2B45F2" },
  { t: "NVDA", name: "NVIDIA xStock", amt: "0.2188 NVDAx", val: "$49.86",  ch: "1.47%", up: true,  c: "#76B900" },
  { t: "SOL",  name: "Solana",        amt: "1.9978 SOL",   val: "$232.44", ch: "0.96%", up: false, c: "#8B5CF6" },
];

export function AppShowcase() {
  return (
    <section className="show s">
      <div className="how-grain" aria-hidden />

      <div className="wrap show-inner">
        <div className="show-head r">
          <div className="eyebrow" style={{ justifyContent: "center" }}><i /><span>On your phone</span></div>
          <h2 className="how-title">Your stocks. In your pocket.</h2>
          <p className="how-sub">A home for your stocks, your rules and your cash.</p>
        </div>

        <div className="show-grid">
          <div className="phone-frame reveal zoom" aria-hidden>
            <div className="screen">
              <div className="status">
                <span>9:41</span>
                <div className="island" />
                <span className="status-icons"><Signal size={13} /><Wifi size={13} /><BatteryFull size={16} /></span>
              </div>

              <div className="scr-head">
                <span>Wallet</span>
                <span className="avatar">A7</span>
              </div>

              <div className="scr-label">Balance</div>
              <div className="scr-balance">
                <span className="num">$1,232<span className="dim">.16</span></span>
                <span className="up num">+2.4%</span>
              </div>

              <svg viewBox="0 0 300 120" className="scr-chart">
                <defs>
                  <linearGradient id="showfill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(251,251,247,.18)" />
                    <stop offset="100%" stopColor="rgba(251,251,247,0)" />
                  </linearGradient>
                </defs>
                <path className="area" d="M0,98 L14,90 24,95 36,84 48,88 60,78 72,82 84,70 96,74 108,64 120,68 132,56 144,60 156,48 168,54 180,44 192,50 204,38 216,42 228,32 240,36 252,24 264,28 276,18 288,14 300,6 L300,120 L0,120 Z" />
                <polyline className="line" pathLength={1} points="0,98 14,90 24,95 36,84 48,88 60,78 72,82 84,70 96,74 108,64 120,68 132,56 144,60 156,48 168,54 180,44 192,50 204,38 216,42 228,32 240,36 252,24 264,28 276,18 288,14 300,6" />
              </svg>

              <div className="scr-ranges">
                {["1D", "1W", "1M", "All"].map((r) => <span key={r} className={r === "1W" ? "on" : ""}>{r}</span>)}
              </div>

              <div className="scr-label" style={{ marginTop: 18 }}>Positions</div>
              {POSITIONS.map((p) => (
                <div key={p.t} className="scr-row">
                  <span className="dot" style={{ background: p.c }}>{p.t.slice(0, 2)}</span>
                  <span className="scr-name"><b>{p.name}</b><small>{p.amt}</small></span>
                  <span className="scr-val"><b className="num">{p.val}</b>
                    <small className={p.up ? "up" : "down"}>{p.up ? "▲" : "▼"} {p.ch}</small></span>
                </div>
              ))}
            </div>
          </div>

          <ul className="feats stagger">
            <li className="reveal right"><CandlestickChart size={19} /><div><b>Trade any hour</b><p>Buy and sell stocks at 2am on a Sunday.</p></div></li>
            <li className="reveal right"><Moon size={19} /><div><b>Rules on autopilot</b><p>They trade while you're offline, asleep or busy.</p></div></li>
            <li className="reveal right"><ShieldCheck size={19} /><div><b>Your wallet, your limit</b><p>Wexel can only spend what you allow.</p></div></li>
          </ul>
        </div>
      </div>
    </section>
  );
}
