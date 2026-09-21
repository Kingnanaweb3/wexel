"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import QRCode from "qrcode";
import { Copy, Check } from "lucide-react";

export function ReceiveSheet({ onClose }: { onClose: () => void }) {
  const { publicKey } = useWallet();
  const address = publicKey?.toBase58() ?? "";
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);
  const devnet = (process.env.NEXT_PUBLIC_RPC_URL ?? "").includes("devnet");

  useEffect(() => {
    if (!address) return;
    QRCode.toDataURL(address, { margin: 1, width: 220 }).then(setQr).catch(() => {});
  }, [address]);

  async function copy() {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="grab" />
        <h2 style={{ fontSize: 20, marginBottom: 4 }}>Receive</h2>
        <p style={{ fontSize: 13, color: "var(--muted)", margin: "0 0 20px" }}>
          Send USDC, SOL or any Solana token to this address.
        </p>

        {qr && (
          <div style={{ display: "grid", placeItems: "center", marginBottom: 18 }}>
            <img src={qr} alt="Wallet QR code" width={200} height={200}
                 style={{ borderRadius: 16, background: "#fff", padding: 8 }} />
          </div>
        )}

        <div className="card" style={{ marginBottom: 12, padding: 14 }}>
          <div className="mono" style={{ fontSize: 12.5, wordBreak: "break-all", lineHeight: 1.6 }}>
            {address}
          </div>
        </div>

        <button className="btn btn-primary" onClick={copy}>
          {copied ? <><Check size={15} /> Copied</> : <><Copy size={15} /> Copy address</>}
        </button>

        <p style={{ fontSize: 12, color: "var(--faint)", lineHeight: 1.6, margin: "14px 0 0" }}>
          Only send tokens on the Solana network. Tokens sent from other chains
          (Ethereum, BNB) to this address will be lost.
          {devnet && " You're on devnet — only devnet tokens will show up here."}
        </p>
      </div>
    </div>
  );
}
