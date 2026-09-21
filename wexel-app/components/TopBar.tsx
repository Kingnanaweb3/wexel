"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";

const WalletMultiButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((m) => m.WalletMultiButton),
  { ssr: false }
);

export function TopBar({ title, back }: { title: string; back?: boolean }) {
  const router = useRouter();

  return (
    <header style={{
      display: "flex", alignItems: "center", gap: 12,
      height: 56, padding: "0 20px",
      position: "sticky", top: 0, zIndex: 30,
      background: "rgba(12,12,12,.86)", backdropFilter: "blur(14px)",
      borderBottom: "1px solid var(--line)",
    }}>
      {back && (
        <button onClick={() => router.back()} style={{
          background: "none", border: 0, color: "var(--muted)",
          fontSize: 19, cursor: "pointer", padding: 0, lineHeight: 1,
        }}>←</button>
      )}
      <div style={{ flex: 1, fontSize: 16, fontWeight: 450 }}>{title}</div>
      <WalletMultiButton style={{
        background: "rgba(255,255,255,.05)",
        border: "1px solid var(--line)",
        borderRadius: 10, height: 34, fontSize: 12.5,
        fontFamily: "var(--sans)", fontWeight: 450, letterSpacing: "-0.4px",
        padding: "0 12px",
      }} />
    </header>
  );
}
