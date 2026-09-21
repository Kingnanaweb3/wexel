"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

type Point = { t: number; c: number };
export type ChartView = { first: Point; last: Point; atLatest: boolean };

// Time labels per range. On 1D, anything not from today gets its weekday.
export function fmtTime(t: number, range: string) {
  const d = new Date(t * 1000);
  if (range === "1D") {
    const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    return new Date().toDateString() === d.toDateString()
      ? time : `${d.toLocaleDateString([], { weekday: "short" })} ${time}`;
  }
  if (range === "1W") return d.toLocaleString([], { weekday: "short", hour: "numeric" });
  if (range === "1M") return d.toLocaleDateString([], { month: "short", day: "numeric" });
  return d.toLocaleDateString([], { month: "short", day: "numeric", year: "2-digit" });
}

const fmtPrice = (p: number) => (p >= 1000 ? p.toFixed(0) : p >= 100 ? p.toFixed(1) : p.toFixed(2));

// Gridlines at round numbers; label precision follows the step.
function niceTicks(min: number, max: number, count: number) {
  const raw = (max - min) / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) ?? 10 * mag;
  const values: number[] = [];
  for (let k = Math.ceil(min / step); k * step <= max; k++) values.push(k * step);
  const dec = (String(Number(step.toFixed(6))).split(".")[1] ?? "").length;
  return { values, step, dec };
}

type Props = {
  data: Point[];
  windowSize?: number;          // points visible at once; the rest is history
  reason?: string;
  range?: string;
  onScrub?: (p: Point | null) => void;
  onView?: (v: ChartView) => void;
};

type Gesture = {
  mode: "pending" | "pan" | "scrub";
  x: number; y: number; startEnd: number;
  lastX: number; lastT: number; v: number;
  pointerType: string;
  timer?: ReturnType<typeof setTimeout>;
};

const H = 230, PT = 20, PB = 24, PR = 48, PL = 2;
const HOLD_MS = 280;   // touch: hold this long to scrub instead of pan
const MOVE_PX = 6;     // movement before a gesture counts as a drag

export function PriceChart({ data, windowSize, reason, range = "1D", onScrub, onView }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gid = useId().replace(/:/g, "");
  const [w, setW] = useState(360);
  const [hover, setHover] = useState<number | null>(null);

  const n = data.length;
  const win = Math.max(2, Math.min(windowSize ?? n, n));

  // `end` is the (fractional) index at the right edge. Fractional so panning
  // moves pixel by pixel instead of jumping a whole candle at a time.
  const [end, setEndState] = useState(Math.max(0, n - 1));
  const endRef = useRef(end);
  const setEnd = useCallback((e: number) => { endRef.current = e; setEndState(e); }, []);

  const anim = useRef<number | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const stopAnim = () => { if (anim.current) cancelAnimationFrame(anim.current); anim.current = null; };

  const plotW = w - PL - PR, plotH = H - PT - PB;
  const pxPerPoint = plotW / (win - 1);
  const clamp = useCallback((e: number) => Math.max(win - 1, Math.min(n - 1, e)), [win, n]);

  const live = useRef({ pxPerPoint, clamp });
  live.current = { pxPerPoint, clamp };

  useEffect(() => {
    if (!wrap.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(220, e.contentRect.width)));
    ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);

  // New data (range switch): jump to the latest view.
  useEffect(() => { stopAnim(); setEnd(Math.max(0, n - 1)); setHover(null); }, [data, n, setEnd]);

  // Trackpad sideways swipe pans; vertical still scrolls the page.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      stopAnim();
      const { pxPerPoint, clamp } = live.current;
      setEnd(clamp(endRef.current + e.deltaX / pxPerPoint));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [setEnd]);

  const startF = end - (win - 1);

  const g = useMemo(() => {
    if (n < 2) return null;
    // a..b: points fully on screen. i0..i1: include the partly-visible edges.
    const a = Math.max(0, Math.ceil(startF - 1e-9));
    const b = Math.min(n - 1, Math.floor(end + 1e-9));
    const i0 = Math.max(0, Math.floor(startF));
    const i1 = Math.min(n - 1, Math.ceil(end));

    let hiI = a, loI = a;
    for (let i = a; i <= b; i++) {
      if (data[i].c > data[hiI].c) hiI = i;
      if (data[i].c < data[loI].c) loI = i;
    }
    const hi = data[hiI].c, lo = data[loI].c;
    const pad = (hi - lo) * 0.1 || hi * 0.01;
    const min = lo - pad, max = hi + pad;

    const x = (i: number) => PL + ((i - startF) / (win - 1)) * plotW;
    const y = (p: number) => PT + (1 - (p - min) / (max - min)) * plotH;

    let line = "";
    for (let i = i0; i <= i1; i++) line += `${i === i0 ? "M" : "L"}${x(i).toFixed(1)},${y(data[i].c).toFixed(1)}`;
    const area = `${line} L${x(i1).toFixed(1)},${PT + plotH} L${x(i0).toFixed(1)},${PT + plotH} Z`;
    const m = b - a;

    return {
      a, b, x, y, line, area, hiI, loI, hi, lo,
      ticks: niceTicks(min, max, Math.max(5, Math.round(plotH / 26))),
      times: [a, a + Math.round(m / 3), a + Math.round((2 * m) / 3), b],
    };
  }, [data, n, startF, end, win, plotW, plotH]);

  const atLatest = end >= n - 1.5;

  // Tell the page what's on screen, for the change label above the chart.
  useEffect(() => {
    if (g) onView?.({ first: data[g.a], last: data[g.b], atLatest });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [g?.a, g?.b, atLatest, data]);

  if (!g) {
    return (
      <div ref={wrap} style={{ height: H, display: "grid", placeItems: "center", color: "var(--faint)", fontSize: 12.5 }}>
        {reason === "unavailable" ? "Chart data is unavailable right now"
          : reason === "loading" ? "Loading chart…"
          : "No price history for this range"}
      </div>
    );
  }

  // ----- motion -----

  function glide(v0: number) {
    stopAnim();
    let v = v0, last = performance.now();
    const step = (now: number) => {
      const dt = now - last; last = now;
      v *= Math.pow(0.994, dt);                    // friction
      const next = clamp(endRef.current - v * dt);
      setEnd(next);
      anim.current = Math.abs(v) > 0.002 && next > win - 1 && next < n - 1
        ? requestAnimationFrame(step) : null;
    };
    anim.current = requestAnimationFrame(step);
  }

  function animateTo(target: number) {
    stopAnim();
    const from = endRef.current, t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 450);
      setEnd(from + (target - from) * (1 - Math.pow(1 - k, 3)));  // ease-out
      anim.current = k < 1 ? requestAnimationFrame(step) : null;
    };
    anim.current = requestAnimationFrame(step);
  }

  // ----- gestures -----

  function scrubAt(clientX: number) {
    const rect = svgRef.current!.getBoundingClientRect();
    const i = Math.round(startF + ((clientX - rect.left - PL) / plotW) * (win - 1));
    const idx = Math.max(g!.a, Math.min(g!.b, i));
    setHover(idx);
    onScrub?.(data[idx]);
  }
  function clearScrub() { setHover(null); onScrub?.(null); }

  function down(e: React.PointerEvent<SVGSVGElement>) {
    stopAnim();
    const gs: Gesture = {
      mode: "pending", x: e.clientX, y: e.clientY, startEnd: endRef.current,
      lastX: e.clientX, lastT: performance.now(), v: 0, pointerType: e.pointerType,
    };
    // Touch: holding still means "inspect a price".
    if (e.pointerType !== "mouse") {
      gs.timer = setTimeout(() => {
        if (gesture.current?.mode === "pending") {
          gesture.current.mode = "scrub";
          scrubAt(gesture.current.lastX);
          navigator.vibrate?.(8);
        }
      }, HOLD_MS);
    }
    gesture.current = gs;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function move(e: React.PointerEvent<SVGSVGElement>) {
    const gs = gesture.current;
    if (!gs) {
      if (e.pointerType === "mouse") scrubAt(e.clientX);   // plain hover
      return;
    }
    const dx = e.clientX - gs.x, dy = e.clientY - gs.y;

    if (gs.mode === "pending") {
      if (Math.abs(dx) > MOVE_PX && Math.abs(dx) > Math.abs(dy)) {
        gs.mode = "pan";
        clearTimeout(gs.timer);
        clearScrub();
      } else if (Math.abs(dy) > MOVE_PX) {
        clearTimeout(gs.timer);                           // vertical: let the page scroll
        gesture.current = null;
        return;
      }
    }

    if (gs.mode === "pan") {
      const now = performance.now();
      const dt = Math.max(1, now - gs.lastT);
      // Smoothed velocity, in candles per millisecond, for the flick.
      gs.v = 0.8 * gs.v + 0.2 * ((e.clientX - gs.lastX) / pxPerPoint / dt);
      gs.lastT = now;
      setEnd(clamp(gs.startEnd - dx / pxPerPoint));
    } else if (gs.mode === "scrub") {
      scrubAt(e.clientX);
    }
    gs.lastX = e.clientX;
  }

  function up(e: React.PointerEvent<SVGSVGElement>) {
    const gs = gesture.current;
    gesture.current = null;
    if (!gs) return;
    clearTimeout(gs.timer);
    if (gs.mode === "pan" && performance.now() - gs.lastT < 80 && Math.abs(gs.v) > 0.01) glide(gs.v);
    if (gs.pointerType !== "mouse") clearScrub();
    else if (gs.mode !== "pan") scrubAt(e.clientX);
  }

  function cancel() {
    if (gesture.current) clearTimeout(gesture.current.timer);
    gesture.current = null;
    clearScrub();
  }

  // ----- drawing -----

  const color = data[g.b].c >= data[g.a].c ? "var(--good)" : "var(--bad)";
  const start = data[g.a].c;
  const last = data[n - 1];
  const active = hover !== null ? data[hover] : null;

  const txt = (fill: string, size = 10.5): React.CSSProperties =>
    ({ fill, fontSize: size, fontFamily: "var(--mono)", letterSpacing: 0 });

  const tag = (py: number, label: string, bg: string, fg: string) => {
    const tw = label.length * 6.4 + 10;
    return (
      <g>
        <rect x={w - tw} y={py - 9} width={tw} height={18} rx={5} style={{ fill: bg }} />
        <text x={w - tw / 2} y={py + 3.5} textAnchor="middle" style={txt(fg)}>{label}</text>
      </g>
    );
  };

  const hx = active ? g.x(hover!) : 0;
  const hy = active ? g.y(active.c) : 0;
  const timeLabel = active ? fmtTime(active.t, range) : "";
  const timeW = timeLabel.length * 6.2 + 12;
  const timeX = Math.max(timeW / 2, Math.min(w - PR - timeW / 2, hx));
  const clipId = `${gid}c`;

  return (
    <div ref={wrap} style={{ position: "relative", userSelect: "none", overscrollBehaviorX: "contain" }}>
      <svg ref={svgRef} width={w} height={H}
           style={{ display: "block", touchAction: "pan-y", cursor: "crosshair" }}
           onPointerDown={down} onPointerMove={move} onPointerUp={up}
           onPointerLeave={() => { if (!gesture.current) clearScrub(); }}
           onPointerCancel={cancel}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
          <clipPath id={clipId}><rect x={PL} y={0} width={plotW} height={H} /></clipPath>
        </defs>

        {g.ticks.values.map(v => (
          <g key={v}>
            <line x1={PL} x2={PL + plotW} y1={g.y(v)} y2={g.y(v)} style={{ stroke: "var(--line)" }} />
            <text x={w - 2} y={g.y(v) + 3.5} textAnchor="end" style={txt("var(--faint)")}>{v.toFixed(g.ticks.dec)}</text>
          </g>
        ))}
        <text x={PL + 2} y={PT - 7} style={txt("var(--faint)", 10)}>Grid ${g.ticks.step.toFixed(g.ticks.dec)}</text>

        <g clipPath={`url(#${clipId})`}>
          {/* Where the visible window starts */}
          <line x1={PL} x2={PL + plotW} y1={g.y(start)} y2={g.y(start)}
                style={{ stroke: "var(--faint)", strokeDasharray: "3 4", opacity: 0.7 }} />
          <path d={g.area} fill={`url(#${gid})`} />
          <path d={g.line} fill="none" style={{ stroke: color }} strokeWidth={1.6}
                strokeLinejoin="round" strokeLinecap="round" />

          {!active && (
            <>
              <text x={Math.min(Math.max(g.x(g.hiI), 20), plotW - 20)} y={g.y(g.hi) - 7}
                    textAnchor="middle" style={txt("var(--muted)", 10)}>H {fmtPrice(g.hi)}</text>
              <text x={Math.min(Math.max(g.x(g.loI), 20), plotW - 20)} y={g.y(g.lo) + 15}
                    textAnchor="middle" style={txt("var(--muted)", 10)}>L {fmtPrice(g.lo)}</text>
            </>
          )}

          {atLatest && !active && (
            <circle cx={g.x(n - 1)} cy={g.y(last.c)} r={3.5} style={{ fill: color }} />
          )}
        </g>

        {g.times.map((i, k) => (
          <text key={k} x={Math.max(PL, Math.min(PL + plotW, g.x(i)))} y={H - 6}
                textAnchor={k === 0 ? "start" : k === g.times.length - 1 ? "end" : "middle"}
                style={txt("var(--faint)", 10)}>{fmtTime(data[i].t, range)}</text>
        ))}

        {atLatest && !active && tag(g.y(last.c), fmtPrice(last.c), color, "#0C0C0C")}

        {active && (
          <>
            <line x1={hx} x2={hx} y1={PT} y2={PT + plotH} style={{ stroke: "var(--muted)", strokeDasharray: "3 3" }} />
            <line x1={PL} x2={PL + plotW} y1={hy} y2={hy} style={{ stroke: "var(--muted)", strokeDasharray: "3 3", opacity: 0.6 }} />
            <circle cx={hx} cy={hy} r={5} style={{ fill: "var(--ink)", stroke: color, strokeWidth: 2 }} />
            {tag(hy, fmtPrice(active.c), "var(--ink)", "var(--bg)")}
            <rect x={timeX - timeW / 2} y={H - 20} width={timeW} height={17} rx={5} style={{ fill: "var(--raised)" }} />
            <text x={timeX} y={H - 8} textAnchor="middle" style={txt("var(--ink)", 10)}>{timeLabel}</text>
          </>
        )}
      </svg>

      {!atLatest && (
        <button onClick={() => animateTo(n - 1)} style={{
          position: "absolute", top: 0, right: PR + 4, padding: "4px 10px", borderRadius: 999,
          border: 0, cursor: "pointer", fontSize: 11.5, background: "var(--selected)", color: "var(--ink)",
        }}>Latest ›</button>
      )}
      {atLatest && n > win && hover === null && (
        <div style={{
          position: "absolute", top: 3, right: PR + 4, fontSize: 10.5,
          color: "var(--faint)", pointerEvents: "none",
        }}>‹ drag for history</div>
      )}
    </div>
  );
}
