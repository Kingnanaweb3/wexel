"use client";

import { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";

export function WalletProviders({ children }: { children: React.ReactNode }) {
  // Falls back to public RPC if the env var is missing, so the app still loads.
  const endpoint = useMemo(
    () => process.env.NEXT_PUBLIC_RPC_URL || "https://api.mainnet-beta.solana.com",
    []
  );

  // Empty array = wallet-standard autodetection. Phantom, Solflare and
  // Backpack all register themselves, so no adapter list is needed.
  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
