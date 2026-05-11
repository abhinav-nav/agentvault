import type {
  ConnectorDefinition,
  ConnectorInstance,
  ConnectorConfig,
  PaymentReceipt,
  BudgetStatus,
} from "./types";
import type { AgentVault } from "./vault";

// ---- Base Connector ----

/**
 * BaseConnector — abstract class all connectors extend.
 *
 * Connectors hook into the AgentVault payment lifecycle:
 *   beforePay() → on-chain pay() → afterPay()
 *
 * Override these to add budget checks, webhook notifications,
 * framework-specific tool wrappers, etc.
 */
export abstract class BaseConnector {
  readonly id: string;
  readonly name: string;
  readonly type: "ai-framework" | "payment-rail" | "monitoring" | "custom";
  protected config: ConnectorConfig;
  protected vault: AgentVault | null = null;

  constructor(id: string, name: string, type: BaseConnector["type"], config: ConnectorConfig = {}) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.config = config;
  }

  /** Attach to an AgentVault instance */
  attach(vault: AgentVault): void {
    this.vault = vault;
  }

  /** Update config at runtime */
  configure(config: ConnectorConfig): void {
    this.config = { ...this.config, ...config };
  }

  /** Called before every payment — return false to block */
  async beforePay(agent: string, amount: number, memo: string): Promise<{ allow: boolean; reason?: string }> {
    return { allow: true };
  }

  /** Called after every successful payment */
  async afterPay(receipt: PaymentReceipt): Promise<void> {}

  /** Health check */
  async healthCheck(): Promise<{ ok: boolean; message?: string }> {
    return { ok: true };
  }

  abstract getDefinition(): ConnectorDefinition;
}

// ---- Webhook Connector ----

/**
 * WebhookConnector — POSTs to a URL on every agent payment.
 *
 * Usage:
 *   const webhook = new WebhookConnector({
 *     webhookUrl: "https://your-server.com/payments",
 *     minAmount: 10,
 *     notifyOn: "all",
 *   });
 *   vault.connectors.use(webhook);
 */
export class WebhookConnector extends BaseConnector {
  constructor(config: { webhookUrl: string; minAmount?: number; notifyOn?: "all" | "over-limit" | "errors-only"; secret?: string }) {
    super("webhook", "Webhook Monitor", "monitoring", config as ConnectorConfig);
  }

  async afterPay(receipt: PaymentReceipt): Promise<void> {
    const url = this.config.webhookUrl as string;
    if (!url) return;

    const minAmount = (this.config.minAmount as number) || 0;
    const amountUsdc = receipt.amount / 1_000_000;
    if (amountUsdc < minAmount) return;

    const payload = {
      event: "payment",
      agent: receipt.recipient.toBase58(),
      amount: receipt.amount,
      amountUsdc,
      memo: receipt.memo,
      timestamp: receipt.timestamp,
      pda: receipt.pda.toBase58(),
      txSignature: receipt.txSignature,
    };

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.config.secret) {
      headers["X-AgentVault-Signature"] = this.config.secret as string;
    }

    try {
      await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });
    } catch (err: any) {
      console.error(`[webhook] POST to ${url} failed: ${err.message}`);
    }
  }

  async healthCheck(): Promise<{ ok: boolean; message?: string }> {
    const url = this.config.webhookUrl as string;
    if (!url) return { ok: false, message: "No webhook URL configured" };
    try {
      const res = await fetch(url, { method: "HEAD" });
      return { ok: res.ok, message: `HTTP ${res.status}` };
    } catch (err: any) {
      return { ok: false, message: err.message };
    }
  }

  getDefinition(): ConnectorDefinition {
    return {
      id: "webhook",
      name: "Webhook Monitor",
      description: "POST to any URL on every agent payment event. Real-time spending alerts.",
      type: "monitoring",
      configSchema: [
        { key: "webhookUrl", label: "Webhook URL", type: "text", required: true },
        { key: "minAmount", label: "Min Amount to Notify (USDC)", type: "number", default: 10 },
        { key: "notifyOn", label: "Notify On", type: "select", options: ["all", "over-limit", "errors-only"], default: "all" },
        { key: "secret", label: "Signing Secret (optional)", type: "text" },
      ],
    };
  }
}

// ---- x402 / Pay.sh Connector ----

/**
 * X402Connector — wraps HTTP requests with vault budget enforcement.
 *
 * When an AI agent makes an API call through x402/Pay.sh, this connector:
 * 1. Checks if the agent has budget remaining
 * 2. Enforces per-request and daily caps
 * 3. Records the payment on-chain via the vault
 * 4. Returns the API response
 *
 * Usage:
 *   const x402 = new X402Connector({
 *     perRequestMax: 1,
 *     dailyCap: 100,
 *   });
 *   vault.connectors.use(x402);
 *
 *   // Agent makes a budget-controlled API call
 *   const response = await x402.payAndFetch(agentWallet, "https://api.example.com/data", 0.5, "API call");
 */
export class X402Connector extends BaseConnector {
  private dailySpend: Map<string, { total: number; date: string }> = new Map();

  constructor(config: { perRequestMax?: number; dailyCap?: number; gatewayUrl?: string } = {}) {
    super("x402", "x402 / Pay.sh", "payment-rail", config as ConnectorConfig);
  }

  async beforePay(agent: string, amount: number, memo: string): Promise<{ allow: boolean; reason?: string }> {
    const amountUsdc = amount / 1_000_000;
    const perRequestMax = (this.config.perRequestMax as number) || Infinity;
    const dailyCap = (this.config.dailyCap as number) || Infinity;

    // Check per-request limit
    if (amountUsdc > perRequestMax) {
      return { allow: false, reason: `Amount $${amountUsdc} exceeds per-request max of $${perRequestMax}` };
    }

    // Check daily cap
    const today = new Date().toISOString().split("T")[0];
    const daily = this.dailySpend.get(agent);
    const todayTotal = (daily && daily.date === today) ? daily.total : 0;

    if (todayTotal + amountUsdc > dailyCap) {
      return { allow: false, reason: `Daily cap of $${dailyCap} would be exceeded. Today: $${todayTotal.toFixed(2)}` };
    }

    return { allow: true };
  }

  async afterPay(receipt: PaymentReceipt): Promise<void> {
    const agent = receipt.recipient.toBase58();
    const amountUsdc = receipt.amount / 1_000_000;
    const today = new Date().toISOString().split("T")[0];
    const daily = this.dailySpend.get(agent);
    const todayTotal = (daily && daily.date === today) ? daily.total : 0;
    this.dailySpend.set(agent, { total: todayTotal + amountUsdc, date: today });
  }

  /**
   * Make a budget-controlled API call through x402.
   * Checks budget → pays on-chain → fetches the API.
   */
  async payAndFetch(
    agentWallet: any, // PublicKey
    apiUrl: string,
    amountUsdc: number,
    memo?: string
  ): Promise<{ receipt: PaymentReceipt; response: Response }> {
    if (!this.vault) throw new Error("Connector not attached to a vault. Call vault.connectors.use(connector) first.");

    const raw = Math.round(amountUsdc * 1_000_000);
    const memoStr = memo || `x402: ${new URL(apiUrl).hostname}`;

    // Budget check
    const check = await this.beforePay(agentWallet.toBase58(), raw, memoStr);
    if (!check.allow) throw new Error(`x402 blocked: ${check.reason}`);

    // On-chain payment
    const receipt = await this.vault.pay(agentWallet, raw, memoStr);
    await this.afterPay(receipt);

    // Make the API call
    const response = await fetch(apiUrl, {
      headers: { "X-Payment-Tx": receipt.txSignature || "" },
    });

    return { receipt, response };
  }

  /** Get daily spend for an agent */
  getDailySpend(agentWallet: string): number {
    const today = new Date().toISOString().split("T")[0];
    const daily = this.dailySpend.get(agentWallet);
    return (daily && daily.date === today) ? daily.total : 0;
  }

  getDefinition(): ConnectorDefinition {
    return {
      id: "x402",
      name: "x402 / Pay.sh",
      description: "Wrap Pay.sh API payments with vault budget caps. Agents pay for APIs from your treasury with spending limits.",
      type: "payment-rail",
      configSchema: [
        { key: "gatewayUrl", label: "Pay.sh Gateway URL", type: "text", default: "https://pay.sh/api" },
        { key: "perRequestMax", label: "Max per Request (USDC)", type: "number", default: 1 },
        { key: "dailyCap", label: "Daily Cap (USDC)", type: "number", default: 100 },
      ],
    };
  }
}

// ---- LangChain / Vercel AI SDK Tool Connector ----

/**
 * LangChainConnector — provides a tool that LangChain/Vercel AI SDK agents can call.
 *
 * Usage with LangChain:
 *   const connector = new LangChainConnector({ maxPerCall: 25 });
 *   vault.connectors.use(connector);
 *
 *   // Get the tool definition for your agent
 *   const tool = connector.asTool(agentWallet);
 *   // Add to your LangChain agent's tools array
 *
 * Usage with Vercel AI SDK:
 *   const tool = connector.asVercelTool(agentWallet);
 */
export class LangChainConnector extends BaseConnector {
  constructor(config: { maxPerCall?: number; toolName?: string } = {}) {
    super("langchain", "LangChain / Vercel AI SDK", "ai-framework", {
      toolName: "agentvault_pay",
      maxPerCall: 25,
      ...config,
    } as ConnectorConfig);
  }

  /**
   * Returns a LangChain-compatible tool definition.
   * The agent calls this tool to make budget-controlled payments.
   */
  asTool(agentWallet: any) {
    const vault = this.vault;
    const config = this.config;
    const self = this;

    return {
      name: (config.toolName as string) || "agentvault_pay",
      description: "Make a budget-controlled USDC payment from the agent vault. Use this when you need to pay for an API call, service, or task. Returns the transaction receipt.",
      parameters: {
        type: "object" as const,
        properties: {
          amount: { type: "number", description: "Amount in USDC to pay (e.g. 5.00)" },
          memo: { type: "string", description: "What is this payment for (e.g. 'GPT-4o API call — 12K tokens')" },
        },
        required: ["amount", "memo"],
      },
      async execute({ amount, memo }: { amount: number; memo: string }): Promise<string> {
        if (!vault) throw new Error("Connector not attached to vault");

        const maxPerCall = (config.maxPerCall as number) || Infinity;
        if (amount > maxPerCall) {
          return JSON.stringify({ error: `Amount $${amount} exceeds per-call limit of $${maxPerCall}` });
        }

        const check = await self.beforePay(agentWallet.toBase58(), Math.round(amount * 1_000_000), memo);
        if (!check.allow) return JSON.stringify({ error: check.reason });

        try {
          const receipt = await vault.pay(agentWallet, Math.round(amount * 1_000_000), memo);
          await self.afterPay(receipt);
          return JSON.stringify({
            success: true,
            txSignature: receipt.txSignature,
            amount,
            memo,
            pda: receipt.pda.toBase58(),
          });
        } catch (err: any) {
          return JSON.stringify({ error: err.message });
        }
      },
    };
  }

  /**
   * Returns a Vercel AI SDK-compatible tool.
   */
  asVercelTool(agentWallet: any) {
    const tool = this.asTool(agentWallet);
    return {
      description: tool.description,
      parameters: {
        type: "object" as const,
        properties: tool.parameters.properties,
        required: tool.parameters.required,
      },
      execute: tool.execute,
    };
  }

  /**
   * Check budget for an agent — useful for agents to self-check before spending.
   */
  async checkBudget(agentWallet: any): Promise<BudgetStatus | null> {
    if (!this.vault) throw new Error("Connector not attached to vault");
    return this.vault.getAgentBudget(agentWallet);
  }

  getDefinition(): ConnectorDefinition {
    return {
      id: "langchain",
      name: "LangChain / Vercel AI SDK",
      description: "Tool integration for LangChain agents and Vercel AI SDK. Add vault budget awareness to any chain or agent.",
      type: "ai-framework",
      configSchema: [
        { key: "toolName", label: "Tool Name", type: "text", default: "agentvault_pay" },
        { key: "maxPerCall", label: "Max per Call (USDC)", type: "number", default: 25 },
      ],
    };
  }
}

// ---- ElizaOS Plugin Connector ----

/**
 * ElizaOSConnector — action provider for ElizaOS agents.
 *
 * Provides three actions ElizaOS agents can use:
 *   - CHECK_BUDGET: query remaining budget
 *   - VAULT_PAY: make a payment from the vault
 *   - GET_RECEIPTS: list recent payment receipts
 *
 * Usage:
 *   const eliza = new ElizaOSConnector({ maxPerTask: 50 });
 *   vault.connectors.use(eliza);
 *
 *   // Get action providers for your Eliza agent
 *   const actions = eliza.getActions(agentWallet);
 */
export class ElizaOSConnector extends BaseConnector {
  constructor(config: { agentId?: string; maxPerTask?: number; autoApprove?: boolean } = {}) {
    super("elizaos", "ElizaOS", "ai-framework", {
      maxPerTask: 50,
      autoApprove: true,
      ...config,
    } as ConnectorConfig);
  }

  /**
   * Returns ElizaOS-compatible action definitions.
   * Register these with your Eliza agent's action handler.
   */
  getActions(agentWallet: any) {
    const vault = this.vault;
    const config = this.config;
    const self = this;

    return {
      CHECK_BUDGET: {
        name: "CHECK_BUDGET",
        description: "Check the agent's remaining USDC budget in the vault",
        similes: ["check balance", "how much can I spend", "budget remaining", "check my funds"],
        async handler(_runtime: any, _message: any): Promise<string> {
          if (!vault) return "Vault not connected";
          const budget = await vault.getAgentBudget(agentWallet);
          if (!budget) return "Agent not registered in vault";
          return `Budget status for ${budget.role}:\n` +
            `  Per-task limit: $${(budget.limit / 1_000_000).toFixed(2)}\n` +
            `  Total spent: $${(budget.spent / 1_000_000).toFixed(2)}\n` +
            `  Vault balance: $${(budget.remaining / 1_000_000).toFixed(2)}\n` +
            `  Tasks completed: ${budget.tasksCompleted}\n` +
            `  Status: ${budget.isActive ? "ACTIVE" : "KILLED"}`;
        },
      },

      VAULT_PAY: {
        name: "VAULT_PAY",
        description: "Make a USDC payment from the agent vault for a task or API call",
        similes: ["pay for", "send payment", "spend from vault", "pay agent"],
        parameters: {
          amount: { type: "number", description: "USDC amount" },
          memo: { type: "string", description: "Payment reason" },
        },
        async handler(_runtime: any, _message: any, params: { amount: number; memo: string }): Promise<string> {
          if (!vault) return "Vault not connected";

          const maxPerTask = (config.maxPerTask as number) || Infinity;
          if (params.amount > maxPerTask) {
            return `Blocked: $${params.amount} exceeds per-task limit of $${maxPerTask}`;
          }

          const raw = Math.round(params.amount * 1_000_000);
          const check = await self.beforePay(agentWallet.toBase58(), raw, params.memo);
          if (!check.allow) return `Blocked: ${check.reason}`;

          try {
            const receipt = await vault.pay(agentWallet, raw, params.memo);
            await self.afterPay(receipt);
            return `Payment sent!\n  Amount: $${params.amount}\n  Memo: ${params.memo}\n  TX: ${receipt.txSignature}\n  Receipt PDA: ${receipt.pda.toBase58()}`;
          } catch (err: any) {
            return `Payment failed: ${err.message}`;
          }
        },
      },

      GET_RECEIPTS: {
        name: "GET_RECEIPTS",
        description: "Get recent payment receipts from the vault",
        similes: ["show receipts", "payment history", "what did I spend on", "transaction log"],
        async handler(): Promise<string> {
          if (!vault) return "Vault not connected";
          const receipts = await vault.getReceipts();
          if (receipts.length === 0) return "No payment receipts found.";
          return "Recent payments:\n" + receipts.slice(0, 10).map((r, i) =>
            `  ${i + 1}. $${(r.amount / 1_000_000).toFixed(2)} — ${r.memo} (${new Date(r.timestamp * 1000).toLocaleDateString()})`
          ).join("\n");
        },
      },
    };
  }

  /**
   * ElizaOS plugin format — register this as a plugin in your Eliza agent config.
   */
  asPlugin(agentWallet: any) {
    const actions = this.getActions(agentWallet);
    return {
      name: "agentvault",
      description: "AgentVault treasury integration — budget-controlled payments for AI agents",
      actions: Object.values(actions),
    };
  }

  getDefinition(): ConnectorDefinition {
    return {
      id: "elizaos",
      name: "ElizaOS",
      description: "Connect Eliza-powered AI agents to your vault. Agents can check budgets, submit deliverables, and receive payments.",
      type: "ai-framework",
      configSchema: [
        { key: "agentId", label: "Agent Character ID", type: "text", required: true },
        { key: "maxPerTask", label: "Max USDC per Task", type: "number", default: 50 },
        { key: "autoApprove", label: "Auto-approve under limit", type: "boolean", default: true },
      ],
    };
  }
}

// ---- Solana Agent Kit Connector ----

/**
 * SolanaAgentKitConnector — adds agentVaultPay() to Solana Agent Kit.
 *
 * Solana Agent Kit has 60+ built-in actions. This connector adds budget-controlled
 * payments so any SAK-powered agent can pay from a shared vault.
 *
 * Usage:
 *   const sak = new SolanaAgentKitConnector({ budgetLimit: 500 });
 *   vault.connectors.use(sak);
 *
 *   // Get the action to register with Solana Agent Kit
 *   const action = sak.getAction(agentWallet);
 *   // Add to your SAK agent: agent.registerAction(action)
 */
export class SolanaAgentKitConnector extends BaseConnector {
  private dailySpend: Map<string, { total: number; date: string }> = new Map();

  constructor(config: { budgetLimit?: number; rpcUrl?: string } = {}) {
    super("solana-agent-kit", "Solana Agent Kit", "ai-framework", {
      budgetLimit: 500,
      rpcUrl: "https://api.devnet.solana.com",
      ...config,
    } as ConnectorConfig);
  }

  async beforePay(agent: string, amount: number, memo: string): Promise<{ allow: boolean; reason?: string }> {
    const amountUsdc = amount / 1_000_000;
    const dailyLimit = (this.config.budgetLimit as number) || Infinity;
    const today = new Date().toISOString().split("T")[0];
    const daily = this.dailySpend.get(agent);
    const todayTotal = (daily && daily.date === today) ? daily.total : 0;

    if (todayTotal + amountUsdc > dailyLimit) {
      return { allow: false, reason: `Daily budget of $${dailyLimit} exceeded. Today: $${todayTotal.toFixed(2)}` };
    }
    return { allow: true };
  }

  async afterPay(receipt: PaymentReceipt): Promise<void> {
    const agent = receipt.recipient.toBase58();
    const amountUsdc = receipt.amount / 1_000_000;
    const today = new Date().toISOString().split("T")[0];
    const daily = this.dailySpend.get(agent);
    const todayTotal = (daily && daily.date === today) ? daily.total : 0;
    this.dailySpend.set(agent, { total: todayTotal + amountUsdc, date: today });
  }

  /**
   * Returns a Solana Agent Kit compatible action.
   * Register with: agent.registerAction(action)
   */
  getAction(agentWallet: any) {
    const vault = this.vault;
    const self = this;

    return {
      name: "agentVaultPay",
      description: "Pay for a task or API call from the shared agent vault with budget enforcement. Amount in USDC.",
      schema: {
        type: "object" as const,
        properties: {
          amount: { type: "number", description: "USDC amount to pay" },
          memo: { type: "string", description: "What the payment is for" },
        },
        required: ["amount", "memo"],
      },
      async execute(params: { amount: number; memo: string }): Promise<{ success: boolean; txSignature?: string; error?: string }> {
        if (!vault) return { success: false, error: "Vault not connected" };

        const raw = Math.round(params.amount * 1_000_000);
        const check = await self.beforePay(agentWallet.toBase58(), raw, params.memo);
        if (!check.allow) return { success: false, error: check.reason };

        try {
          const receipt = await vault.pay(agentWallet, raw, params.memo);
          await self.afterPay(receipt);
          return { success: true, txSignature: receipt.txSignature };
        } catch (err: any) {
          return { success: false, error: err.message };
        }
      },
    };
  }

  /**
   * Get a budget checker action for SAK agents.
   */
  getCheckBudgetAction(agentWallet: any) {
    const vault = this.vault;
    return {
      name: "checkVaultBudget",
      description: "Check the agent's remaining USDC budget in the vault",
      schema: { type: "object" as const, properties: {} },
      async execute(): Promise<BudgetStatus | { error: string }> {
        if (!vault) return { error: "Vault not connected" };
        const budget = await vault.getAgentBudget(agentWallet);
        if (!budget) return { error: "Agent not registered" };
        return budget;
      },
    };
  }

  getDefinition(): ConnectorDefinition {
    return {
      id: "solana-agent-kit",
      name: "Solana Agent Kit",
      description: "Adds agentVaultPay() action to the 60+ existing Solana Agent Kit actions. Compatible with any SAK-powered agent.",
      type: "ai-framework",
      configSchema: [
        { key: "rpcUrl", label: "RPC Endpoint", type: "text", default: "https://api.devnet.solana.com" },
        { key: "budgetLimit", label: "Daily Budget (USDC)", type: "number", default: 500 },
      ],
    };
  }
}

// ---- Custom Connector ----

/**
 * CustomConnector — build your own connector with lifecycle hooks.
 *
 * Usage:
 *   const custom = new CustomConnector("my-bot", "My Trading Bot", {
 *     beforePay: async (agent, amount, memo) => {
 *       // Custom budget logic
 *       if (amount > 100_000_000) return { allow: false, reason: "Max $100 per trade" };
 *       return { allow: true };
 *     },
 *     afterPay: async (receipt) => {
 *       // Log to your analytics
 *       await myAnalytics.track("payment", receipt);
 *     },
 *   });
 *   vault.connectors.use(custom);
 */
export class CustomConnector extends BaseConnector {
  private hooks: {
    beforePay?: (agent: string, amount: number, memo: string) => Promise<{ allow: boolean; reason?: string }>;
    afterPay?: (receipt: PaymentReceipt) => Promise<void>;
    healthCheck?: () => Promise<{ ok: boolean; message?: string }>;
  };

  constructor(
    id: string,
    name: string,
    hooks: CustomConnector["hooks"] = {},
    config: ConnectorConfig = {}
  ) {
    super(id, name, "custom", config);
    this.hooks = hooks;
  }

  async beforePay(agent: string, amount: number, memo: string): Promise<{ allow: boolean; reason?: string }> {
    if (this.hooks.beforePay) return this.hooks.beforePay(agent, amount, memo);
    return { allow: true };
  }

  async afterPay(receipt: PaymentReceipt): Promise<void> {
    if (this.hooks.afterPay) await this.hooks.afterPay(receipt);
  }

  async healthCheck(): Promise<{ ok: boolean; message?: string }> {
    if (this.hooks.healthCheck) return this.hooks.healthCheck();
    return { ok: true };
  }

  getDefinition(): ConnectorDefinition {
    return {
      id: this.id,
      name: this.name,
      description: `Custom connector: ${this.name}`,
      type: "custom",
      configSchema: [],
    };
  }
}


// ---- Connector Registry (upgraded) ----

/**
 * ConnectorRegistry — manages all connectors attached to a vault.
 *
 * Connectors are now real classes with lifecycle hooks, not just config.
 * The registry runs beforePay/afterPay hooks for all enabled connectors
 * on every payment.
 */
export class ConnectorRegistry {
  private connectors: Map<string, BaseConnector> = new Map();
  private enabledSet: Set<string> = new Set();
  private vault: AgentVault | null = null;

  // Legacy support
  private legacyConnectors: Map<string, ConnectorInstance> = new Map();

  /** Attach to an AgentVault instance */
  attachVault(vault: AgentVault): void {
    this.vault = vault;
    for (const conn of this.connectors.values()) {
      conn.attach(vault);
    }
  }

  /** Register and optionally enable a real connector */
  use(connector: BaseConnector, config?: ConnectorConfig): void {
    if (config) connector.configure(config);
    if (this.vault) connector.attach(this.vault);
    this.connectors.set(connector.id, connector);
    this.enabledSet.add(connector.id);
  }

  /** Register a connector definition (legacy/config-only) */
  register(definition: ConnectorDefinition, config?: ConnectorConfig): void {
    this.legacyConnectors.set(definition.id, {
      definition,
      config: config || {},
      enabled: false,
    });
  }

  /** Enable a connector */
  enable(id: string, config?: ConnectorConfig): void {
    const conn = this.connectors.get(id);
    if (conn) {
      if (config) conn.configure(config);
      this.enabledSet.add(id);
      return;
    }

    // Legacy fallback
    const legacy = this.legacyConnectors.get(id);
    if (!legacy) throw new Error(`Connector '${id}' not found. Register it first.`);
    if (config) {
      for (const field of legacy.definition.configSchema) {
        if (field.required && !(field.key in config)) {
          throw new Error(`Missing required config field '${field.key}' for connector '${id}'`);
        }
      }
      legacy.config = { ...legacy.config, ...config };
    }
    legacy.enabled = true;
  }

  /** Disable a connector */
  disable(id: string): void {
    this.enabledSet.delete(id);
    const legacy = this.legacyConnectors.get(id);
    if (legacy) legacy.enabled = false;
  }

  /** Update connector config */
  configure(id: string, config: ConnectorConfig): void {
    const conn = this.connectors.get(id);
    if (conn) { conn.configure(config); return; }
    const legacy = this.legacyConnectors.get(id);
    if (legacy) { legacy.config = { ...legacy.config, ...config }; return; }
    throw new Error(`Connector '${id}' not found`);
  }

  /** Get a connector by ID */
  get(id: string): BaseConnector | undefined {
    return this.connectors.get(id);
  }

  /** List all connectors (real + legacy) */
  list(): ConnectorInstance[] {
    const result: ConnectorInstance[] = [];
    for (const [id, conn] of this.connectors) {
      result.push({
        definition: conn.getDefinition(),
        config: (conn as any).config || {},
        enabled: this.enabledSet.has(id),
      });
    }
    for (const inst of this.legacyConnectors.values()) {
      if (!this.connectors.has(inst.definition.id)) {
        result.push(inst);
      }
    }
    return result;
  }

  /** List only enabled connectors */
  listEnabled(): BaseConnector[] {
    return Array.from(this.connectors.values()).filter(c => this.enabledSet.has(c.id));
  }

  /** Remove a connector */
  remove(id: string): boolean {
    this.enabledSet.delete(id);
    this.legacyConnectors.delete(id);
    return this.connectors.delete(id);
  }

  /**
   * Run beforePay hooks for all enabled connectors.
   * Returns { allow: false } if ANY connector blocks the payment.
   */
  async runBeforePay(agent: string, amount: number, memo: string): Promise<{ allow: boolean; reason?: string; blockedBy?: string }> {
    for (const conn of this.listEnabled()) {
      const result = await conn.beforePay(agent, amount, memo);
      if (!result.allow) {
        return { allow: false, reason: result.reason, blockedBy: conn.id };
      }
    }
    return { allow: true };
  }

  /**
   * Run afterPay hooks for all enabled connectors.
   */
  async runAfterPay(receipt: PaymentReceipt): Promise<void> {
    for (const conn of this.listEnabled()) {
      try {
        await conn.afterPay(receipt);
      } catch (err: any) {
        console.error(`[${conn.id}] afterPay hook failed: ${err.message}`);
      }
    }
  }

  /** Export config (for persistence) */
  exportConfig(): Record<string, { config: ConnectorConfig; enabled: boolean }> {
    const out: Record<string, { config: ConnectorConfig; enabled: boolean }> = {};
    for (const [id, conn] of this.connectors) {
      out[id] = { config: (conn as any).config || {}, enabled: this.enabledSet.has(id) };
    }
    for (const [id, inst] of this.legacyConnectors) {
      if (!out[id]) out[id] = { config: inst.config, enabled: inst.enabled };
    }
    return out;
  }

  /** Import config from JSON */
  importConfig(data: Record<string, { config: ConnectorConfig; enabled: boolean }>): void {
    for (const [id, state] of Object.entries(data)) {
      const conn = this.connectors.get(id);
      if (conn) {
        conn.configure(state.config);
        if (state.enabled) this.enabledSet.add(id);
        else this.enabledSet.delete(id);
      }
      const legacy = this.legacyConnectors.get(id);
      if (legacy) {
        legacy.config = state.config;
        legacy.enabled = state.enabled;
      }
    }
  }
}


// ---- Built-in Connector Definitions (for legacy register flow) ----

export const BUILTIN_CONNECTORS: ConnectorDefinition[] = [
  new ElizaOSConnector().getDefinition(),
  new SolanaAgentKitConnector().getDefinition(),
  new X402Connector().getDefinition(),
  new LangChainConnector().getDefinition(),
  new WebhookConnector({ webhookUrl: "" }).getDefinition(),
];

/** Register all built-in connectors on a registry (legacy) */
export function registerBuiltins(registry: ConnectorRegistry): void {
  for (const def of BUILTIN_CONNECTORS) {
    registry.register(def);
  }
}
