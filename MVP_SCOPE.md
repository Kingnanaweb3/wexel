# MVP Scope — Wexel

## Cut down to this (nothing else):

**Condition:** Percentage change only (price up X% or down X%)
- Drop: price above/below absolute, time-based triggers

**Actions:** Buy tokenized stock, Swap to USDC
- Drop: Sell %, Transfer, Rebalance

**Guardrails (keep 2, drop the rest):**
- Max execution amount (per trigger)
- Expiry date
- Drop: max executions/day, slippage cap, allowed-assets list (mention as roadmap in pitch, don't build)

**No dev API. No multi-rule dashboard polish beyond 2 demo rules.**

## Day-by-day
Day 1 — Rule data model + evaluation logic + tests (Rust, no chain yet)
Day 2 — On-chain program (Anchor): vault + execute()
Day 3 — Trigger wiring (keeper/watcher) + minimal frontend
Day 4 — Polish, demo video, submission

Note: simulated price movement for the demo trigger is fine — disclose it in the submission.
