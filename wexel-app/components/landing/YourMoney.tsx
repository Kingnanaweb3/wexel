import { ShieldCheck, Undo2, Wallet } from "lucide-react";

// The design system's "arithmetic" pattern: the sum IS the argument.
export function YourMoney() {
  return (
    <section id="safe" className="money s">
      <div className="wrap narrow">
        <div className="reveal">
          <div className="eyebrow"><i /><span>Your money</span></div>
          <h2 className="sec-title">Your money never leaves your wallet. <span>This is the bit nobody else does.</span></h2>
        </div>

        <div className="sum stagger">
          <div className="sum-box reveal">
            <div className="k">In your wallet</div>
            <b className="v num">$1,000</b>
            <p className="n">Stays there. Wexel never holds it.</p>
          </div>
          <div className="sum-op reveal">+</div>
          <div className="sum-box reveal">
            <div className="k">You allow</div>
            <b className="v num">$50</b>
            <p className="n">For one rule. Nothing more.</p>
          </div>
          <div className="sum-op reveal">=</div>
          <div className="sum-box good reveal">
            <div className="k">Most Wexel can ever touch</div>
            <b className="v num">$50</b>
            <p className="n">Not a cent more, ever.</p>
          </div>
        </div>

        <div className="promises stagger">
          <div className="reveal"><Undo2 size={18} /><div><b>Take it back any time</b><p>One tap removes the permission. Rules stop, money stays.</p></div></div>
          <div className="reveal"><ShieldCheck size={18} /><div><b>All or nothing</b><p>If the stock doesn't land in your wallet, your money is back the same second.</p></div></div>
          <div className="reveal"><Wallet size={18} /><div><b>No deposits</b><p>Nothing to send us, nothing to withdraw. It never left.</p></div></div>
        </div>
      </div>
    </section>
  );
}
