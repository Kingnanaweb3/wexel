// One-time devnet setup: two test tokens, a separate user wallet, balances,
// and the user's spending approval to the program.
import {
  Connection, Keypair, LAMPORTS_PER_SOL, PublicKey,
  SystemProgram, Transaction, sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  createMint, getOrCreateAssociatedTokenAccount, mintTo, approveChecked,
  TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import * as fs from "fs";
import idl from "../../idl/wexel_program.json";
import { CONFIG, loadKeypair } from "../config";

const STATE = "devnet-test.json";

async function main() {
  const connection = new Connection(CONFIG.rpcUrl, "confirmed");
  const keeper = loadKeypair();
  const programId = new PublicKey((idl as any).address);
  const [authority] = PublicKey.findProgramAddressSync([Buffer.from("authority")], programId);

  const state: any = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, "utf-8")) : {};

  // The user must be a different wallet from the keeper, or the test
  // would just move tokens between the same person's accounts.
  const user = state.userSecret
    ? Keypair.fromSecretKey(Uint8Array.from(state.userSecret))
    : Keypair.generate();

  if ((await connection.getBalance(user.publicKey)) < 0.1 * LAMPORTS_PER_SOL) {
    await sendAndConfirmTransaction(connection, new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: keeper.publicKey, toPubkey: user.publicKey,
        lamports: 0.2 * LAMPORTS_PER_SOL,
      })), [keeper]);
    console.log("funded user with 0.2 SOL");
  }

  // tUSDC: classic SPL, 6 decimals. tAAPLx: Token-2022, 8 decimals — same as the real ones.
  const usdc = state.usdcMint ? new PublicKey(state.usdcMint)
    : await createMint(connection, keeper, keeper.publicKey, null, 6, undefined, undefined, TOKEN_PROGRAM_ID);
  const stock = state.stockMint ? new PublicKey(state.stockMint)
    : await createMint(connection, keeper, keeper.publicKey, null, 8, undefined, undefined, TOKEN_2022_PROGRAM_ID);

  const ata = (mint: PublicKey, owner: PublicKey, prog: PublicKey) =>
    getOrCreateAssociatedTokenAccount(connection, keeper, mint, owner, false, "confirmed", undefined, prog);

  const userUsdc = await ata(usdc, user.publicKey, TOKEN_PROGRAM_ID);
  const userStock = await ata(stock, user.publicKey, TOKEN_2022_PROGRAM_ID);
  await ata(usdc, keeper.publicKey, TOKEN_PROGRAM_ID);
  const keeperStock = await ata(stock, keeper.publicKey, TOKEN_2022_PROGRAM_ID);

  await mintTo(connection, keeper, usdc, userUsdc.address, keeper, 100_000_000n, [], undefined, TOKEN_PROGRAM_ID);
  await mintTo(connection, keeper, stock, keeperStock.address, keeper, 1_000_000_000n, [], undefined, TOKEN_2022_PROGRAM_ID);

  // The user's one-time permission: the PROGRAM may spend up to 50 tUSDC.
  await approveChecked(connection, user, usdc, userUsdc.address, authority, user,
    50_000_000n, 6, [], undefined, TOKEN_PROGRAM_ID);

  fs.writeFileSync(STATE, JSON.stringify({
    userSecret: Array.from(user.secretKey),
    usdcMint: usdc.toBase58(),
    stockMint: stock.toBase58(),
  }, null, 2));

  console.log("\nsetup done");
  console.log("  program   ", programId.toBase58());
  console.log("  user      ", user.publicKey.toBase58(), "(100 tUSDC, program approved for 50)");
  console.log("  keeper    ", keeper.publicKey.toBase58(), "(10 tAAPLx to hand over)");
  console.log("  tUSDC     ", usdc.toBase58());
  console.log("  tAAPLx    ", stock.toBase58());
}

main().catch(e => { console.error(e.message ?? e); process.exit(1); });
