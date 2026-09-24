"use client";

import { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";
import { PaperWalletAdapter } from "@/lib/paperWallet";
import { IS_PAPER } from "@/lib/network";

export function WalletProviders({ children }: { children: React.ReactNode }) {
  // Falls back to public RPC if the env var is missing, so the app still loads.
  const endpoint = useMemo(
    () => process.env.NEXT_PUBLIC_RPC_URL || "https://api.mainnet-beta.solana.com",
    []
  );

  // Paper mode adds the built-in practice wallet; otherwise real wallets
  // (Phantom, Solflare, Backpack) register themselves.
  const paperWallets = useMemo(() => (IS_PAPER ? [new PaperWalletAdapter()] : []), []);

  // Empty array = wallet-standard autodetection. Phantom, Solflare and
  // Backpack all register themselves, so no adapter list is needed.
  return (
    <ConnectionProvider endpoint={endpoint}
      config={{ commitment: "confirmed", wsEndpoint: process.env.NEXT_PUBLIC_WS_URL || undefined }}>
      <WalletProvider wallets={paperWallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
