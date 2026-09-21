import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import idl from "./idl/wexel_program.json";

// Taken from the IDL, so the app can never point at a different program
// than the one its instructions were built for.
export const PROGRAM_ID = new PublicKey((idl as any).address);

export function getProgram(connection: Connection, wallet: any) {
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  return new anchor.Program(idl as anchor.Idl, provider) as any;
}

// The program address users approve as their spender.
export function authorityPda(): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("authority")], PROGRAM_ID)[0];
}

// Which token program owns a mint: classic SPL (USDC) or Token-2022 (xStocks).
export async function tokenProgramOf(connection: Connection, mint: PublicKey) {
  const info = await connection.getAccountInfo(mint);
  return info ? info.owner : null;
}

export const enumName = (v: any) => (v ? Object.keys(v)[0] : "");

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
    amount: Number(r.account.amount) / 1e6,
    maxExecution: Number(r.account.maxExecution) / 1e6,
    maxSlippageBps: r.account.maxSlippageBps,
    expiryUnix: Number(r.account.expiryUnix),
    inputMint: r.account.inputMint.toBase58(),
    outputMint: r.account.outputMint.toBase58(),
  }));
}

// Displayed units per raw unit (xStocks' dividend multiplier). 1 for USDC.
export async function uiMultiplier(connection: Connection, mint: PublicKey): Promise<number> {
  const info: any = (await connection.getParsedAccountInfo(mint)).value?.data;
  const s = (info?.parsed?.info?.extensions ?? []).find((e: any) => e.extension === "scaledUiAmountConfig")?.state;
  if (!s) return 1;
  return Number(Date.now() / 1000 >= s.newMultiplierEffectiveTimestamp ? s.newMultiplier : s.multiplier) || 1;
}
