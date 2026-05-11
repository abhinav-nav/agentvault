# AgentVault

**Treasury & budget protocol for autonomous AI agents on Solana.**

AI agents are going autonomous — browsing, coding, trading, paying for APIs. But there's no on-chain way to give an agent a budget with spending limits and get verifiable receipts.

AgentVault is the missing layer between your AI agents and their money.

## The Problem

- **Pay.sh / x402** handles agent-to-API payments — but no budget limits, no treasury, no audit trail
- **Solana Agent Kit** gives agents 60+ actions — but no spending controls, no multi-agent budget
- **ElizaOS** is a great agent framework — but agents hold their own wallets with no org-level oversight

**Who controls how much an agent can spend? Who audits where the money went? Who can kill a rogue agent's access?**

## The Solution

AgentVault gives you:

- **Agent Treasury** — USDC vault on Solana, fund it once, agents draw from it
- **Per-Agent Budgets** — set max spend per task for each agent
- **Kill Switch** — instantly revoke any agent's access to funds
- **On-Chain Receipts** — every payment is a verifiable PDA (Program Derived Address)
- **Connector System** — plug in ElizaOS, Solana Agent Kit, x402/Pay.sh, LangChain, or build your own
- **CLI + SDK** — manage everything from terminal or code

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  AgentVault                      │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ ElizaOS  │  │ Solana   │  │  x402 /  │ ...  │
│  │ Plugin   │  │Agent Kit │  │  Pay.sh  │      │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘      │
│       │              │              │             │
│  ┌────▼──────────────▼──────────────▼──────┐    │
│  │         Connector Registry               │    │
│  │    (built-in + custom connectors)        │    │
│  └────────────────┬─────────────────────────┘    │
│                   │                              │
│  ┌────────────────▼─────────────────────────┐    │
│  │         AgentVault SDK / CLI             │    │
│  │  createVault · registerAgent · pay       │    │
│  │  killAgent · getReceipts · fundVault     │    │
│  └────────────────┬─────────────────────────┘    │
│                   │                              │
│  ┌────────────────▼─────────────────────────┐    │
│  │      Anchor Program (Solana Devnet)      │    │
│  │                                          │    │
│  │  Team PDA ──── Vault PDA (USDC)          │    │
│  │     │                                    │    │
│  │  Member PDAs (agents w/ budgets)         │    │
│  │     │                                    │    │
│  │  Milestone PDAs ── PaymentRecord PDAs    │    │
│  └──────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

## Quick Start

### CLI

```bash
npm install -g @agentvault/sdk

# Initialize project
agentvault init --name "My AI Swarm"

# Deploy vault on-chain
agentvault create-vault

# Register agents with per-task budgets
agentvault register -a <AGENT_PUBKEY> -r "Research Agent" -l 25
agentvault register -a <AGENT_PUBKEY> -r "Code Gen Agent" -l 50

# Fund vault with USDC
agentvault fund -a 10000

# Add connectors
agentvault connector:add -i elizaos -c '{"agentId":"my-agent","maxPerTask":50}'
agentvault connector:add -i x402 -c '{"dailyCap":100}'
agentvault connector:add -i custom-bot -n "Trading Bot" -t custom -c '{"strategy":"conservative"}'

# Pay an agent
agentvault pay -a <AGENT_PUBKEY> -u 25 -m "GPT-4 API batch #47"

# Monitor
agentvault status
agentvault receipts

# Emergency: kill rogue agent
agentvault kill -a <AGENT_PUBKEY>
```

### SDK

```typescript
import { AgentVault, registerBuiltins } from "@agentvault/sdk";

const vault = new AgentVault({
  rpc: "https://api.devnet.solana.com",
  wallet: "./keypair.json",
});

// Check agent budget
const budget = await vault.getAgentBudget(agentPubkey);
console.log(budget.remaining); // $450.00 USDC

// Pay an agent
const receipt = await vault.pay(agentPubkey, 25_000_000, "API batch");
console.log(receipt.txSignature);

// Connector system
registerBuiltins(vault.connectors);
vault.connectors.enable("elizaos", { agentId: "prod", maxPerTask: 50 });
vault.connectors.enable("x402", { dailyCap: 100 });
```

## Tech Stack

| Layer | Tech |
|---|---|
| Smart Contract | Anchor 0.31.1 (Rust) on Solana |
| SDK | TypeScript, @coral-xyz/anchor |
| CLI | Commander.js, Chalk |
| Frontend | Next.js 16, Tailwind CSS |
| Wallet | Phantom (browser), Keypair (CLI) |
| Token | USDC (SPL Token) |

## Program

- **Program ID**: `8g5hMx6AwTUFCrKwuaCfDY468qE4bbHiw8BvdiepUJdo`
- **Network**: Solana Devnet
- **Instructions**: `create_team`, `add_member`, `fund_vault`, `create_milestone`, `submit_deliverable`, `approve_and_pay`, `direct_pay`, `deactivate_member`
- **Accounts**: Team, Member, Milestone, PaymentRecord (all PDAs)

## Project Structure

```
creatorpay/
├── programs/creatorpay/src/lib.rs   # Anchor program (Rust)
├── tests/creatorpay.ts              # 10 integration tests
├── packages/agentvault/             # SDK + CLI (TypeScript)
│   ├── src/vault.ts                 # AgentVault class
│   ├── src/connectors.ts            # Connector registry
│   ├── src/pda.ts                   # PDA helpers
│   ├── src/types.ts                 # Type definitions
│   └── bin/cli.js                   # CLI tool
├── app/frontend/                    # Next.js dashboard
│   ├── app/page.tsx                 # Landing + demo
│   ├── app/components/              # Dashboard components
│   └── lib/                         # Anchor client, mock data
└── deployer.json                    # Deploy keypair
```

## Connectors (Real, Not Stubs)

Every connector is a real class with lifecycle hooks (`beforePay` → on-chain → `afterPay`). Any connector can block a payment.

| Built-in | Type | What it does |
|---|---|---|
| `ElizaOSConnector` | ai-framework | 3 actions: CHECK_BUDGET, VAULT_PAY, GET_RECEIPTS. Exports as ElizaOS plugin. |
| `SolanaAgentKitConnector` | ai-framework | agentVaultPay() + checkVaultBudget() actions for SAK agents |
| `X402Connector` | payment-rail | Budget-controlled API payments. Per-request max + daily cap enforcement. payAndFetch() wraps HTTP+pay |
| `LangChainConnector` | ai-framework | Real tool with execute() for LangChain agents. Also exports Vercel AI SDK format. |
| `WebhookConnector` | monitoring | POSTs JSON to your URL on every payment. Supports signing secrets + min amount filter |
| `CustomConnector` | custom | Build your own with beforePay/afterPay hooks |

```typescript
import { AgentVault, X402Connector, WebhookConnector, CustomConnector } from "@agentvault/sdk";

const vault = new AgentVault({ rpc: "https://api.devnet.solana.com", wallet: "./deployer.json" });

// Budget-controlled API payments
vault.connectors.use(new X402Connector({ perRequestMax: 25, dailyCap: 100 }));

// Real-time webhook notifications
vault.connectors.use(new WebhookConnector({ webhookUrl: "https://your-server.com/payments" }));

// Custom budget logic
vault.connectors.use(new CustomConnector("my-limiter", "Trade Limiter", {
  beforePay: async (agent, amount, memo) => {
    if (amount > 100_000_000) return { allow: false, reason: "Max $100" };
    return { allow: true };
  },
}));

// All connectors run automatically on every payment
const receipt = await vault.pay(agentWallet, 25_000_000, "GPT-4o API batch");
```

## Built for Colosseum Frontier Hackathon 2026

AgentVault fills the gap in Solana's AI agent infrastructure — the budget control and audit layer that sits between autonomous agents and their treasury.

## License

MIT
