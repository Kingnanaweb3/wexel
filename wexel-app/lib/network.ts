import { PublicKey } from "@solana/web3.js";

export const IS_DEVNET = (process.env.NEXT_PUBLIC_RPC_URL ?? "").includes("devnet");

// Real USDC on mainnet; the test token on devnet.
export const USDC_MINT = new PublicKey(
  process.env.NEXT_PUBLIC_USDC_MINT || "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
);

// xStocks don't exist on devnet, so every stock rule there uses one test token.
export function stockMint(realMint: string): PublicKey {
  const test = process.env.NEXT_PUBLIC_TEST_STOCK_MINT;
  return new PublicKey(IS_DEVNET && test ? test : realMint);
}

export const explorerTx = (sig: string) =>
  `https://explorer.solana.com/tx/${sig}${IS_DEVNET ? "?cluster=devnet" : ""}`;
