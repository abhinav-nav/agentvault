import type { ConnectorDefinition, ConnectorInstance, ConnectorConfig, PaymentReceipt, BudgetStatus } from "./types";
import type { AgentVault } from "./vault";
/**
 * BaseConnector — abstract class all connectors extend.
 *
 * Connectors hook into the AgentVault payment lifecycle:
 *   beforePay() → on-chain pay() → afterPay()
 *
 * Override these to add budget checks, webhook notifications,
 * framework-specific tool wrappers, etc.
 */
export declare abstract class BaseConnector {
    readonly id: string;
    readonly name: string;
    readonly type: "ai-framework" | "payment-rail" | "monitoring" | "custom";
    protected config: ConnectorConfig;
    protected vault: AgentVault | null;
    constructor(id: string, name: string, type: BaseConnector["type"], config?: ConnectorConfig);
    /** Attach to an AgentVault instance */
    attach(vault: AgentVault): void;
    /** Update config at runtime */
    configure(config: ConnectorConfig): void;
    /** Called before every payment — return false to block */
    beforePay(agent: string, amount: number, memo: string): Promise<{
        allow: boolean;
        reason?: string;
    }>;
    /** Called after every successful payment */
    afterPay(receipt: PaymentReceipt): Promise<void>;
    /** Health check */
    healthCheck(): Promise<{
        ok: boolean;
        message?: string;
    }>;
    abstract getDefinition(): ConnectorDefinition;
}
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
export declare class WebhookConnector extends BaseConnector {
    constructor(config: {
        webhookUrl: string;
        minAmount?: number;
        notifyOn?: "all" | "over-limit" | "errors-only";
        secret?: string;
    });
    afterPay(receipt: PaymentReceipt): Promise<void>;
    healthCheck(): Promise<{
        ok: boolean;
        message?: string;
    }>;
    getDefinition(): ConnectorDefinition;
}
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
export declare class X402Connector extends BaseConnector {
    private dailySpend;
    constructor(config?: {
        perRequestMax?: number;
        dailyCap?: number;
        gatewayUrl?: string;
    });
    beforePay(agent: string, amount: number, memo: string): Promise<{
        allow: boolean;
        reason?: string;
    }>;
    afterPay(receipt: PaymentReceipt): Promise<void>;
    /**
     * Make a budget-controlled API call through x402.
     * Checks budget → pays on-chain → fetches the API.
     */
    payAndFetch(agentWallet: any, // PublicKey
    apiUrl: string, amountUsdc: number, memo?: string): Promise<{
        receipt: PaymentReceipt;
        response: Response;
    }>;
    /** Get daily spend for an agent */
    getDailySpend(agentWallet: string): number;
    getDefinition(): ConnectorDefinition;
}
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
export declare class LangChainConnector extends BaseConnector {
    constructor(config?: {
        maxPerCall?: number;
        toolName?: string;
    });
    /**
     * Returns a LangChain-compatible tool definition.
     * The agent calls this tool to make budget-controlled payments.
     */
    asTool(agentWallet: any): {
        name: string;
        description: string;
        parameters: {
            type: "object";
            properties: {
                amount: {
                    type: string;
                    description: string;
                };
                memo: {
                    type: string;
                    description: string;
                };
            };
            required: string[];
        };
        execute({ amount, memo }: {
            amount: number;
            memo: string;
        }): Promise<string>;
    };
    /**
     * Returns a Vercel AI SDK-compatible tool.
     */
    asVercelTool(agentWallet: any): {
        description: string;
        parameters: {
            type: "object";
            properties: {
                amount: {
                    type: string;
                    description: string;
                };
                memo: {
                    type: string;
                    description: string;
                };
            };
            required: string[];
        };
        execute: ({ amount, memo }: {
            amount: number;
            memo: string;
        }) => Promise<string>;
    };
    /**
     * Check budget for an agent — useful for agents to self-check before spending.
     */
    checkBudget(agentWallet: any): Promise<BudgetStatus | null>;
    getDefinition(): ConnectorDefinition;
}
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
export declare class ElizaOSConnector extends BaseConnector {
    constructor(config?: {
        agentId?: string;
        maxPerTask?: number;
        autoApprove?: boolean;
    });
    /**
     * Returns ElizaOS-compatible action definitions.
     * Register these with your Eliza agent's action handler.
     */
    getActions(agentWallet: any): {
        CHECK_BUDGET: {
            name: string;
            description: string;
            similes: string[];
            handler(_runtime: any, _message: any): Promise<string>;
        };
        VAULT_PAY: {
            name: string;
            description: string;
            similes: string[];
            parameters: {
                amount: {
                    type: string;
                    description: string;
                };
                memo: {
                    type: string;
                    description: string;
                };
            };
            handler(_runtime: any, _message: any, params: {
                amount: number;
                memo: string;
            }): Promise<string>;
        };
        GET_RECEIPTS: {
            name: string;
            description: string;
            similes: string[];
            handler(): Promise<string>;
        };
    };
    /**
     * ElizaOS plugin format — register this as a plugin in your Eliza agent config.
     */
    asPlugin(agentWallet: any): {
        name: string;
        description: string;
        actions: ({
            name: string;
            description: string;
            similes: string[];
            handler(_runtime: any, _message: any): Promise<string>;
        } | {
            name: string;
            description: string;
            similes: string[];
            parameters: {
                amount: {
                    type: string;
                    description: string;
                };
                memo: {
                    type: string;
                    description: string;
                };
            };
            handler(_runtime: any, _message: any, params: {
                amount: number;
                memo: string;
            }): Promise<string>;
        } | {
            name: string;
            description: string;
            similes: string[];
            handler(): Promise<string>;
        })[];
    };
    getDefinition(): ConnectorDefinition;
}
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
export declare class SolanaAgentKitConnector extends BaseConnector {
    private dailySpend;
    constructor(config?: {
        budgetLimit?: number;
        rpcUrl?: string;
    });
    beforePay(agent: string, amount: number, memo: string): Promise<{
        allow: boolean;
        reason?: string;
    }>;
    afterPay(receipt: PaymentReceipt): Promise<void>;
    /**
     * Returns a Solana Agent Kit compatible action.
     * Register with: agent.registerAction(action)
     */
    getAction(agentWallet: any): {
        name: string;
        description: string;
        schema: {
            type: "object";
            properties: {
                amount: {
                    type: string;
                    description: string;
                };
                memo: {
                    type: string;
                    description: string;
                };
            };
            required: string[];
        };
        execute(params: {
            amount: number;
            memo: string;
        }): Promise<{
            success: boolean;
            txSignature?: string;
            error?: string;
        }>;
    };
    /**
     * Get a budget checker action for SAK agents.
     */
    getCheckBudgetAction(agentWallet: any): {
        name: string;
        description: string;
        schema: {
            type: "object";
            properties: {};
        };
        execute(): Promise<BudgetStatus | {
            error: string;
        }>;
    };
    getDefinition(): ConnectorDefinition;
}
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
export declare class CustomConnector extends BaseConnector {
    private hooks;
    constructor(id: string, name: string, hooks?: CustomConnector["hooks"], config?: ConnectorConfig);
    beforePay(agent: string, amount: number, memo: string): Promise<{
        allow: boolean;
        reason?: string;
    }>;
    afterPay(receipt: PaymentReceipt): Promise<void>;
    healthCheck(): Promise<{
        ok: boolean;
        message?: string;
    }>;
    getDefinition(): ConnectorDefinition;
}
/**
 * ConnectorRegistry — manages all connectors attached to a vault.
 *
 * Connectors are now real classes with lifecycle hooks, not just config.
 * The registry runs beforePay/afterPay hooks for all enabled connectors
 * on every payment.
 */
export declare class ConnectorRegistry {
    private connectors;
    private enabledSet;
    private vault;
    private legacyConnectors;
    /** Attach to an AgentVault instance */
    attachVault(vault: AgentVault): void;
    /** Register and optionally enable a real connector */
    use(connector: BaseConnector, config?: ConnectorConfig): void;
    /** Register a connector definition (legacy/config-only) */
    register(definition: ConnectorDefinition, config?: ConnectorConfig): void;
    /** Enable a connector */
    enable(id: string, config?: ConnectorConfig): void;
    /** Disable a connector */
    disable(id: string): void;
    /** Update connector config */
    configure(id: string, config: ConnectorConfig): void;
    /** Get a connector by ID */
    get(id: string): BaseConnector | undefined;
    /** List all connectors (real + legacy) */
    list(): ConnectorInstance[];
    /** List only enabled connectors */
    listEnabled(): BaseConnector[];
    /** Remove a connector */
    remove(id: string): boolean;
    /**
     * Run beforePay hooks for all enabled connectors.
     * Returns { allow: false } if ANY connector blocks the payment.
     */
    runBeforePay(agent: string, amount: number, memo: string): Promise<{
        allow: boolean;
        reason?: string;
        blockedBy?: string;
    }>;
    /**
     * Run afterPay hooks for all enabled connectors.
     */
    runAfterPay(receipt: PaymentReceipt): Promise<void>;
    /** Export config (for persistence) */
    exportConfig(): Record<string, {
        config: ConnectorConfig;
        enabled: boolean;
    }>;
    /** Import config from JSON */
    importConfig(data: Record<string, {
        config: ConnectorConfig;
        enabled: boolean;
    }>): void;
}
export declare const BUILTIN_CONNECTORS: ConnectorDefinition[];
/** Register all built-in connectors on a registry (legacy) */
export declare function registerBuiltins(registry: ConnectorRegistry): void;
//# sourceMappingURL=connectors.d.ts.map