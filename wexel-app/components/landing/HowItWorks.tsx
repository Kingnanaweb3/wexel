import { Wallet, SlidersHorizontal, Moon, TrendingDown, TrendingUp, Target, ShieldAlert } from "lucide-react";

// Three glass cards. Each has a small illustration of that step on top,
// and a mono label plus two lines of copy underneath.
export function HowItWorks() {
  return (
    <section id="how" className="how s">
      {/* the hero painting, blurred and faded into a dim sky */}
      <div className="how-sky" aria-hidden />
      <div className="how-grain" aria-hidden />

      <div className="wrap how-inner">
        <div className="r">
          <div className="eyebrow"><i /><span>How it works</span></div>
          <h2 className="how-title">Three taps and you're done.</h2>
          <p className="how-sub">Pay with anything, write a rule, go to bed.</p>
        </div>

        <div className="how-grid stagger">
          {/* 1. Pay with anything */}
          <article className="glass reveal">
            <div className="art">
              <div className="mock-form">
                <div className="mock-title">Buy Apple</div>
                <div className="mock-field"><span>Pay with</span><b>SOL</b></div>
                <div className="mock-field"><span>Amount</span><b className="num">$100</b></div>
                <div className="mock-row"><span>You receive</span><span className="num">≈ 0.295 AAPL</span></div>
                <div className="mock-btn">Buy AAPL</div>
              </div>
            </div>
            <div className="copy">
              <div className="label"><Wallet size={15} /> PAY WITH ANYTHING</div>
              <p>Solana, a stablecoin, some coin you forgot you had. Wexel turns it into stock in one go. No bank, no waiting three days.</p>
            </div>
          </article>

          {/* 2. Write the rule */}
          <article className="glass reveal">
            <div className="art">
              <div className="pills">
                <span className="chip" style={{ left: "30%", top: "14%" }}><i><TrendingDown size={13} /></i>Buy the dip −5%</span>
                <span className="chip" style={{ left: "4%",  top: "38%" }}><i><TrendingUp size={13} /></i>Buy the climb +5%</span>
                <span className="chip" style={{ left: "40%", top: "52%" }}><i><Target size={13} /></i>Take profit +20%</span>
                <span className="chip" style={{ left: "16%", top: "76%" }}><i><ShieldAlert size={13} /></i>Stop the loss −10%</span>
              </div>
            </div>
            <div className="copy">
              <div className="label"><SlidersHorizontal size={15} /> WRITE THE RULE</div>
              <p>Buy if it drops. Buy if it climbs. Take profit. Cut the loss. You pick how much and how far the price has to move.</p>
            </div>
          </article>

          {/* 3. Go to bed */}
          <article className="glass reveal">
            <div className="art">
              <div className="phone">
                <div className="phone-top"><span className="mock-tag">AAPL</span><span className="num">$338.97</span></div>
                <svg viewBox="0 0 200 110" className="phone-chart" aria-hidden>
                  <line x1="0" y1="78" x2="200" y2="78" className="trigger" />
                  <polyline className="price" pathLength={1}
                    points="0,40 14,34 26,46 38,38 52,52 64,44 78,58 90,50 104,66 116,60 128,74 140,70 150,86 162,80 176,72 188,64 200,58" />
                  <circle cx="150" cy="86" r="4" className="hit" />
                </svg>
                <div className="toast">
                  <Moon size={13} />
                  <span><b>3:04 AM</b> · Bought $50 of AAPL</span>
                </div>
              </div>
            </div>
            <div className="copy">
              <div className="label"><Moon size={15} /> GO TO BED</div>
              <p>Wexel watches the price all night. When your rule hits, it trades. You wake up to a receipt.</p>
            </div>
          </article>
        </div>

        <p className="swipe-hint">← swipe for the rest</p>
      </div>
    </section>
  );
}
