import * as anchor from "@coral-xyz/anchor";
import {
  Connection, PublicKey, TransactionInstruction, TransactionMessage,
  VersionedTransaction, ComputeBudgetProgram, SYSVAR_INSTRUCTIONS_PUBKEY,
  AddressLookupTableAccount,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync, getAccount, getMint,
  createAssociatedTokenAccountIdempotentInstruction, createTransferCheckedInstruction,
} from "@solana/spl-token";
import idl from "../idl/wexel_program.json";
import { CONFIG, loadKeypair } from "./config";
import { fetchPrices } from "./prices";

const EXECUTOR = (process.env.EXECUTOR || "jupiter") as "jupiter" | "test";
const JUP = "https://lite-api.jup.ag/swap/v1";
const UA = { "User-Agent": "Mozilla/5.0" };

const connection = new Connection(CONFIG.rpcUrl, "confirmed");
const keeper = loadKeypair();
const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(keeper), { commitment: "confirmed" });
const program = new anchor.Program(idl as anchor.Idl, provider) as any;
const authority = PublicKey.findProgramAddressSync([Buffer.from("authority")], program.programId)[0];

const enumName = (v: any) => Object.keys(v)[0];
const backoff = new Map<string, number>();       // rule -> retry-after (ms)
const programCache = new Map<string, PublicKey>();
const decimalsCache = new Map<string, number>();

function log(msg: string) { console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`); }

async function tokenProgram(mint: PublicKey) {
  const k = mint.toBase58();
  if (!programCache.has(k)) {
    const info = await connection.getAccountInfo(mint);
    if (!info) throw new Error(`mint ${k.slice(0, 6)} not found`);
    programCache.set(k, info.owner);
  }
  return programCache.get(k)!;
}

async function decimals(mint: PublicKey, prog: PublicKey) {
  const k = mint.toBase58();
  if (!decimalsCache.has(k)) decimalsCache.set(k, (await getMint(connection, mint, "confirmed", prog)).decimals);
  return decimalsCache.get(k)!;
}

// Same rule as the program: displayed units per raw unit, from the mint.
const multCache = new Map<string, { m: number; at: number }>();
async function uiMultiplier(mint: PublicKey): Promise<number> {
  const k = mint.toBase58();
  const hit = multCache.get(k);
  if (hit && Date.now() - hit.at < 10 * 60_000) return hit.m;
  const info: any = (await connection.getParsedAccountInfo(mint)).value?.data;
  const s = (info?.parsed?.info?.extensions ?? []).find((e: any) => e.extension === "scaledUiAmountConfig")?.state;
  let m = 1;
  if (s) m = Number(Date.now() / 1000 >= s.newMultiplierEffectiveTimestamp ? s.newMultiplier : s.multiplier) || 1;
  multCache.set(k, { m, at: Date.now() });
  return m;
}

// Mirrors the program's maths exactly, so the keeper swaps what it pulls.
function sizing(rule: any, price: number, inDec: number, outDec: number, mIn = 1, mOut = 1) {
  const spend = Math.min(Number(rule.amount), Number(rule.maxExecution));
  const usd = spend / 1_000_000;
  const keep = 1 - rule.maxSlippageBps / 10_000;
  const down = enumName(rule.direction) === "down";
  const trigger = down
    ? rule.entryPrice * (1 - rule.thresholdPct / 100)
    : rule.entryPrice * (1 + rule.thresholdPct / 100);
  const hit = down ? price <= trigger : price >= trigger;

  if (enumName(rule.action) === "buy") {
    return { hit, trigger, usd, amountIn: BigInt(spend),
             minOut: Math.trunc((usd / price) * keep / mOut * 10 ** outDec) };
  }
  const shares = usd / trigger;
  return { hit, trigger, usd, amountIn: BigInt(Math.trunc(shares / mIn * 10 ** inDec)),
           minOut: Math.trunc(shares * price * keep / mOut * 10 ** outDec) };
}

const toIx = (i: any) => new TransactionInstruction({
  programId: new PublicKey(i.programId),
  keys: i.accounts.map((a: any) => ({ pubkey: new PublicKey(a.pubkey), isSigner: a.isSigner, isWritable: a.isWritable })),
  data: Buffer.from(i.data, "base64"),
});

// Jupiter swap from the keeper's input account, delivering straight to the
// user's output account. maxAccounts keeps the route small enough to share a
// transaction with execute and settle.
async function jupiterSwap(inputMint: PublicKey, outputMint: PublicKey, amount: bigint,
                           slippageBps: number, userOutput: PublicKey, maxAccounts: number) {
  const q = await fetch(
    `${JUP}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}` +
    `&slippageBps=${slippageBps}&maxAccounts=${maxAccounts}`, { headers: UA });
  if (!q.ok) throw new Error(`no route (${q.status})`);
  const quote = await q.json();

  const s = await fetch(`${JUP}/swap-instructions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...UA },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: keeper.publicKey.toBase58(),
      destinationTokenAccount: userOutput.toBase58(),
      wrapAndUnwrapSol: false,
    }),
  });
  if (!s.ok) throw new Error(`swap build failed (${s.status})`);
  const r = await s.json();

  const alts = (await Promise.all((r.addressLookupTableAddresses ?? []).map(async (a: string) =>
    (await connection.getAddressLookupTable(new PublicKey(a))).value)))
    .filter(Boolean) as AddressLookupTableAccount[];

  return {
    setup: (r.setupInstructions ?? []).map(toIx),
    swap: [toIx(r.swapInstruction), ...(r.cleanupInstruction ? [toIx(r.cleanupInstruction)] : [])],
    alts,
  };
}

async function execute(pubkey: PublicKey, rule: any, price: number) {
  const inputMint: PublicKey = rule.inputMint;
  const outputMint: PublicKey = rule.outputMint;
  const [inProg, outProg] = await Promise.all([tokenProgram(inputMint), tokenProgram(outputMint)]);
  const [inDec, outDec] = await Promise.all([decimals(inputMint, inProg), decimals(outputMint, outProg)]);
  const [mIn, mOut] = await Promise.all([uiMultiplier(inputMint), uiMultiplier(outputMint)]);
  const { amountIn, minOut } = sizing(rule, price, inDec, outDec, mIn, mOut);

  const userInput = getAssociatedTokenAddressSync(inputMint, rule.owner, false, inProg);
  const userOutput = getAssociatedTokenAddressSync(outputMint, rule.owner, false, outProg);
  const keeperInput = getAssociatedTokenAddressSync(inputMint, keeper.publicKey, false, inProg);
  const keeperOutput = getAssociatedTokenAddressSync(outputMint, keeper.publicKey, false, outProg);

  // Free pre-check: skip rather than pay for a transaction that must fail.
  try {
    const acc = await getAccount(connection, userInput, "confirmed", inProg);
    if (!acc.delegate?.equals(authority) || acc.delegatedAmount < amountIn)
      throw new Error("approval too small or revoked");
    if (acc.amount < amountIn) throw new Error("user balance too low");
  } catch (e: any) {
    throw new Error(`precheck: ${e.message ?? "no input account"}`);
  }

  const openAccounts = [
    createAssociatedTokenAccountIdempotentInstruction(keeper.publicKey, keeperInput, keeper.publicKey, inputMint, inProg),
    createAssociatedTokenAccountIdempotentInstruction(keeper.publicKey, userOutput, rule.owner, outputMint, outProg),
  ];

  const executeIx = await program.methods.execute(price).accountsPartial({
    rule: pubkey, authority, inputMint, outputMint,
    userInput, keeperInput, userOutput,
    keeper: keeper.publicKey,
    inputTokenProgram: inProg, outputTokenProgram: outProg,
    instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
  }).instruction();

  const settleIx = await program.methods.settle().accountsPartial({
    rule: pubkey, outputMint, userOutput, outputTokenProgram: outProg,
  }).instruction();

  const budget = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 900_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50_000 }),
  ];

  const build = async (maxAccounts: number) => {
    let setup: TransactionInstruction[] = [], swap: TransactionInstruction[], alts: AddressLookupTableAccount[] = [];

    if (EXECUTOR === "jupiter") {
      // One raw unit less than pulled, so float rounding can never make the
      // swap ask for more than the program actually moved.
      const swapAmount = enumName(rule.action) === "buy" ? amountIn : amountIn - BigInt(1);
      ({ setup, swap, alts } = await jupiterSwap(inputMint, outputMint, swapAmount,
                                                 rule.maxSlippageBps, userOutput, maxAccounts));
    } else {
      // Devnet: no Jupiter. The keeper hands over output from its own supply
      // at the live price — the same account flow as a real swap.
      const fair = enumName(rule.action) === "buy"
        ? Math.trunc((Number(amountIn) / 1e6 / price) / mOut * 10 ** outDec)
        : Math.trunc((Number(amountIn) / 10 ** inDec) * mIn * price / mOut * 10 ** outDec);
      swap = [createTransferCheckedInstruction(keeperOutput, outputMint, userOutput,
        keeper.publicKey, BigInt(fair), outDec, [], outProg)];
    }

    const { blockhash } = await connection.getLatestBlockhash();
    const msg = new TransactionMessage({
      payerKey: keeper.publicKey,
      recentBlockhash: blockhash,
      instructions: [...budget, ...openAccounts, ...setup, executeIx, ...swap, settleIx],
    }).compileToV0Message(alts);
    const tx = new VersionedTransaction(msg);
    tx.sign([keeper]);
    tx.serialize(); // throws here if the transaction is too large
    return tx;
  };

  let tx: VersionedTransaction;
  try { tx = await build(32); }
  catch (e: any) {
    if (EXECUTOR !== "jupiter") throw e;
    log(`  route too large (${e.message?.slice(0, 40)}), retrying smaller`);
    tx = await build(20);
  }

  const sig = await connection.sendRawTransaction(tx.serialize(), { maxRetries: 3 });
  await connection.confirmTransaction(sig, "confirmed");
  return { sig, minOut };
}

async function tick() {
  const all = await program.account.rule.all();
  const now = Date.now();
  const watching = all.filter((r: any) =>
    enumName(r.account.status) === "watching" && Number(r.account.expiryUnix) * 1000 > now);

  if (!watching.length) { log(`no watching rules (${all.length} total)`); return; }

  const prices = await fetchPrices(watching.map((r: any) => r.account.asset));
  let executed = 0;

  for (const r of watching) {
    const key = r.publicKey.toBase58();
    const price = prices.get(r.account.asset);
    if (!price || (backoff.get(key) ?? 0) > now) continue;

    const { hit } = sizing(r.account, price, 6, 6);
    if (!hit) continue;

    try {
      const { sig } = await execute(r.publicKey, r.account, price);
      executed++;
      const cluster = CONFIG.rpcUrl.includes("devnet") ? "?cluster=devnet" : "";
      log(`EXECUTED ${r.account.asset} @ $${price.toFixed(2)} · ${key.slice(0, 8)}`);
      log(`  https://explorer.solana.com/tx/${sig}${cluster}`);
    } catch (e: any) {
      const logs: string[] = e.logs ?? e.transactionLogs ?? [];
      const why = logs.find((l) => l.includes("Error Message"))?.split("Error Message:")[1]?.trim()
        ?? e.message?.slice(0, 100);
      // Wait longer for things only the user can fix.
      const wait = String(why).startsWith("precheck") ? 5 * 60_000 : 60_000;
      backoff.set(key, now + wait);
      log(`skip ${r.account.asset} ${key.slice(0, 8)}: ${why}`);
    }
  }

  log(`${watching.length} watching · ${prices.size} priced · ${executed} executed`);
}

async function main() {
  log(`keeper up · ${keeper.publicKey.toBase58().slice(0, 8)} · ${EXECUTOR} · every ${CONFIG.pollSeconds}s`);
  log(`program ${program.programId.toBase58().slice(0, 8)} · rpc ${CONFIG.rpcUrl.replace(/api-key=.*/, "api-key=***")}`);
  while (true) {
    try { await tick(); } catch (e: any) { log(`tick failed: ${e.message?.slice(0, 100)}`); }
    await new Promise((r) => setTimeout(r, CONFIG.pollSeconds * 1000));
  }
}

main();
