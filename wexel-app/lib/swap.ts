import { Connection, PublicKey, VersionedTransaction } from "@solana/web3.js";

export const USDC_MINT_STR = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const SOL_MINT_STR = "So11111111111111111111111111111111111111112";
const SOL_RESERVE = 0.01;   // left behind for fees

export type Holding = {
  mint: string; symbol: string; name: string; icon?: string;
  amount: number; raw: string; decimals: number; price: number; valueUsd: number;
};

// What a holding can actually put into a trade.
export function spendable(h: Holding) {
  return h.mint === SOL_MINT_STR ? Math.max(0, h.amount - SOL_RESERVE) : h.amount;
}

// Convert a typed amount to base units IN PROPORTION to the raw balance, so
// it stays correct for tokens whose displayed amount is scaled (xStocks).
export function toRaw(h: Holding, typed: number) {
  if (typed >= h.amount) return BigInt(h.raw);
  return (BigInt(h.raw) * BigInt(Math.round(typed * 1e9))) / BigInt(Math.round(h.amount * 1e9));
}

export async function getQuote(inputMint: string, outputMint: string, raw: bigint, slippageBps: number) {
  const res = await fetch(`/api/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${raw}&slippageBps=${slippageBps}`);
  if (!res.ok) throw new Error("no route");
  return res.json();
}

// Builds, signs and sends the swap. Jupiter builds against mainnet's newest
// block; the sandbox fork keeps its own, so the blockhash is replaced before
// signing (the signature covers it).
export async function runSwap(connection: Connection, quote: any, owner: PublicKey, signTransaction: any) {
  const res = await fetch("/api/swap", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quote, user: owner.toBase58() }),
  });
  if (!res.ok) throw new Error("build failed");
  const { swapTransaction } = await res.json();

  const tx = VersionedTransaction.deserialize(Buffer.from(swapTransaction, "base64"));
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  tx.message.recentBlockhash = blockhash;

  const signed = await signTransaction(tx);
  const sig = await connection.sendRawTransaction(signed.serialize(), { maxRetries: 3 });
  await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
  return sig;
}

// Plain-language errors that always say whether money moved.
export function friendly(e: any): string {
  const m = String(e?.message ?? e ?? "").toLowerCase();
  if (m.includes("rejected")) return "Cancelled in your wallet. Nothing was spent.";
  if (m.includes("blockhash") || m.includes("address table")) return "The network moved on before this went through. Nothing was spent — try again.";
  if (m.includes("0x1771") || m.includes("slippage")) return "Price moved more than your slippage limit. Nothing was spent — try again or allow more slippage.";
  if (m.includes("insufficient") || m.includes("0x1")) return "Not enough balance for this trade, including fees. Nothing was spent.";
  if (m.includes("no route")) return "No route between these two tokens right now.";
  return "Trade didn't go through. Nothing left your wallet.";
}

export async function loadHoldings(owner: string): Promise<Holding[]> {
  const res = await fetch(`/api/portfolio?owner=${owner}`);
  if (!res.ok) return [];
  const d = await res.json();
  return (d.holdings ?? []).filter((h: any) => h.price > 0 && h.valueUsd >= 0.5 && h.raw);
}
