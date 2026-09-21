"use client";

type Props = {
  entry: number;
  trigger: number;
  current: number | null;
  direction: "up" | "down";
  compact?: boolean;
};

export function RuleTrack({ entry, trigger, current, direction, compact }: Props) {
  const distance = Math.abs(trigger - entry) || 1;
  const moved = current === null ? 0 :
    direction === "down" ? entry - current : current - entry;
  const progress = Math.max(0, Math.min(1, moved / distance));
  const fill = direction === "down" ? "var(--bad)" : "var(--good)";

  // Keep the floating label inside the card at the extremes.
  const labelLeft = `clamp(28px, ${progress * 100}%, calc(100% - 28px))`;

  return (
    <div>
      {/* Floating "Now" label above the dot */}
      {current !== null && (
        <div style={{ position: "relative", height: 32 }}>
          <div className="num" style={{
            position: "absolute", left: labelLeft, transform: "translateX(-50%)",
            fontSize: 11.5, textAlign: "center", whiteSpace: "nowrap",
            transition: "left 600ms cubic-bezier(.16,1,.3,1)",
          }}>
            <div style={{ color: "var(--faint)", fontSize: 10.5 }}>Now</div>
            ${current.toFixed(2)}
          </div>
        </div>
      )}

      <div style={{ position: "relative", height: 16, marginBottom: 8 }}>
        <div style={{ ...bar, background: "var(--selected)" }} />
        <div style={{
          ...bar, right: "auto", width: `${progress * 100}%`, background: fill,
          transition: "width 600ms cubic-bezier(.16,1,.3,1)",
        }} />
        <div style={{ ...tick, left: 0 }} />
        <div style={{ ...tick, left: "100%", background: fill }} />
        {current !== null && (
          <div style={{
            position: "absolute", top: "50%", left: `${progress * 100}%`,
            width: compact ? 12 : 14, height: compact ? 12 : 14, borderRadius: "50%",
            background: "var(--ink)", border: "3px solid var(--surface)",
            transform: "translate(-50%, -50%)",
            transition: "left 600ms cubic-bezier(.16,1,.3,1)",
          }} />
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5 }}>
        <div>
          <div style={{ color: "var(--faint)" }}>Set at</div>
          <div className="num" style={{ color: "var(--muted)" }}>${entry.toFixed(2)}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ color: "var(--faint)" }}>Fires at</div>
          <div className="num" style={{ color: fill }}>${trigger.toFixed(2)}</div>
        </div>
      </div>
    </div>
  );
}

const bar: React.CSSProperties = {
  position: "absolute", top: "50%", left: 0, right: 0, height: 4,
  transform: "translateY(-50%)", borderRadius: 999,
};

const tick: React.CSSProperties = {
  position: "absolute", top: "50%", width: 2, height: 14, borderRadius: 2,
  background: "var(--faint)", transform: "translate(-50%, -50%)",
};
