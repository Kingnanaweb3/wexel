// The three tests, as a terminal log, plus the headline result.
const LOG = [
  { cmd: "fair trade",            out: "executed",              ok: true },
  { cmd: "keeper pays half",      out: "whole trade unwound",   ok: true },
  { cmd: "keeper skips the check", out: "refused to run",       ok: true },
];

export function Proof() {
  return (
    <section className="proof-sec s">
      <div className="wrap narrow">
        <div className="reveal">
          <div className="eyebrow"><i /><span>We tried to break it</span></div>
          <h2 className="sec-title">Then we cheated on purpose. <span>It didn't let us.</span></h2>
        </div>

        <div className="proof-grid stagger">
          <div className="result reveal">
            <div className="k">Bought Apple at</div>
            <b className="v num">$339.00</b>
            <p className="n">while the live price was <span className="num">$338.97</span>.</p>
            <p className="foot">Measured on a live copy of Solana mainnet, with the real Apple stock token and real market prices.</p>
          </div>

          <div className="term reveal">
            <div className="term-bar"><i /><i /><i /><span>wexel · tests</span></div>
            <div className="term-body">
              {LOG.map((l, i) => (
                <div key={i} className="term-line" style={{ ["--i" as string]: i } as React.CSSProperties}>
                  <span className="prompt">$</span> {l.cmd}
                  <span className="arrow">→</span>
                  <span className={l.ok ? "ok" : "bad"}>{l.out}</span>
                </div>
              ))}
              <div className="term-line cursor-line" style={{ ["--i" as string]: 3 } as React.CSSProperties}>
                <span className="prompt">$</span> <span className="blink">▍</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
