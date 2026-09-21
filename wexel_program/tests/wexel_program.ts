import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { WexelProgram } from "../target/types/wexel_program";
import { assert } from "chai";

describe("wexel_program", () => {
  // Connect to whatever cluster Anchor.toml points at, using your local wallet
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.WexelProgram as Program<WexelProgram>;

  it("creates a rule and stores it on-chain", async () => {
    // A fresh keypair to hold the new Rule account
    const rule = anchor.web3.Keypair.generate();

    // Expiry far in the future so the rule stays active
    const expiry = new anchor.BN(9_999_999_999);

    await program.methods
      .createRule(
        "NVDA",                    // asset symbol
        { down: {} },              // Direction::Down
        5.0,                       // trigger at 5% move
        150.0,                     // entry price
        { buy: {} },               // Action::Buy
        new anchor.BN(100),        // amount
        new anchor.BN(100),        // max_execution guardrail
        expiry
      )
      .accounts({
        rule: rule.publicKey,
        owner: provider.wallet.publicKey,
      })
      .signers([rule])             // new account must sign its own creation
      .rpc();

    // Read the account back off-chain and verify it stored what we sent
    const stored = await program.account.rule.fetch(rule.publicKey);

    assert.equal(stored.asset, "NVDA");
    assert.equal(stored.maxExecution.toNumber(), 100);
    assert.equal(
      stored.owner.toBase58(),
      provider.wallet.publicKey.toBase58()
    );
  });
});
