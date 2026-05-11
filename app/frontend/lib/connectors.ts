// AgentVault Connector SDK
// Every connector implements this interface — built-in or custom

export interface AgentVaultConnector {
  /** Unique ID (e.g. "elizaos", "langchain", "custom-mybot") */
  id: string;
  /** Display name */
  name: string;
  /** Short description */
  description: string;
  /** Icon emoji or URL */
  icon: string;
  /** Connector type */
  type: "ai-framework" | "payment-rail" | "monitoring" | "custom";
  /** Whether this connector is active */
  enabled: boolean;
  /** Configuration schema — what settings the user can set */
  configFields: ConnectorConfigField[];
  /** Current config values */
  config: Record<string, string | number | boolean>;
  /** Status */
  status: "connected" | "disconnected" | "error";
  /** Stats */
  stats: {
    totalCalls: number;
    totalSpent: number; // in USDC micro-units
    lastUsed: number | null; // timestamp
  };
}

export interface ConnectorConfigField {
  key: string;
  label: string;
  type: "text" | "number" | "boolean" | "select";
  placeholder?: string;
  options?: string[]; // for select type
  required?: boolean;
}

// ---- Built-in Connectors ----

export const BUILTIN_CONNECTORS: AgentVaultConnector[] = [
  {
    id: "elizaos",
    name: "ElizaOS",
    description: "Connect Eliza-powered AI agents to your vault. Agents can check budgets, submit deliverables, and receive payments.",
    icon: "🤖",
    type: "ai-framework",
    enabled: true,
    configFields: [
      { key: "agentId", label: "Agent Character ID", type: "text", placeholder: "e.g. eliza-main-agent", required: true },
      { key: "maxPerTask", label: "Max USDC per Task", type: "number", placeholder: "100" },
      { key: "autoApprove", label: "Auto-approve under limit", type: "boolean" },
    ],
    config: { agentId: "eliza-prod-agent", maxPerTask: 50, autoApprove: true },
    status: "connected",
    stats: { totalCalls: 847, totalSpent: 4_250_000_000, lastUsed: Date.now() - 120_000 },
  },
  {
    id: "solana-agent-kit",
    name: "Solana Agent Kit",
    description: "Adds agentVaultPay() action to the 60+ existing Solana Agent Kit actions. Compatible with any SAK-powered agent.",
    icon: "⚡",
    type: "ai-framework",
    enabled: true,
    configFields: [
      { key: "rpcUrl", label: "RPC Endpoint", type: "text", placeholder: "https://api.devnet.solana.com" },
      { key: "budgetLimit", label: "Daily Budget (USDC)", type: "number", placeholder: "500" },
    ],
    config: { rpcUrl: "https://api.devnet.solana.com", budgetLimit: 500 },
    status: "connected",
    stats: { totalCalls: 1_203, totalSpent: 8_120_000_000, lastUsed: Date.now() - 300_000 },
  },
  {
    id: "x402-paysh",
    name: "x402 / Pay.sh",
    description: "Wrap Pay.sh API payments with vault budget caps. Agents pay for APIs from your treasury with spending limits.",
    icon: "💳",
    type: "payment-rail",
    enabled: true,
    configFields: [
      { key: "gatewayUrl", label: "Pay.sh Gateway URL", type: "text", placeholder: "https://pay.sh/api" },
      { key: "perRequestMax", label: "Max per Request (USDC)", type: "number", placeholder: "1" },
      { key: "dailyCap", label: "Daily Cap (USDC)", type: "number", placeholder: "100" },
    ],
    config: { gatewayUrl: "https://pay.sh/api", perRequestMax: 0.50, dailyCap: 100 },
    status: "connected",
    stats: { totalCalls: 15_420, totalSpent: 3_850_000_000, lastUsed: Date.now() - 60_000 },
  },
  {
    id: "langchain",
    name: "LangChain / Vercel AI SDK",
    description: "Tool integration for LangChain agents and Vercel AI SDK. Add vault budget awareness to any chain or agent.",
    icon: "🦜",
    type: "ai-framework",
    enabled: false,
    configFields: [
      { key: "toolName", label: "Tool Name", type: "text", placeholder: "agentvault_pay" },
      { key: "webhookUrl", label: "Webhook URL", type: "text", placeholder: "https://your-app.com/webhook" },
    ],
    config: {},
    status: "disconnected",
    stats: { totalCalls: 0, totalSpent: 0, lastUsed: null },
  },
  {
    id: "webhook-monitor",
    name: "Webhook Monitor",
    description: "Get real-time notifications for every agent payment. POST to any URL on spend events.",
    icon: "🔔",
    type: "monitoring",
    enabled: true,
    configFields: [
      { key: "webhookUrl", label: "Webhook URL", type: "text", placeholder: "https://your-app.com/hook", required: true },
      { key: "minAmount", label: "Min Amount to Notify (USDC)", type: "number", placeholder: "10" },
      { key: "notifyOn", label: "Notify On", type: "select", options: ["all", "over-limit", "errors-only"] },
    ],
    config: { webhookUrl: "https://hooks.slack.com/T0X...", minAmount: 10, notifyOn: "all" },
    status: "connected",
    stats: { totalCalls: 2_100, totalSpent: 0, lastUsed: Date.now() - 45_000 },
  },
];

// ---- Custom Connector Template ----

export const CUSTOM_CONNECTOR_TEMPLATE: AgentVaultConnector = {
  id: "custom-",
  name: "",
  description: "",
  icon: "🔌",
  type: "custom",
  enabled: false,
  configFields: [],
  config: {},
  status: "disconnected",
  stats: { totalCalls: 0, totalSpent: 0, lastUsed: null },
};

// ---- SDK Code Snippets for docs panel ----

export const SDK_SNIPPETS = {
  install: `npm install @agentvault/sdk @coral-xyz/anchor @solana/web3.js`,

  initVault: `import { AgentVault } from "@agentvault/sdk";

const vault = new AgentVault({
  rpc: "https://api.devnet.solana.com",
  programId: "8g5hMx6AwTUFCrKwuaCfDY468qE4bbHiw8BvdiepUJdo",
  creatorWallet: creatorPublicKey,
});`,

  checkBudget: `// Agent checks its remaining budget
const budget = await vault.getAgentBudget(agentWalletPubkey);
console.log(budget.remaining);   // 450.00 USDC
console.log(budget.spent);       // 50.00 USDC
console.log(budget.limit);       // 500.00 USDC
console.log(budget.isActive);    // true`,

  requestPayment: `// Agent requests payment for completed task
const receipt = await vault.requestPayment({
  agentWallet: agentKeypair,
  amount: 25_000_000,  // 25 USDC
  memo: "GPT-4 API calls — batch 47",
  proofUri: "https://logs.myapp.com/batch/47",
});
console.log(receipt.txSignature); // "4xKj...9mNv"
console.log(receipt.onChainReceipt); // PDA address`,

  submitDeliverable: `// Agent submits deliverable for milestone approval
await vault.submitDeliverable({
  agentWallet: agentKeypair,
  milestonePda: milestonePubkey,
  proofUri: "ipfs://Qm.../report.pdf",
});
// Creator reviews → approves → USDC released from escrow`,

  customConnector: `import { CustomConnector } from "@agentvault/sdk";

// Build your own connector with beforePay/afterPay hooks
const limiter = new CustomConnector(
  "trading-limiter",     // unique ID
  "Trading Bot Limiter", // display name
  {
    // Block payments that exceed limits
    beforePay: async (agent, amount, memo) => {
      const usdc = amount / 1_000_000;
      if (usdc > 100) {
        return { allow: false, reason: "Max $100 per trade" };
      }
      if (memo.includes("leverage")) {
        return { allow: false, reason: "No leveraged trades" };
      }
      return { allow: true };
    },
    // Log every payment to your analytics
    afterPay: async (receipt) => {
      await myAnalytics.track("trade", {
        amount: receipt.amount,
        memo: receipt.memo,
        tx: receipt.txSignature,
      });
    },
  }
);

// Attach to vault — hooks run on every vault.pay()
vault.connectors.use(limiter);`,

  elizaPlugin: `import { ElizaOSConnector } from "@agentvault/sdk";

const eliza = new ElizaOSConnector({
  maxPerTask: 50,
  agentId: "research-bot",
});
vault.connectors.use(eliza);

// Get 3 real actions for your Eliza agent
const actions = eliza.getActions(agentWallet);
// actions.CHECK_BUDGET — "how much can I spend?"
// actions.VAULT_PAY    — "pay $25 for API batch"
// actions.GET_RECEIPTS — "show my payment history"

// Or register as a full ElizaOS plugin
const plugin = eliza.asPlugin(agentWallet);
// { name: "agentvault", actions: [...] }`,

  x402Wrap: `import { X402Connector } from "@agentvault/sdk";

const x402 = new X402Connector({
  perRequestMax: 25,  // max $25 per API call
  dailyCap: 100,      // max $100/day per agent
});
vault.connectors.use(x402);

// Budget-controlled API call in one step:
// 1. Checks budget limits
// 2. Pays on-chain from vault
// 3. Makes the HTTP request
const { receipt, response } = await x402.payAndFetch(
  agentWallet,
  "https://api.openai.com/v1/chat/completions",
  0.05,    // $0.05 USDC
  "GPT-4o — 12K tokens"
);
console.log(receipt.txSignature); // on-chain proof`,

  langchainTool: `import { LangChainConnector } from "@agentvault/sdk";

const lc = new LangChainConnector({ maxPerCall: 25 });
vault.connectors.use(lc);

// Get a tool your LangChain agent can call
const tool = lc.asTool(agentWallet);
// tool.name = "agentvault_pay"
// tool.execute({ amount: 5, memo: "API call" })

// Or for Vercel AI SDK
const vercelTool = lc.asVercelTool(agentWallet);

// Check budget before spending
const budget = await lc.checkBudget(agentWallet);
// { role: "Research Agent", remaining: 450000000 }`,

  sakAction: `import { SolanaAgentKitConnector } from "@agentvault/sdk";

const sak = new SolanaAgentKitConnector({
  budgetLimit: 500, // $500/day per agent
});
vault.connectors.use(sak);

// Register with your SAK agent
const payAction = sak.getAction(agentWallet);
// payAction.name = "agentVaultPay"
// payAction.execute({ amount: 15, memo: "Jupiter swap" })

const budgetAction = sak.getCheckBudgetAction(agentWallet);
// budgetAction.name = "checkVaultBudget"`,

  webhookSetup: `import { WebhookConnector } from "@agentvault/sdk";

const webhook = new WebhookConnector({
  webhookUrl: "https://your-server.com/payments",
  minAmount: 10,         // only notify > $10
  secret: "signing-key", // X-AgentVault-Signature header
});
vault.connectors.use(webhook);

// Now every vault.pay() automatically POSTs:
// { event: "payment", agent: "7nYB...", amount: 25000000,
//   amountUsdc: 25, memo: "...", txSignature: "4xKj..." }`,
};
