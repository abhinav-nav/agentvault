import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import type { VaultConfig, TeamInfo, AgentInfo, BudgetStatus, PaymentReceipt } from "./types";
import { ConnectorRegistry } from "./connectors";
export declare class AgentVault {
    readonly connection: Connection;
    readonly programId: PublicKey;
    readonly wallet: Keypair;
    readonly connectors: ConnectorRegistry;
    private program;
    constructor(config: VaultConfig);
    /** Get team info for the current wallet */
    getTeam(): Promise<TeamInfo | null>;
    /** Get all agents registered to this vault */
    getAgents(): Promise<AgentInfo[]>;
    /** Get budget status for a specific agent */
    getAgentBudget(agentWallet: PublicKey): Promise<BudgetStatus | null>;
    /** Get all payment receipts */
    getReceipts(): Promise<PaymentReceipt[]>;
    /** Create a new agent vault (team + USDC vault) */
    createVault(name: string): Promise<string>;
    /** Register an AI agent with a per-task budget limit */
    registerAgent(agentWallet: PublicKey, role: string, ratePerTask: number): Promise<string>;
    /** Fund the vault with USDC */
    fundVault(amount: number): Promise<string>;
    /** Pay an agent directly from the vault (runs connector hooks) */
    pay(agentWallet: PublicKey, amount: number, memo: string): Promise<PaymentReceipt>;
    /** Kill switch — deactivate an agent immediately */
    killAgent(agentWallet: PublicKey): Promise<string>;
    /** Format raw USDC amount to display string */
    formatUsdc(amount: number): string;
}
//# sourceMappingURL=vault.d.ts.map