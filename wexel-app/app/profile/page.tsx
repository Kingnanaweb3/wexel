"use client";
import { TopBar } from "@/components/TopBar";
import { useWallet } from "@solana/wallet-adapter-react";

export default function Profile() {
  const { publicKey } = useWallet();

  return (
    <>
      <TopBar title="Profile" />
      <div style={{ padding: 20 }}>
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="eyebrow" style={{ marginBottom: 9 }}>Wallet</div>
          <div className="mono" style={{ fontSize: 12.5, wordBreak: "break-all", color: "var(--muted)" }}>
            {publicKey ? publicKey.toBase58() : "Not connected"}
          </div>
        </div>

        <div className="eyebrow" style={{ marginBottom: 12 }}>What this doesn't do yet</div>
        <Limit
          label="Bank deposits"
          text="You fund with crypto you already hold. Card and bank rails need licensing we don't have."
        />
        <Limit
          label="Automating pre-IPO"
          text="Those prices move on single trades. We'd rather refuse than fire a rule on a number we don't trust."
        />
        <Limit
          label="Fully trustless pricing"
          text="A keeper reports the price to the contract today. Your spend cap, slippage cap and expiry bound what it can do. Reading the pool on-chain is next."
        />
        <Limit
          label="Not for U.S. persons"
          text="Tokenized stocks are issued for non-U.S. investors only, and carry risk of total loss."
        />
      </div>
    </>
  );
}

function Limit({ label, text }: { label: string; text: string }) {
  return (
    <div style={{ padding: "18px 0", borderBottom: "1px solid var(--line)" }}>
      <b style={{ fontWeight: 450, fontSize: 14.5, display: "block", marginBottom: 5 }}>{label}</b>
      <p style={{ fontSize: 13.5, lineHeight: 1.65, color: "var(--muted)", margin: 0 }}>{text}</p>
    </div>
  );
}
