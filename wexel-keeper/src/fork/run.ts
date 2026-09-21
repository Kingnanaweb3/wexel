// Mainnet-fork test. Talks to a local Surfpool fork of mainnet: the real
// AAPLx token, real USDC, real Jupiter routes and pools. Only balances are
// created locally. The keeper (a separate process, Jupiter mode) executes.
//
//   npm run fork setup   test user + 50 real USDC + spending approval
//   npm run fork buy     buy-the-dip rule, already past trigger
//   npm run fork sell    take-profit rule on the AAPLx just bought
import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync, getAccount, createApproveCheckedInstruction,
  TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import * as fs from "fs";
import idl from "../../idl/wexel_program.json";
import { fetchPrices } from "../prices";

const RPC = "http://127.0.0.1:8899";
const USDC = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const AAPLX = new PublicKey("XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp");
const STATE = "fork-test.json";
const mode = process.argv[2] || "setup";

const connection = new Connection(RPC, "confirmed");

async function rpc(method: string, params: any[]) {
  const r = await fetch(RPC, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message);
  return j.result;
}

// Surfpool cheatcode: give a wallet a token balance on the fork.
async function fund(owner: PublicKey, mint: PublicKey, raw: number, prog: PublicKey) {
  try {
    await rpc("surfnet_setTokenAccount", [owner.toBase58(), mint.toBase58(), { amount: raw }, prog.toBase58()]);
  } catch {
    await rpc("surfnet_setTokenAccount", [{ owner: owner.toBase58(), mint: mint.toBase58(),
      tokenProgram: prog.toBase58(), update: { amount: raw } }]);
  }
}

async function multiplier(): Promise<number> {
  const info: any = (await connection.getParsedAccountInfo(AAPLX)).value?.data;
  const s = (info?.parsed?.info?.extensions ?? []).find((e: any) => e.extension === "scaledUiAmountConfig")?.state;
  if (!s) return 1;
  return Number(Date.now() / 1000 >= s.newMultiplierEffectiveTimestamp ? s.newMultiplier : s.multiplier) || 1;
}

async function raw(ata: PublicKey, prog: PublicKey) {
  try { return (await getAccount(connection, ata, "confirmed", prog)).amount; } catch { return BigInt(0); }
}

async function balances(user: PublicKey, m: number) {
  const u = await raw(getAssociatedTokenAddressSync(USDC, user, false, TOKEN_PROGRAM_ID), TOKEN_PROGRAM_ID);
  const a = await raw(getAssociatedTokenAddressSync(AAPLX, user, false, TOKEN_2022_PROGRAM_ID), TOKEN_2022_PROGRAM_ID);
  return { usdc: Number(u) / 1e6, aaplRaw: a, aaplShown: (Number(a) / 1e8) * m };
}

function show(label: string, b: any) {
  console.log(`  ${label.padEnd(8)} ${b.usdc.toFixed(4)} USDC · ${b.aaplShown.toFixed(6)} AAPLx shown (${b.aaplRaw} raw)`);
}

async function waitFor(program: any, rule: PublicKey) {
  for (let i = 0; i < 40; i++) {
    const r = await program.account.rule.fetch(rule);
    const status = Object.keys(r.status)[0];
    if (status !== "watching") return r;
    await new Promise(res => setTimeout(res, 3000));
  }
  return program.account.rule.fetch(rule);
}

async function main() {
  const state = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, "utf-8")) : {};
  const user = state.user ? Keypair.fromSecretKey(Uint8Array.from(state.user)) : Keypair.generate();
  const program = new anchor.Program(idl as anchor.Idl,
    new anchor.AnchorProvider(connection, new anchor.Wallet(user), { commitment: "confirmed" })) as any;
  const authority = PublicKey.findProgramAddressSync([Buffer.from("authority")], program.programId)[0];
  const m = await multiplier();

  if (mode === "setup") {
    const sig = await connection.requestAirdrop(user.publicKey, 2 * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(sig, "confirmed");
    await fund(user.publicKey, USDC, 50_000_000, TOKEN_PROGRAM_ID);

    const userUsdc = getAssociatedTokenAddressSync(USDC, user.publicKey, false, TOKEN_PROGRAM_ID);
    const tx = new Transaction().add(createApproveCheckedInstruction(
      userUsdc, USDC, authority, user.publicKey, 50_000_000, 6, [], TOKEN_PROGRAM_ID));
    await program.provider.sendAndConfirm(tx, [user]);

    fs.writeFileSync(STATE, JSON.stringify({ user: Array.from(user.secretKey) }));
    console.log(`\nfork setup · user ${user.publicKey.toBase58()}`);
    console.log(`  AAPLx display multiplier on the fork: ${m}`);
    show("balance", await balances(user.publicKey, m));
    console.log("  program approved to spend up to 50 USDC");
    return;
  }

  const price = (await fetchPrices(["AAPL"])).get("AAPL");
  if (!price) throw new Error("no live AAPL price");
  const buying = mode === "buy";
  const usd = buying ? 10 : 5;

  // Entry is set so the trigger is already met at the real live price.
  const entry = buying ? price * 1.10 : price * 0.90;
  const direction = buying ? { down: {} } : { up: {} };
  const trigger = buying ? entry * 0.95 : entry * 1.05;

  if (!buying) {
    // Sell rules need permission on the AAPLx account, sized in RAW units.
    const shares = usd / trigger;
    const allow = Math.ceil((shares / m) * 1e8 * 1.01);
    const userAapl = getAssociatedTokenAddressSync(AAPLX, user.publicKey, false, TOKEN_2022_PROGRAM_ID);
    await program.provider.sendAndConfirm(new Transaction().add(createApproveCheckedInstruction(
      userAapl, AAPLX, authority, user.publicKey, allow, 8, [], TOKEN_2022_PROGRAM_ID)), [user]);
  }

  const rule = Keypair.generate();
  await program.methods
    .createRule("AAPL", direction, 5, entry, buying ? { buy: {} } : { swapToUsdc: {} },
      new anchor.BN(usd * 1e6), new anchor.BN(usd * 1e6), 100,
      new anchor.BN(Math.floor(Date.now() / 1000) + 3600),
      buying ? USDC : AAPLX, buying ? AAPLX : USDC)
    .accountsPartial({ rule: rule.publicKey, owner: user.publicKey, systemProgram: SystemProgram.programId })
    .signers([rule])
    .rpc();

  console.log(`\n[${mode}] rule ${rule.publicKey.toBase58().slice(0, 8)} · AAPL live $${price.toFixed(2)} · ${buying ? "buy" : "sell"} $${usd}`);
  const before = await balances(user.publicKey, m);
  show("before", before);
  console.log("  waiting for the keeper (Jupiter mode)…");

  const r = await waitFor(program, rule.publicKey);
  const after = await balances(user.publicKey, m);
  show("after", after);

  const status = Object.keys(r.status)[0];
  const got = buying ? Number(after.aaplRaw - before.aaplRaw) : Math.round((after.usdc - before.usdc) * 1e6);
  console.log(`  rule     ${status}`);
  console.log(`  minimum  ${r.minOut.toString()} raw · received ${got} raw${status === "executed" && got >= Number(r.minOut) ? "  ✓" : status === "executed" ? "  ✗ below minimum" : "  (not executed)"}`);
  if (buying && status === "executed") {
    const paid = before.usdc - after.usdc;
    console.log(`  paid $${paid.toFixed(4)} for ${(after.aaplShown - before.aaplShown).toFixed(6)} AAPLx shown` +
                ` → $${(paid / (after.aaplShown - before.aaplShown)).toFixed(2)}/share vs live $${price.toFixed(2)}`);
  }
}

main().catch(e => { console.error(e.message ?? e); process.exit(1); });
