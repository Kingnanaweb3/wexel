import { Asterisk, Zap, MousePointer2 } from "lucide-react";

// Bars for "buy the dip": price falls through the trigger, then recovers after the buy.
const BARS = [62, 58, 64, 52, 48, 42, 38, 30, 26, 34, 44, 52, 60];
const BUY_AT = 8;   // index where the rule fired

const TOKENS = [
  { t: "SOL",  bg: "linear-gradient(135deg,#9945FF,#14F195)" },
  { t: "USDC", bg: "#2775CA" },
  { t: "JUP",  bg: "linear-gradient(135deg,#1dd3a7,#c7f284)" },
  { t: "BONK", bg: "#F5A623" },
  { t: "WIF",  bg: "#B98A5E" },
  { t: "AAPL", bg: "#FBFBF7", fg: "#111" },
];


export function RulesBento() {
  return (
    <section id="rules" className="bento s">
      <div className="wrap">
        <div className="bento-head r">
          <div className="star-eyebrow"><span className="star"><Asterisk size={13} /></span> The rules</div>
          <h2 className="bento-title">
            Every rule a trader sets. <span>None of the screen time.</span>
          </h2>
        </div>

        <div className="bento-top stagger">
          {/* Buy the dip */}
          <article className="bcard reveal">
            <div className="bviz">
              <div className="panel">
                <div className="panel-title">AAPL</div>
                <div className="bars">
                  <div className="trigger-line"><span>−5% · bought</span></div>
                  {BARS.map((h, i) => (
                    <i key={i} style={{ height: `${h}%`, ["--i" as string]: i } as React.CSSProperties} className={i < BUY_AT ? "down" : i === BUY_AT ? "hit" : "up"} />
                  ))}
                </div>
                <div className="axis"><span>Mon</span><span>Tue</span><span>3:04 AM</span></div>
              </div>
            </div>
            <h3>Buy the dip</h3>
            <p>If Apple drops 5%, buy $50 of it.</p>
          </article>

          {/* Take profit */}
          <article className="bcard reveal">
            <div className="bviz">
              <div className="notes">
                <div className="note back"><span className="dotlabel grey">● WATCHING</span> TSLA · take profit +20%</div>
                <div className="note front">
                  <span className="note-icon"><Zap size={22} /></span>
                  <span>
                    <span className="dotlabel green">● EXECUTED</span>
                    <b>Sold $50 of TSLA</b>
                    <small>Today, 3:04 AM</small>
                  </span>
                </div>
                <div className="dashes"><i /><i /><i /><i /></div>
              </div>
            </div>
            <h3>Take profit</h3>
            <p>If Tesla runs up 20%, sell $50 of it.</p>
          </article>

          {/* Stop the loss */}
          <article className="bcard reveal">
            <div className="bviz">
              <div className="curve">
                <div className="cols">
                  {["+10", "+5", "0", "−5", "−10", "−15"].map((n) => <span key={n}><em>{n}</em></span>)}
                </div>
                <svg viewBox="0 0 300 180" preserveAspectRatio="none">
                  <path className="c-line" pathLength={1} d="M0,30 C60,34 90,40 120,62 S170,96 196,120 S240,150 300,176" />
                </svg>
                <span className="glow" style={{ left: "66%", top: "68%" }} />
                <span className="stop-tag" style={{ left: "66%", top: "68%" }}>Stop −10%</span>
              </div>
            </div>
            <h3>Stop the loss</h3>
            <p>If Meta falls 10%, get out before it falls further.</p>
          </article>
        </div>

        <div className="bento-bottom stagger">
          {/* Pay with anything */}
          <article className="bcard wide reveal">
            <div className="wide-copy">
              <h3>Pay with anything</h3>
              <p>SOL, USDC or that coin you forgot about. It all turns into stock.</p>
            </div>
            <div className="tokens">
              {TOKENS.map((k, i) => (
                <span key={k.t} className={`tok row${i < 3 ? 1 : 2}`} style={{ background: k.bg, color: k.fg ?? "#fff" }}>{k.t}</span>
              ))}
            </div>
          </article>

          {/* Ladders */}
          <article className="bcard wide reveal">
            <div className="wide-copy">
              <h3>Can't pick a bottom? Don't.</h3>
              <p>Split one amount across three prices. One tap, three rules.</p>
            </div>
            <div className="rungs">
              <span className="rung" style={{ borderColor: "#5468F5" }}>−5%</span>
              <span className="rung" style={{ borderColor: "#3FD37F" }}>−10%</span>
              <span className="rung" style={{ borderColor: "#E0A85A" }}>−15%</span>
              <span className="rung ghost" />
              <span className="cursor"><MousePointer2 size={18} /></span>
              <span className="bubble">$50 each</span>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
