"use client";

import dynamic from "next/dynamic";

// The wallet button touches browser APIs, so it can't be server-rendered.
const WalletMultiButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((m) => m.WalletMultiButton),
  { ssr: false }
);

export function Header() {
  return (
    <header style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "18px 20px", borderBottom: "1px solid var(--hair)",
    }}>
      <div>
        <div className="display" style={{ fontSize: 19, letterSpacing: "-0.04em" }}>
          Wexel
        </div>
        <div className="mono-label" style={{ marginTop: 2 }}>
          rules that trade for you
        </div>
      </div>
      <WalletMultiButton style={{
        background: "linear-gradient(135deg, #9B8BF5, #6C5CE7)",
        borderRadius: 999, height: 38, fontSize: 13,
        fontFamily: "Inter, sans-serif", fontWeight: 500,
      }} />
    </header>
  );
}
