// Creates a "buy the dip" rule whose entry price is set 10% ABOVE the real
// price, so a 5% drop has already happened. The price the keeper reports is
// still the real live price — nothing is faked. It just means we don't have
// to wait days for AAPL to actually fall 5% to see the loop work.
import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, SystemProgram } from "@solana/web3.js";
import idl from "../idl/wexel_program.json";
import { CONFIG, loadKeypair } from "./config";
import { fetchPrices } from "./prices";

async function main() {
  const ticker = process.argv[2] || "AAPL";
  const connection = new Connection(CONFIG.rpcUrl, "confirmed");
  const wallet = new anchor.Wallet(loadKeypair());
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  const program = new anchor.Program(idl as anchor.Idl, provider);

  const price = (await fetchPrices([ticker])).get(ticker);
  if (!price) throw new Error(`no live price for ${ticker}`);

  const entry = price * 1.10;
  const rule = Keypair.generate();
  const raw = new anchor.BN(10 * 1e6);
  const expiry = new anchor.BN(Math.floor(Date.now() / 1000) + 86400);

  await program.methods
    .createRule(ticker, { down: {} }, 5, entry, { buy: {} }, raw, raw, 100, expiry)
    .accounts({ rule: rule.publicKey, owner: wallet.publicKey, systemProgram: SystemProgram.programId })
    .signers([rule])
    .rpc();

  console.log(`created test rule ${rule.publicKey.toBase58()}`);
  console.log(`  ${ticker} live $${price.toFixed(2)} · entry set at $${entry.toFixed(2)}`);
  console.log(`  already −9.1% below entry, so the keeper should fire it on its next tick`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
