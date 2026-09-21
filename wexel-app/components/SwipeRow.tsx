"use client";

import { useRef, useState } from "react";

// Drag left to reveal an action behind the row. Past the threshold it
// snaps open; otherwise it springs back. Works with touch and mouse.
export function SwipeRow({ children, action, actionLabel, disabled }: {
  children: React.ReactNode;
  action: () => void;
  actionLabel: string;
  disabled?: boolean;
}) {
  const REVEAL = 96;
  const [x, setX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number; base: number } | null>(null);
  const horizontal = useRef<boolean | null>(null);

  function down(e: React.PointerEvent) {
    if (disabled) return;
    start.current = { x: e.clientX, y: e.clientY, base: x };
    horizontal.current = null;
  }

  function move(e: React.PointerEvent) {
    if (!start.current) return;
    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;

    // Decide once whether this is a swipe or a vertical scroll.
    if (horizontal.current === null && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
      horizontal.current = Math.abs(dx) > Math.abs(dy);
    }
    if (!horizontal.current) return;

    setDragging(true);
    setX(Math.max(-REVEAL - 20, Math.min(0, start.current.base + dx)));
  }

  function up() {
    if (!start.current) return;
    start.current = null;
    setDragging(false);
    setX(v => (v < -REVEAL / 2 ? -REVEAL : 0));
  }

  return (
    <div style={{ position: "relative", borderRadius: 18, overflow: "hidden", marginBottom: 10 }}>
      <button
        onClick={() => { setX(0); action(); }}
        style={{
          position: "absolute", inset: 0, left: "auto", width: REVEAL,
          background: "var(--bad)", color: "#fff", border: 0,
          fontSize: 13, fontWeight: 500, cursor: "pointer",
        }}
      >{actionLabel}</button>

      <div
        onPointerDown={down} onPointerMove={move}
        onPointerUp={up} onPointerCancel={up} onPointerLeave={up}
        style={{
          position: "relative", transform: `translateX(${x}px)`,
          transition: dragging ? "none" : "transform 260ms cubic-bezier(.16,1,.3,1)",
          touchAction: "pan-y",
        }}
      >
        {children}
      </div>
    </div>
  );
}
