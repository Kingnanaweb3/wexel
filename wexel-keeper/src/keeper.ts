import * as anchor from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";
import idl from "../idl/wexel_program.json";
import { CONFIG, loadKeypair } from "./config";
import { fetchPrices } from "./prices";

const connection = new Connection(CONFIG.rpcUrl, "confirmed");
const wallet = new anchor.Wallet(loadKeypair());
const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
const program = new anchor.Program(idl as anchor.Idl, provider);

const enumName = (v: any) => Object.keys(v)[0];

// Would this rule fire at this price? Same maths as the on-chain check.
function shouldFire(rule: any, price: number): boolean {
  const change = ((price - rule.entryPrice) / rule.entryPrice) * 100;
  return enumName(rule.direction) === "down"
    ? change <= -rule.thresholdPct
    : change >= rule.thresholdPct;
}

async function tick() {
  const all = await (program.account as any).rule.all();
  const now = Date.now() / 1000;

  const watching = all.filter((r: any) =>
    enumName(r.account.status) === "watching" &&
    Number(r.account.expiryUnix) > now
  );

  if (!watching.length) {
    log(`no watching rules (${all.length} total)`);
    return;
  }

  const prices = await fetchPrices(watching.map((r: any) => r.account.asset));
  let fired = 0;

  for (const r of watching) {
    const rule = r.account;
    const price = prices.get(rule.asset);
    if (!price) continue;

    if (!shouldFire(rule, price)) continue;

    // The program re-checks everything: expiry, status, price range, and
    // the trigger maths. The keeper can only ask, never force.
    try {
      const sig = await program.methods
        .executeRule(price)
        .accounts({ rule: r.publicKey })
        .rpc();
      fired++;
      log(`FIRED ${rule.asset} at $${price.toFixed(2)} · ${r.publicKey.toBase58().slice(0, 8)} · ${sig.slice(0, 10)}`);
    } catch (e: any) {
      log(`skip ${rule.asset}: ${e.message?.slice(0, 80)}`);
    }
  }

  log(`${watching.length} watching · ${prices.size} priced · ${fired} fired`);
}

function log(msg: string) {
  console.log(`[${new Date().toISOString().slice(11, 19)}] ${msg}`);
}

async function main() {
  log(`keeper up · ${wallet.publicKey.toBase58().slice(0, 8)} · every ${CONFIG.pollSeconds}s`);
  log(`rpc ${CONFIG.rpcUrl.replace(/api-key=.*/, "api-key=***")}`);

  while (true) {
    try {
      await tick();
    } catch (e: any) {
      // A bad tick is logged, never fatal — the loop must keep running.
      log(`tick failed: ${e.message?.slice(0, 100)}`);
    }
    await new Promise(r => setTimeout(r, CONFIG.pollSeconds * 1000));
  }
}

main();
