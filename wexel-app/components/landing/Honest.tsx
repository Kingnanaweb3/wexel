import { CalendarClock, TrendingUp, Link2, ShieldCheck } from "lucide-react";

const LIMITS = [
  { k: "Practice sandbox for now", v: "The app runs on a live copy of Solana so anyone can try it free. Going live on real Solana needs a deposit we haven't paid yet." },
  { k: "Stop loss trusts our price", v: "The other rules don't: the trade itself proves the price. Stop loss relies on our price reading. That's the next thing we fix." },
  { k: "Not for the United States", v: "Tokenized stocks aren't available to people in the US." },
];

const NEXT = [
  { Icon: CalendarClock, t: "Buy every week", d: "A set amount on a schedule, without thinking about it." },
  { Icon: TrendingUp,    t: "A stop that climbs", d: "Follows the price up, never slides back down." },
  { Icon: Link2,         t: "Paired exits", d: "Take profit and stop loss together. One cancels the other." },
  { Icon: ShieldCheck,   t: "Nobody to trust", d: "Price checks done entirely on Solana." },
];

export function Honest() {
  return (
    <>
      <section className="honest s">
        <div className="wrap narrow">
          <div className="reveal">
            <div className="eyebrow"><i /><span>What we haven't built yet</span></div>
            <h2 className="sec-title">We'd rather say it <span>than have you find out.</span></h2>
          </div>
          <div className="limits reveal">
            {LIMITS.map((l) => <div key={l.k}><b>{l.k}</b><p>{l.v}</p></div>)}
          </div>
        </div>
      </section>

      <section className="roadmap s">
        <div className="wrap narrow">
          <div className="reveal">
            <div className="eyebrow"><i /><span>Coming next</span></div>
          </div>
          <div className="road-grid stagger">
            {NEXT.map(({ Icon, t, d }) => (
              <div key={t} className="road reveal"><Icon size={18} /><b>{t}</b><p>{d}</p></div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
