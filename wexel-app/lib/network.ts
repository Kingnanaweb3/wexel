import { PublicKey } from "@solana/web3.js";

export const IS_DEVNET = (process.env.NEXT_PUBLIC_RPC_URL ?? "").includes("devnet");

// Paper mode: a local fork of Solana mainnet — real stocks, real prices,
// real Jupiter routes, practice money.
export const IS_PAPER = process.env.NEXT_PUBLIC_MODE === "paper";

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
  IS_PAPER
    ? `https://explorer.solana.com/tx/${sig}?cluster=custom&customUrl=${encodeURIComponent(process.env.NEXT_PUBLIC_RPC_URL ?? "")}`
    : `https://explorer.solana.com/tx/${sig}${IS_DEVNET ? "?cluster=devnet" : ""}`;
