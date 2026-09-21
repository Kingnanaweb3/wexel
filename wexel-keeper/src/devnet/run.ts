// Creates a real rule at the live AAPL price, then has the keeper execute it.
//   ok       keeper delivers a fair amount      -> should EXECUTE
//   short    keeper delivers half               -> settle should REVERT everything
//   nosettle keeper tries to skip the check     -> execute should REFUSE
import * as anchor from "@coral-xyz/anchor";
import {
  Connection, Keypair, PublicKey, SystemProgram, Transaction, SYSVAR_INSTRUCTIONS_PUBKEY,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync, createTransferCheckedInstruction, getAccount,
  TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import * as fs from "fs";
import idl from "../../idl/wexel_program.json";
import { CONFIG, loadKeypair } from "../config";
import { fetchPrices } from "../prices";

const mode = process.argv[2] || "ok";

async function main() {
  const state = JSON.parse(fs.readFileSync("devnet-test.json", "utf-8"));
  const connection = new Connection(CONFIG.rpcUrl, "confirmed");

  const keeper = loadKeypair();
  const user = Keypair.fromSecretKey(Uint8Array.from(state.userSecret));
  const usdc = new PublicKey(state.usdcMint);
  const stock = new PublicKey(state.stockMint);

  const mk = (kp: Keypair) => new anchor.Program(idl as anchor.Idl,
    new anchor.AnchorProvider(connection, new anchor.Wallet(kp), { commitment: "confirmed" })) as any;
  const asUser = mk(user);
  const asKeeper = mk(keeper);

  const [authority] = PublicKey.findProgramAddressSync([Buffer.from("authority")], asKeeper.programId);
  const userUsdc = getAssociatedTokenAddressSync(usdc, user.publicKey, false, TOKEN_PROGRAM_ID);
  const userStock = getAssociatedTokenAddressSync(stock, user.publicKey, false, TOKEN_2022_PROGRAM_ID);
  const keeperUsdc = getAssociatedTokenAddressSync(usdc, keeper.publicKey, false, TOKEN_PROGRAM_ID);
  const keeperStock = getAssociatedTokenAddressSync(stock, keeper.publicKey, false, TOKEN_2022_PROGRAM_ID);

  const bal = async () => ({
    usdc: Number((await getAccount(connection, userUsdc, "confirmed", TOKEN_PROGRAM_ID)).amount) / 1e6,
    stock: Number((await getAccount(connection, userStock, "confirmed", TOKEN_2022_PROGRAM_ID)).amount) / 1e8,
  });

  // Live price. Entry is set 10% above it, so a 5% dip has already happened.
  const price = (await fetchPrices(["AAPL"])).get("AAPL");
  if (!price) throw new Error("no live AAPL price");
  const entry = price * 1.10;

  const rule = Keypair.generate();
  await asUser.methods
    .createRule("AAPL", { down: {} }, 5, entry, { buy: {} },
      new anchor.BN(10_000_000), new anchor.BN(10_000_000), 100,
      new anchor.BN(Math.floor(Date.now() / 1000) + 3600), usdc, stock)
    .accountsPartial({ rule: rule.publicKey, owner: user.publicKey, systemProgram: SystemProgram.programId })
    .signers([rule])
    .rpc();

  console.log(`\n[${mode}] rule ${rule.publicKey.toBase58().slice(0, 8)} · AAPL live $${price.toFixed(2)} · buy $10`);
  const before = await bal();
  console.log(`  before   user ${before.usdc} tUSDC · ${before.stock} tAAPLx`);

  // 1. execute — confirms the trigger, pulls $10 to the keeper
  const executeIx = await asKeeper.methods.execute(price).accountsPartial({
    rule: rule.publicKey, authority,
    inputMint: usdc, outputMint: stock,
    userInput: userUsdc, keeperInput: keeperUsdc, userOutput: userStock,
    keeper: keeper.publicKey,
    inputTokenProgram: TOKEN_PROGRAM_ID, outputTokenProgram: TOKEN_2022_PROGRAM_ID,
    instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
  }).instruction();

  // 2. the "swap" — on mainnet this is Jupiter; here the keeper hands over tAAPLx
  const fair = Math.floor((10 / price) * 1e8);
  const deliver = mode === "short" ? Math.floor(fair / 2) : fair;
  const swapIx = createTransferCheckedInstruction(
    keeperStock, stock, userStock, keeper.publicKey, deliver, 8, [], TOKEN_2022_PROGRAM_ID);

  // 3. settle — checks the user got at least the minimum
  const settleIx = await asKeeper.methods.settle().accountsPartial({
    rule: rule.publicKey, outputMint: stock,
    userOutput: userStock, outputTokenProgram: TOKEN_2022_PROGRAM_ID,
  }).instruction();

  const tx = new Transaction().add(executeIx, swapIx);
  if (mode !== "nosettle") tx.add(settleIx);

  try {
    const sig = await asKeeper.provider.sendAndConfirm(tx, [keeper]);
    console.log(`  SENT     ${sig.slice(0, 16)}…`);
  } catch (e: any) {
    const logs: string[] = e.logs ?? e.transactionLogs ?? [];
    const why = logs.find(l => l.includes("Error Message")) ?? e.message?.slice(0, 120);
    console.log(`  REJECTED ${why}`);
  }

  const after = await bal();
  const status = Object.keys((await asKeeper.account.rule.fetch(rule.publicKey)).status)[0];
  console.log(`  after    user ${after.usdc} tUSDC · ${after.stock} tAAPLx`);
  console.log(`  rule     ${status}`);

  const expect: Record<string, string> = {
    ok: "executed, USDC down $10, stock up",
    short: "watching, balances unchanged",
    nosettle: "watching, balances unchanged",
  };
  console.log(`  expected ${expect[mode]}\n`);
}

main().catch(e => { console.error(e.message ?? e); process.exit(1); });
