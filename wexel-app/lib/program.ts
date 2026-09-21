import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import idl from "./idl/wexel_program.json";

export const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_PROGRAM_ID ??
  "8kUZWkfcVpwv55LrjrnSAm5q67zV2dnn3xGqJrfqEnz5"
);

// Builds an Anchor program handle bound to the connected wallet.
export function getProgram(connection: Connection, wallet: any) {
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  return new anchor.Program(idl as anchor.Idl, provider);
}

// Anchor represents Rust enums as { variantName: {} }, so this pulls the name out.
export function enumName(v: any): string {
  return v ? Object.keys(v)[0] : "";
}

// Reads every rule this wallet owns. `memcmp` filters server-side on the
// owner field so we don't download every rule on the program.
export async function fetchMyRules(program: any, owner: PublicKey) {
  const all = await program.account.rule.all([
    { memcmp: { offset: 8, bytes: owner.toBase58() } },
  ]);

  return all.map((r: any) => ({
    pubkey: r.publicKey.toBase58(),
    asset: r.account.asset,
    direction: enumName(r.account.direction),
    action: enumName(r.account.action),
    status: enumName(r.account.status),
    thresholdPct: r.account.thresholdPct,
    entryPrice: r.account.entryPrice,
    lastPrice: r.account.lastPrice,
    amount: Number(r.account.amount) / 1e6,          // stored in USDC units
    maxExecution: Number(r.account.maxExecution) / 1e6,
    maxSlippageBps: r.account.maxSlippageBps,
    expiryUnix: Number(r.account.expiryUnix),
  }));
}
