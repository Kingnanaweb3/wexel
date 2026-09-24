// Gives any devnet wallet 0.2 SOL and 100 tUSDC, and tops up the keeper's
// test inventory so it can hand over output in test mode.
import { Connection, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction, sendAndConfirmTransaction } from "@solana/web3.js";
import { getOrCreateAssociatedTokenAccount, mintTo, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import * as fs from "fs";
import { CONFIG, loadKeypair } from "../config";

async function main() {
  const to = new PublicKey(process.argv[2]);
  const state = JSON.parse(fs.readFileSync("devnet-test.json", "utf-8"));
  const connection = new Connection(CONFIG.rpcUrl, "confirmed");
  const keeper = loadKeypair();
  const usdc = new PublicKey(state.usdcMint);
  const stock = new PublicKey(state.stockMint);

  if (to.equals(keeper.publicKey)) throw new Error("Use a wallet other than the keeper for testing.");

  await sendAndConfirmTransaction(connection, new Transaction().add(SystemProgram.transfer({
    fromPubkey: keeper.publicKey, toPubkey: to, lamports: 0.2 * LAMPORTS_PER_SOL })), [keeper]);

  const ata = (mint: PublicKey, owner: PublicKey, prog: PublicKey) =>
    getOrCreateAssociatedTokenAccount(connection, keeper, mint, owner, false, "confirmed", undefined, prog);

  const userUsdc = await ata(usdc, to, TOKEN_PROGRAM_ID);
  await mintTo(connection, keeper, usdc, userUsdc.address, keeper, 100_000_000n, [], undefined, TOKEN_PROGRAM_ID);

  // Keeper inventory for test-mode handovers (both directions).
  const kUsdc = await ata(usdc, keeper.publicKey, TOKEN_PROGRAM_ID);
  const kStock = await ata(stock, keeper.publicKey, TOKEN_2022_PROGRAM_ID);
  await mintTo(connection, keeper, usdc, kUsdc.address, keeper, 1_000_000_000n, [], undefined, TOKEN_PROGRAM_ID);
  await mintTo(connection, keeper, stock, kStock.address, keeper, 1_000_000_000n, [], undefined, TOKEN_2022_PROGRAM_ID);

  console.log(`sent 0.2 SOL + 100 tUSDC to ${to.toBase58()}`);
  console.log("keeper inventory topped up: +1000 tUSDC, +10 tAAPLx");
}

main().catch((e) => { console.error(e.message ?? e); process.exit(1); });
