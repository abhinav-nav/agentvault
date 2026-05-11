import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import * as fs from "fs";

import {
  DEFAULT_PROGRAM_ID,
  USDC_DEVNET,
  USDC_DECIMALS,
  findTeamPda,
  findVaultPda,
  findMemberPda,
  findReceiptPda,
  formatUsdc,
} from "./pda";
import type {
  VaultConfig,
  TeamInfo,
  AgentInfo,
  BudgetStatus,
  PaymentReceipt,
} from "./types";
import { ConnectorRegistry } from "./connectors";
import IDL from "./idl.json";

export class AgentVault {
  readonly connection: Connection;
  readonly programId: PublicKey;
  readonly wallet: Keypair;
  readonly connectors: ConnectorRegistry;
  private program: Program<any>;

  constructor(config: VaultConfig) {
    this.connection = new Connection(config.rpc, "confirmed");
    this.programId = config.programId
      ? new PublicKey(config.programId)
      : DEFAULT_PROGRAM_ID;

    // Load wallet
    if (typeof config.wallet === "string") {
      const raw = JSON.parse(fs.readFileSync(config.wallet, "utf-8"));
      this.wallet = Keypair.fromSecretKey(Uint8Array.from(raw));
    } else {
      this.wallet = config.wallet;
    }

    // Setup Anchor provider
    const provider = new AnchorProvider(
      this.connection,
      {
        publicKey: this.wallet.publicKey,
        signTransaction: async <T extends Transaction | VersionedTransaction>(
          tx: T
        ): Promise<T> => {
          if (tx instanceof Transaction) {
            tx.partialSign(this.wallet);
          }
          return tx;
        },
        signAllTransactions: async <
          T extends Transaction | VersionedTransaction
        >(
          txs: T[]
        ): Promise<T[]> => {
          txs.forEach((tx) => {
            if (tx instanceof Transaction) tx.partialSign(this.wallet);
          });
          return txs;
        },
      },
      { preflightCommitment: "confirmed" }
    );

    this.program = new Program(IDL as any, provider) as any;
    this.connectors = new ConnectorRegistry();
    this.connectors.attachVault(this);
  }

  // ---- Read Operations ----

  /** Get team info for the current wallet */
  async getTeam(): Promise<TeamInfo | null> {
    const [teamPda] = findTeamPda(this.wallet.publicKey, this.programId);
    try {
      const team = await (this.program.account as any).team.fetch(teamPda);
      const [vaultPda] = findVaultPda(teamPda, this.programId);
      let vaultBalance = 0;
      try {
        const bal = await this.connection.getTokenAccountBalance(vaultPda);
        vaultBalance = Number(bal.value.amount);
      } catch {}

      return {
        pda: teamPda,
        name: team.name,
        agentCount: team.memberCount,
        totalDisbursed: Number(team.totalDisbursed),
        paymentCount: team.paymentCount,
        vault: vaultPda,
        vaultBalance,
      };
    } catch {
      return null;
    }
  }

  /** Get all agents registered to this vault */
  async getAgents(): Promise<AgentInfo[]> {
    const [teamPda] = findTeamPda(this.wallet.publicKey, this.programId);
    const members = await (this.program.account as any).member.all([
      { memcmp: { offset: 8, bytes: teamPda.toBase58() } },
    ]);

    return members.map((m: any) => ({
      pda: m.publicKey,
      wallet: m.account.wallet,
      role: m.account.role,
      ratePerTask: Number(m.account.ratePerDelivery),
      totalSpent: Number(m.account.totalEarned),
      tasksCompleted: m.account.deliveriesCompleted,
      isActive: m.account.isActive,
    }));
  }

  /** Get budget status for a specific agent */
  async getAgentBudget(agentWallet: PublicKey): Promise<BudgetStatus | null> {
    const [teamPda] = findTeamPda(this.wallet.publicKey, this.programId);
    const [memberPda] = findMemberPda(teamPda, agentWallet, this.programId);

    try {
      const member = await (this.program.account as any).member.fetch(
        memberPda
      );
      const [vaultPda] = findVaultPda(teamPda, this.programId);
      let vaultBalance = 0;
      try {
        const bal = await this.connection.getTokenAccountBalance(vaultPda);
        vaultBalance = Number(bal.value.amount);
      } catch {}

      return {
        agent: agentWallet,
        role: member.role,
        limit: Number(member.ratePerDelivery),
        spent: Number(member.totalEarned),
        remaining: vaultBalance,
        isActive: member.isActive,
        tasksCompleted: member.deliveriesCompleted,
      };
    } catch {
      return null;
    }
  }

  /** Get all payment receipts */
  async getReceipts(): Promise<PaymentReceipt[]> {
    const [teamPda] = findTeamPda(this.wallet.publicKey, this.programId);
    const receipts = await (this.program.account as any).paymentRecord.all([
      { memcmp: { offset: 8, bytes: teamPda.toBase58() } },
    ]);

    return receipts.map((r: any) => ({
      pda: r.publicKey,
      recipient: r.account.recipient,
      amount: Number(r.account.amount),
      timestamp: Number(r.account.timestamp),
      memo: r.account.memo,
      isMilestone:
        r.account.milestone.toBase58() !==
        "11111111111111111111111111111111",
    }));
  }

  // ---- Write Operations ----

  /** Create a new agent vault (team + USDC vault) */
  async createVault(name: string): Promise<string> {
    const [teamPda] = findTeamPda(this.wallet.publicKey, this.programId);
    const [vaultPda] = findVaultPda(teamPda, this.programId);

    const sig = await (this.program.methods as any)
      .createTeam(name)
      .accounts({
        creator: this.wallet.publicKey,
        team: teamPda,
        vault: vaultPda,
        mint: USDC_DEVNET,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: PublicKey.default,
      })
      .signers([this.wallet])
      .rpc();

    return sig;
  }

  /** Register an AI agent with a per-task budget limit */
  async registerAgent(
    agentWallet: PublicKey,
    role: string,
    ratePerTask: number
  ): Promise<string> {
    const [teamPda] = findTeamPda(this.wallet.publicKey, this.programId);
    const [memberPda] = findMemberPda(teamPda, agentWallet, this.programId);

    const sig = await (this.program.methods as any)
      .addMember(agentWallet, role, new BN(ratePerTask))
      .accounts({
        creator: this.wallet.publicKey,
        team: teamPda,
        member: memberPda,
        systemProgram: PublicKey.default,
      })
      .signers([this.wallet])
      .rpc();

    return sig;
  }

  /** Fund the vault with USDC */
  async fundVault(amount: number): Promise<string> {
    const [teamPda] = findTeamPda(this.wallet.publicKey, this.programId);
    const [vaultPda] = findVaultPda(teamPda, this.programId);
    const creatorAta = getAssociatedTokenAddressSync(
      USDC_DEVNET,
      this.wallet.publicKey
    );

    const sig = await (this.program.methods as any)
      .fundVault(new BN(amount))
      .accounts({
        creator: this.wallet.publicKey,
        team: teamPda,
        vault: vaultPda,
        creatorTokenAccount: creatorAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([this.wallet])
      .rpc();

    return sig;
  }

  /** Pay an agent directly from the vault (runs connector hooks) */
  async pay(
    agentWallet: PublicKey,
    amount: number,
    memo: string
  ): Promise<PaymentReceipt> {
    // Run connector beforePay hooks — any connector can block
    const preCheck = await this.connectors.runBeforePay(
      agentWallet.toBase58(), amount, memo
    );
    if (!preCheck.allow) {
      throw new Error(
        `Payment blocked by connector '${preCheck.blockedBy}': ${preCheck.reason}`
      );
    }

    const [teamPda] = findTeamPda(this.wallet.publicKey, this.programId);
    const [vaultPda] = findVaultPda(teamPda, this.programId);
    const [memberPda] = findMemberPda(teamPda, agentWallet, this.programId);
    const recipientAta = getAssociatedTokenAddressSync(
      USDC_DEVNET,
      agentWallet
    );

    const teamAccount = await (this.program.account as any).team.fetch(
      teamPda
    );
    const [receiptPda] = findReceiptPda(
      teamPda,
      teamAccount.paymentCount,
      this.programId
    );

    const sig = await (this.program.methods as any)
      .directPay(new BN(amount), memo)
      .accounts({
        creator: this.wallet.publicKey,
        team: teamPda,
        vault: vaultPda,
        member: memberPda,
        contributorTokenAccount: recipientAta,
        receipt: receiptPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: PublicKey.default,
      })
      .signers([this.wallet])
      .rpc();

    const receipt: PaymentReceipt = {
      pda: receiptPda,
      recipient: agentWallet,
      amount,
      timestamp: Math.floor(Date.now() / 1000),
      memo,
      isMilestone: false,
      txSignature: sig,
    };

    // Run connector afterPay hooks (webhooks, analytics, etc.)
    await this.connectors.runAfterPay(receipt);

    return receipt;
  }

  /** Kill switch — deactivate an agent immediately */
  async killAgent(agentWallet: PublicKey): Promise<string> {
    const [teamPda] = findTeamPda(this.wallet.publicKey, this.programId);
    const [memberPda] = findMemberPda(teamPda, agentWallet, this.programId);

    const sig = await (this.program.methods as any)
      .deactivateMember()
      .accounts({
        creator: this.wallet.publicKey,
        team: teamPda,
        member: memberPda,
      })
      .signers([this.wallet])
      .rpc();

    return sig;
  }

  // ---- Helpers ----

  /** Format raw USDC amount to display string */
  formatUsdc(amount: number): string {
    return formatUsdc(amount);
  }
}
