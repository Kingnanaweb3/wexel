"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { LogoMark } from "@/components/LogoMark";
import { StatsBand } from "@/components/landing/StatsBand";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { AppShowcase } from "@/components/landing/AppShowcase";
import { RulesBento } from "@/components/landing/RulesBento";
import { YourMoney } from "@/components/landing/YourMoney";
import { PreIpo } from "@/components/landing/PreIpo";
import { Proof } from "@/components/landing/Proof";
import { Honest } from "@/components/landing/Honest";
import { FinalCta } from "@/components/landing/FinalCta";
import "./landing.css";

const APP = "/markets";

export default function Landing() {
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // The single motion effect: sections fade up as they arrive.
  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const el = e.target as HTMLElement;
        if (el.closest(".hero")) { el.classList.add("in"); io.unobserve(el); continue; }  // hero: once, no replay
        if (e.intersectionRatio >= 0.12) el.classList.add("in");
        else if (!e.isIntersecting) el.classList.remove("in");   // fully off screen: reset for next time
      }
    }, { rootMargin: "0px 0px -10% 0px", threshold: [0, 0.12] });
    document.querySelectorAll(".landing .r, .landing .reveal").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="landing">
      <nav className={`lnav${stuck ? " stuck" : ""}`}>
        <div className="lnav-inner">
        <Link href="/" className="brand">
          <LogoMark size={22} /> Wexel
        </Link>
        <div className="nav-links">
          <a href="#how">How it works</a>
          <a href="#rules">Rules</a>
          <a href="#safe">Your money</a>
          <a href="#preipo">Pre-IPO</a>
        </div>
        <Link href={APP} className="nav-cta">Open the app</Link>
        </div>
      </nav>

      <header className="hero">
        {/* The whole painting, at its own shape — nothing trimmed. */}
        <div className="hero-frame">
          <img className="hero-img" src="/hero-night.webp" alt="" width={1591} height={989} fetchPriority="high" />
          <div className="hero-shade" />
          <div className="hero-grain" />
        </div>

        <div className="hero-inner s">
          <div className="wrap">

            <h1 className="r r-1">The stock market sleeps.<br />Your money shouldn't.</h1>

            <p className="lead r r-1">
              Buy real stocks with whatever's in your wallet, set a rule, and let it trade at 3am
              while you're snoring.
            </p>

            <Link href={APP} className="hero-pill r r-2">Programmable stock trading</Link>
          </div>
        </div>
      </header>

      <StatsBand />

      <HowItWorks />

      <AppShowcase />

      <RulesBento />

      <YourMoney />

      <PreIpo />

      <Proof />

      <Honest />

      <FinalCta />
    </div>
  );
}
