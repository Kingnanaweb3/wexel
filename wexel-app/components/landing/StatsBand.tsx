"use client";

import { useEffect, useRef, useState } from "react";

// Each number counts from `from` to `to`. Some count DOWN on purpose:
// 0.01% gets more accurate as you watch, $0 is Wexel letting go of your money.
const STATS = [
  { from: 5,    to: 0.01, fmt: (v: number) => `${v.toFixed(2)}%`,              label: "Off the live price on a real Apple buy" },
  { from: 1000, to: 0,    fmt: (v: number) => `$${Math.round(v).toLocaleString()}`, label: "Of your money held by Wexel" },
  { from: 0,    to: 2,    fmt: (v: number) => `${Math.round(v)} of 2`,          label: "Cheating attempts that unwound" },
  { from: 0,    to: 109,  fmt: (v: number) => `${Math.round(v)}`,               label: "Real stocks you can buy" },
];

const STAGGER = 160;    // ms between items
const DURATION = 1500;  // ms per count

function useCount(from: number, to: number, run: boolean, delay: number) {
  const [value, setValue] = useState(from);

  useEffect(() => {
    if (!run) { setValue(from); return; }   // reset while off screen
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setValue(to); return; }

    let raf = 0;
    const start = performance.now() + delay;
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / DURATION));
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);   // fast, then settles
      setValue(from + (to - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, from, to, delay]);

  return value;
}

function Stat({ s, i, run }: { s: typeof STATS[number]; i: number; run: boolean }) {
  const value = useCount(s.from, s.to, run, i * STAGGER + 120);
  return (
    <div className={`stat${run ? " in" : ""}`} style={{ transitionDelay: `${i * STAGGER}ms` }}>
      <b className="num">{s.fmt(value)}</b>
      <span>{s.label}</span>
    </div>
  );
}

export function StatsBand() {
  const ref = useRef<HTMLDivElement>(null);
  const [run, setRun] = useState(false);

  // Start once, when the band is properly on screen.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.intersectionRatio >= 0.35) setRun(true);
      else if (!e.isIntersecting) setRun(false);   // fully off screen: reset for next time
    }, { threshold: [0, 0.35] });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section className="stats s">
      <div className="wrap" ref={ref}>
        <p className={`stats-head${run ? " in" : ""}`}>Tested on real prices. Holding none of your money.</p>
        <div className="stats-grid">
          {STATS.map((s, i) => <Stat key={s.label} s={s} i={i} run={run} />)}
        </div>
      </div>
    </section>
  );
}
