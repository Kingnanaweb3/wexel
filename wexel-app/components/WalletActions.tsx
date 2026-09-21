"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { ReceiveSheet } from "./ReceiveSheet";
import { SendSheet } from "./SendSheet";

export function WalletActions({ onSent }: { onSent?: () => void }) {
  const { publicKey } = useWallet();
  const [sheet, setSheet] = useState<null | "send" | "receive">(null);

  return (
    <>
      <div style={{ display: "flex", gap: 9 }}>
        <button className="btn" disabled={!publicKey} onClick={() => setSheet("receive")}
                style={{ padding: "12px 14px", fontSize: 13.5 }}>
          Receive <ArrowDownLeft size={14} />
        </button>
        <button className="btn btn-primary" disabled={!publicKey} onClick={() => setSheet("send")}
                style={{ padding: "12px 14px", fontSize: 13.5 }}>
          Send <ArrowUpRight size={14} />
        </button>
      </div>

      {sheet === "receive" && <ReceiveSheet onClose={() => setSheet(null)} />}
      {sheet === "send" && <SendSheet onClose={() => setSheet(null)} onSent={onSent} />}
    </>
  );
}
