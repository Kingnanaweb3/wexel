# Wexel

**Automated stock rules for your wallet — without giving a bot unlimited access to your money.**

Built for **Stocklana** (Solana Foundation), September 2026.

## What it does

- **Buy tokenized stocks** (xStocks — AAPLx, NVDAx, …) with SOL, USDC or any liquid token, routed through Jupiter.
- **Set a rule once** — *buy the dip*, *take profit*, *stop loss*. It executes on its own, including outside US market hours.
- **Your funds stay in your wallet** until the moment a rule trades. You approve the program to spend up to a cap; nothing is escrowed.
- **Pre-IPO (PreStocks)** — buy and hold OpenAI, SpaceX, Anthropic and others, with the premium or discount to the issuer's valuation shown. Rules are deliberately disabled here: single trades move these prices.
- **Wallet** — portfolio breakdown, send, receive.

## How execution stays bounded

A rule executes in **one atomic transaction**: `execute` → swap → `settle`.

- The user approves the **program's own address** — never the keeper's wallet — to spend up to a cap.
- `execute` refuses to run unless `settle` appears later in the same transaction.
- `settle` checks the user received at least the minimum. If not, **the whole transaction reverts**.
- Only the Wexel keeper can execute rules.

| Rule | Guarantee enforced by the contract |
|---|---|
| Buy the dip | Never pays more than the trigger price, plus slippage |
| Take profit | Never sells for less than the trigger price, minus slippage |
| Stop loss | Sells the correct number of shares; timing relies on the keeper's price (oracle verification on the roadmap) |

For buys and take-profits, the swap output itself proves the price: a faked trigger cannot deliver the required minimum, so it reverts.

## Proven on devnet

Using test tokens and the live AAPL price:

| Test | Result |
|---|---|
| Keeper delivers a fair amount | **Executed** — 10 tUSDC → 0.0299 tAAPLx |
| Keeper delivers half | **Reverted** by `settle` (InsufficientOutput) — balances unchanged |
| Keeper omits `settle` | **Refused** by `execute` (SettleMissing) — balances unchanged |

## Repository

| Folder | What |
|---|---|
| `wexel-app/` | Next.js mobile-first app (PWA) |
| `wexel_program/` | Anchor program (Rust) |
| `wexel-keeper/` | Off-chain keeper + devnet test harness |
| `wexel-core/` | Rule-evaluation logic with unit tests |

**Devnet program IDs**
- v3, delegated execution: `4RuFJCqBiGmWee9WTtD91dbGQQiCUjoSkkkqXBvi3Yda`
- v2, used by the current web app: `8kUZWkfcVpwv55LrjrnSAm5q67zV2dnn3xGqJrfqEnz5`

## Run locally

```bash
# program
cd wexel_program && anchor build

# app
cd wexel-app && cp .env.example .env.local   # add your RPC URL
npm install && npm run dev

# keeper tests (devnet)
cd wexel-keeper && cp .env.example .env
npm install && npm run devnet-setup && npm run devnet-run ok
```

## Status and limitations

- The mainnet swap path (Jupiter inside the atomic transaction) is being wired now; devnet proves every check around it.
- Stop-loss relies on the keeper's reported price.
- Tokenized stocks are available to non-US persons only. PreStocks give economic exposure, not ownership or voting rights.
- See [SECURITY.md](SECURITY.md) for the dependency audit and trust model.

## Roadmap

- On-chain price verification (oracle) so stop-loss is fully trust-minimised
- Paired take-profit + stop-loss, where one cancels the other
- Fiat on-ramp through a licensed partner
