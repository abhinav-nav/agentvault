# AgentVault — Colosseum Frontier Hackathon Submission

## One-liner
Treasury & budget protocol for autonomous AI agents on Solana — give agents a USDC budget, set spending limits, get on-chain receipts.

## Problem
AI agents are going autonomous — browsing, coding, trading, paying for APIs. But there's no on-chain way to give an agent a budget with spending limits and get verifiable receipts.

- Pay.sh / x402 handles agent-to-API payments — but no budget limits, no treasury, no audit trail
- Solana Agent Kit gives agents 60+ actions — but no spending controls, no multi-agent budget
- ElizaOS is a great agent framework — but agents hold their own wallets with no org-level oversight

**Who controls how much an agent can spend? Who audits where the money went? Who can kill a rogue agent's access?**

## Solution
AgentVault is the missing budget control layer between AI agents and their money:

1. **Agent Treasury** — USDC vault on Solana, fund it once, agents draw from it
2. **Per-Agent Budgets** — set max spend per task for each agent
3. **Kill Switch** — instantly revoke any agent's access to funds
4. **On-Chain Receipts** — every payment is a verifiable PDA
5. **Real Connectors** — plug in ElizaOS, Solana Agent Kit, x402/Pay.sh, LangChain, or build your own
6. **SDK + CLI** — manage everything from terminal or code

## What We Built

### On-Chain (Anchor/Rust)
- 8 instructions: create_team, add_member, fund_vault, create_milestone, submit_deliverable, approve_and_pay, direct_pay, deactivate_member
- 4 PDA account types: Team, Member, Milestone, PaymentRecord
- Deployed on Solana Devnet: `8g5hMx6AwTUFCrKwuaCfDY468qE4bbHiw8BvdiepUJdo`
- 10 passing integration tests

### SDK (TypeScript)
- `AgentVault` class with real Anchor integration
- 6 connector classes with beforePay/afterPay lifecycle hooks:
  - `ElizaOSConnector` — 3 actions (CHECK_BUDGET, VAULT_PAY, GET_RECEIPTS) + plugin format
  - `LangChainConnector` — real tool with execute() for LangChain/Vercel AI SDK agents
  - `X402Connector` — budget-controlled API payments with payAndFetch()
  - `SolanaAgentKitConnector` — agentVaultPay() + checkVaultBudget() actions
  - `WebhookConnector` — POSTs JSON to your URL on every payment
  - `CustomConnector` — build your own with arbitrary beforePay/afterPay hooks

### CLI
- 12 commands: init, create-vault, register, fund, pay, kill, status, receipts, connector:add/config/list/remove

### Frontend (Next.js)
- Interactive demo dashboard with all features working
- Custom connector builder with live SDK code generation
- Real devnet transaction links on landing page

## Live Devnet Proof
Every transaction is verifiable on Solana Explorer:
- Vault Created: 4moZJ3iiiBE6h12wXSBq...
- Agent Registered: 51BVd89Rx2RJ5bh7...
- Vault Funded ($10,000 USDC): 447VF1BLWu6Twb2z...
- Agent Payment ($15 USDC): 4XbQWg7oVTjqtkRL...
- Kill Switch: 2cX9ZtuvD23P8CUJ...
- On-Chain Receipt PDA: DEBc2T36NypqQ1TU817FVSdG7wmJowXhqGBwFJWdQt7V

## Tech Stack
| Layer | Tech |
|---|---|
| Smart Contract | Anchor 0.31.1 (Rust) on Solana |
| SDK | TypeScript, @coral-xyz/anchor |
| CLI | Commander.js, Chalk |
| Frontend | Next.js 16, Tailwind CSS |
| Wallet | Phantom (browser), Keypair (CLI) |
| Token | USDC (SPL Token) |

## Why This Wins
1. **Real infrastructure gap** — x402, ElizaOS, SAK all lack budget control
2. **Everything works** — deployed program, passing tests, real devnet transactions
3. **Developer-first** — SDK + CLI + connectors, not just a dashboard
4. **Composable** — plug into any AI agent framework via connectors
5. **On-chain verifiable** — every payment has a PDA receipt on Solana
