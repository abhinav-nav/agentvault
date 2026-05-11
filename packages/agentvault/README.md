# AgentVault SDK

Treasury & budget protocol for autonomous AI agents on Solana.

Give your AI agents a USDC budget, set per-task spending limits, and get on-chain receipts for every transaction. Real connectors for ElizaOS, LangChain, Solana Agent Kit, x402/Pay.sh, and custom agents.

## Install

```bash
npm install @agentvault/sdk @coral-xyz/anchor @solana/web3.js
```

## Quick Start

```typescript
import { AgentVault, X402Connector, WebhookConnector } from "@agentvault/sdk";

const vault = new AgentVault({
  rpc: "https://api.devnet.solana.com",
  wallet: "./deployer.json",
});

// Add real connectors with budget enforcement
vault.connectors.use(new X402Connector({ perRequestMax: 25, dailyCap: 100 }));
vault.connectors.use(new WebhookConnector({ webhookUrl: "https://your-server.com/payments" }));

// Pay an agent — connectors enforce limits + fire webhooks automatically
const receipt = await vault.pay(agentPubkey, 25_000_000, "GPT-4o API batch");
console.log(receipt.txSignature);
```

## Connectors

Every connector is a real class with lifecycle hooks (`beforePay`, `afterPay`) that run on every payment. Connectors can block payments, enforce budgets, fire webhooks, and more.

### x402 / Pay.sh — Budget-Controlled API Payments

```typescript
import { X402Connector } from "@agentvault/sdk";

const x402 = new X402Connector({
  perRequestMax: 25,   // max $25 per API call
  dailyCap: 100,       // max $100/day per agent
});
vault.connectors.use(x402);

// Agent makes a budget-controlled API call
const { receipt, response } = await x402.payAndFetch(
  agentWallet,
  "https://api.openai.com/v1/chat/completions",
  0.05,
  "GPT-4o — 12K tokens"
);
```

### LangChain / Vercel AI SDK

```typescript
import { LangChainConnector } from "@agentvault/sdk";

const langchain = new LangChainConnector({ maxPerCall: 25 });
vault.connectors.use(langchain);

// Get a tool your LangChain agent can call
const tool = langchain.asTool(agentWallet);
// tool.name = "agentvault_pay"
// tool.execute({ amount: 5, memo: "API call" })

// Or for Vercel AI SDK
const vercelTool = langchain.asVercelTool(agentWallet);
```

### ElizaOS Plugin

```typescript
import { ElizaOSConnector } from "@agentvault/sdk";

const eliza = new ElizaOSConnector({ maxPerTask: 50 });
vault.connectors.use(eliza);

// Get actions for your Eliza agent
const actions = eliza.getActions(agentWallet);
// actions.CHECK_BUDGET — query remaining budget
// actions.VAULT_PAY    — make a payment
// actions.GET_RECEIPTS — list recent payments

// Or register as a full plugin
const plugin = eliza.asPlugin(agentWallet);
// plugin.name = "agentvault", plugin.actions = [...]
```

### Solana Agent Kit

```typescript
import { SolanaAgentKitConnector } from "@agentvault/sdk";

const sak = new SolanaAgentKitConnector({ budgetLimit: 500 });
vault.connectors.use(sak);

// Get actions to register with your SAK agent
const payAction = sak.getAction(agentWallet);
// payAction.name = "agentVaultPay"
// payAction.execute({ amount: 15, memo: "Jupiter swap" })

const budgetAction = sak.getCheckBudgetAction(agentWallet);
// budgetAction.name = "checkVaultBudget"
```

### Webhook Monitor

```typescript
import { WebhookConnector } from "@agentvault/sdk";

const webhook = new WebhookConnector({
  webhookUrl: "https://your-server.com/payments",
  minAmount: 10,        // only notify for payments > $10
  secret: "signing-key", // X-AgentVault-Signature header
});
vault.connectors.use(webhook);
// Now every vault.pay() automatically POSTs to your webhook
```

### Custom Connector

```typescript
import { CustomConnector } from "@agentvault/sdk";

const limiter = new CustomConnector(
  "trading-limiter",
  "Trading Bot Limiter",
  {
    beforePay: async (agent, amount, memo) => {
      if (amount > 100_000_000) return { allow: false, reason: "Max $100 per trade" };
      if (memo.includes("leverage")) return { allow: false, reason: "No leveraged trades" };
      return { allow: true };
    },
    afterPay: async (receipt) => {
      await myAnalytics.track("trade", { amount: receipt.amount, memo: receipt.memo });
    },
  }
);
vault.connectors.use(limiter);
```

## How Connectors Work

```
Agent calls vault.pay(wallet, amount, memo)
        │
        ▼
┌─ connector.beforePay() ──────────────────┐
│  x402: check per-request + daily cap     │
│  custom: check trade limits              │  ← ANY connector can BLOCK
│  SAK: check daily budget                 │
└──────────────────────────────────────────┘
        │ all approved
        ▼
┌─ ON-CHAIN: directPay instruction ────────┐
│  USDC transfer from vault PDA            │
│  PaymentRecord PDA created               │
│  Member stats updated                    │
└──────────────────────────────────────────┘
        │ success
        ▼
┌─ connector.afterPay(receipt) ────────────┐
│  webhook: POST to your URL               │
│  custom: log to analytics                │
│  x402: update daily spend tracker        │
└──────────────────────────────────────────┘
```

## CLI

```bash
# Initialize project
agentvault init --name "My AI Swarm"

# Deploy vault on-chain
agentvault create-vault

# Register agents
agentvault register -a <AGENT_PUBKEY> -r "Research Agent" -l 25

# Fund vault
agentvault fund -a 1000

# Pay an agent
agentvault pay -a <AGENT_PUBKEY> -u 25 -m "GPT-4 API batch"

# Monitor
agentvault status
agentvault receipts

# Kill switch
agentvault kill -a <AGENT_PUBKEY>
```

## Vault Operations

```typescript
const vault = new AgentVault({ rpc: "https://api.devnet.solana.com", wallet: "./deployer.json" });

// Create vault
await vault.createVault("My AI Swarm");

// Register agent
await vault.registerAgent(agentPubkey, "Research Agent", 25_000_000);

// Fund vault
await vault.fundVault(1000_000_000); // 1000 USDC

// Check budget
const budget = await vault.getAgentBudget(agentPubkey);
// { role: "Research Agent", limit: 25000000, spent: 0, remaining: 1000000000, isActive: true }

// Pay agent (runs all connector hooks)
const receipt = await vault.pay(agentPubkey, 25_000_000, "API batch #47");

// Get receipts
const receipts = await vault.getReceipts();

// Kill switch
await vault.killAgent(agentPubkey);
```

## Program

- **Program ID**: `8g5hMx6AwTUFCrKwuaCfDY468qE4bbHiw8BvdiepUJdo`
- **Network**: Solana Devnet
- **Instructions**: create_team, add_member, fund_vault, create_milestone, submit_deliverable, approve_and_pay, direct_pay, deactivate_member

## License

MIT
