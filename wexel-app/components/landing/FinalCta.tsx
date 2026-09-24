import Link from "next/link";
import { LogoMark } from "@/components/LogoMark";

export function FinalCta() {
  return (
    <>
      <section className="final s">
        <div className="wrap narrow final-inner reveal">
          <LogoMark size={44} />
          <h2 className="sec-title center">Go to bed. <span>Let the rule stay up.</span></h2>
          <Link href="/markets" className="hero-pill">Try it free</Link>
          <p className="final-note mono">No sign up. Play money. Real stocks.</p>
        </div>
      </section>

      <footer className="foot-s s">
        <div className="wrap narrow">
          <div className="foot-row">
            <span className="brand"><LogoMark size={18} /> Wexel</span>
            <nav>
              <Link href="/markets">Open the app</Link>
              <a href="https://github.com/Kingnanaweb3/wexel" target="_blank" rel="noreferrer">GitHub</a>
              <a href="https://github.com/Kingnanaweb3/wexel/blob/main/SECURITY.md" target="_blank" rel="noreferrer">How your money stays safe</a>
            </nav>
          </div>
          <p className="disclaimer">
            Built for Stocklana, September 2026. Wexel isn't a broker. Tokenized stocks follow a company's share
            price and carry real risk, including losing the lot. Not available to United States residents.
          </p>
        </div>
      </footer>
    </>
  );
}
