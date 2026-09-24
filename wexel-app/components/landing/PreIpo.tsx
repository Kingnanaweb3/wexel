"use client";

import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { compact } from "@/lib/format";

// Live from Wexel's own API, so the numbers are always current.
export function PreIpo() {
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/prestocks").then((r) => (r.ok ? r.json() : []))
      .then((d) => setRows(Array.isArray(d)
        ? [...d].sort((a, b) => Number(b.valuation || 0) - Number(a.valuation || 0)).slice(0, 5) : []))
      .catch(() => {});
  }, []);

  return (
    <section id="preipo" className="pre s">
      <div className="wrap narrow">
        <div className="reveal" style={{ textAlign: "center" }}>
          <div className="eyebrow" style={{ justifyContent: "center" }}><i /><span>Before they go public</span></div>
          <h2 className="sec-title center">Own a slice of OpenAI <span>before your broker's even heard of it.</span></h2>
          <p className="sec-sub center">What the company's reckoned to be worth, what people are actually paying, and the gap between the two.</p>
        </div>

        <div className="pre-card reveal zoom">
          <div className="pre-head"><span>Company</span><span>Valued at</span><span>People are paying</span></div>
          {(rows.length ? rows : Array.from({ length: 5 })).map((t: any, i) => (
            <div key={t?.symbol ?? i} className="pre-row">
              <span className="pre-co">
                {t?.image ? <img src={t.image} alt="" /> : <i />}
                <b>{t?.name ?? "Loading…"}</b>
              </span>
              <span className="num">{t ? compact(Number(t.valuation)) : "—"}</span>
              <span className={`num gap ${t ? (t.premiumPct > 0 ? "over" : "under") : ""}`}>
                {t ? `${Math.abs(t.premiumPct).toFixed(1)}% ${t.premiumPct > 0 ? "over" : "under"}` : "—"}
              </span>
            </div>
          ))}
          <p className="pre-note"><AlertTriangle size={15} /> We won't run rules on these. Hardly anyone trades them, so one big order yanks the price around. Buy and hold if you like them.</p>
        </div>
      </div>
    </section>
  );
}
