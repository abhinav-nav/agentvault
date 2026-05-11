import { PublicKey, Keypair } from "@solana/web3.js";

// ---- Core Types ----

export interface VaultConfig {
  /** Solana RPC endpoint */
  rpc: string;
  /** AgentVault program ID */
  programId?: string;
  /** Creator/owner wallet keypair or path */
  wallet: Keypair | string;
}

export interface AgentInfo {
  /** On-chain member PDA */
  pda: PublicKey;
  /** Agent's wallet pubkey */
  wallet: PublicKey;
  /** Role label */
  role: string;
  /** Max USDC per task (raw units) */
  ratePerTask: number;
  /** Total USDC spent (raw units) */
  totalSpent: number;
  /** Number of completed tasks */
  tasksCompleted: number;
  /** Whether agent is active */
  isActive: boolean;
}

export interface TeamInfo {
  /** Team PDA */
  pda: PublicKey;
  /** Team name */
  name: string;
  /** Number of agents */
  agentCount: number;
  /** Total USDC disbursed (raw units) */
  totalDisbursed: number;
  /** Number of payment records */
  paymentCount: number;
  /** Vault PDA (USDC token account) */
  vault: PublicKey;
  /** Vault USDC balance (raw units) */
  vaultBalance: number;
}

export interface PaymentReceipt {
  /** On-chain receipt PDA */
  pda: PublicKey;
  /** Recipient wallet */
  recipient: PublicKey;
  /** Amount in USDC raw units */
  amount: number;
  /** Unix timestamp */
  timestamp: number;
  /** Memo string */
  memo: string;
  /** Whether this was a milestone payment */
  isMilestone: boolean;
  /** Transaction signature */
  txSignature?: string;
}

export interface BudgetStatus {
  /** Agent wallet */
  agent: PublicKey;
  /** Role label */
  role: string;
  /** Per-task limit in USDC */
  limit: number;
  /** Total spent in USDC */
  spent: number;
  /** Remaining budget (vault balance / num agents) */
  remaining: number;
  /** Active status */
  isActive: boolean;
  /** Tasks completed */
  tasksCompleted: number;
}

// ---- Connector Types ----

export type ConnectorType = "ai-framework" | "payment-rail" | "monitoring" | "custom";

export interface ConnectorConfig {
  [key: string]: string | number | boolean;
}

export interface ConnectorDefinition {
  /** Unique connector ID */
  id: string;
  /** Display name */
  name: string;
  /** Description */
  description: string;
  /** Type category */
  type: ConnectorType;
  /** Config schema */
  configSchema: ConnectorConfigField[];
}

export interface ConnectorConfigField {
  key: string;
  label: string;
  type: "text" | "number" | "boolean" | "select";
  required?: boolean;
  default?: string | number | boolean;
  options?: string[];
}

export interface ConnectorInstance {
  definition: ConnectorDefinition;
  config: ConnectorConfig;
  enabled: boolean;
}
