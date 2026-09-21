"use client";

import dynamic from "next/dynamic";
import { Bell, Sun, Moon } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useTheme } from "./ThemeProvider";

const WalletMultiButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((m) => m.WalletMultiButton),
  { ssr: false }
);

function timeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function Greeting() {
  const { publicKey } = useWallet();
  const { theme, toggle } = useTheme();

  const short = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}…${publicKey.toBase58().slice(-4)}`
    : null;

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 11, padding: "18px 20px 6px",
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: "50%",
        background: "var(--raised)", display: "grid", placeItems: "center",
        fontFamily: "var(--mono)", fontSize: 13, flexShrink: 0,
      }}>
        {short ? short.slice(0, 2).toUpperCase() : "—"}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: "var(--faint)" }}>{timeOfDay()},</div>
        <div className="mono" style={{
          fontSize: 14.5, whiteSpace: "nowrap", overflow: "hidden",
          textOverflow: "ellipsis", marginTop: 1,
        }}>
          {short ?? "Connect wallet"}
        </div>
      </div>

      <button onClick={toggle} className="icon-chip" style={{ border: 0, cursor: "pointer" }}>
        {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
      </button>

      {!publicKey && (
        <WalletMultiButton style={{
          background: "var(--navpill)", color: "var(--ink-inv)",
          borderRadius: 999, height: 34, fontSize: 12.5,
          fontFamily: "var(--sans)", fontWeight: 500, padding: "0 14px",
        }} />
      )}
    </div>
  );
}
