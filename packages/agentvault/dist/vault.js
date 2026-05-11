"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentVault = void 0;
const web3_js_1 = require("@solana/web3.js");
const spl_token_1 = require("@solana/spl-token");
const anchor_1 = require("@coral-xyz/anchor");
const fs = __importStar(require("fs"));
const pda_1 = require("./pda");
const connectors_1 = require("./connectors");
const idl_json_1 = __importDefault(require("./idl.json"));
class AgentVault {
    constructor(config) {
        this.connection = new web3_js_1.Connection(config.rpc, "confirmed");
        this.programId = config.programId
            ? new web3_js_1.PublicKey(config.programId)
            : pda_1.DEFAULT_PROGRAM_ID;
        // Load wallet
        if (typeof config.wallet === "string") {
            const raw = JSON.parse(fs.readFileSync(config.wallet, "utf-8"));
            this.wallet = web3_js_1.Keypair.fromSecretKey(Uint8Array.from(raw));
        }
        else {
            this.wallet = config.wallet;
        }
        // Setup Anchor provider
        const provider = new anchor_1.AnchorProvider(this.connection, {
            publicKey: this.wallet.publicKey,
            signTransaction: async (tx) => {
                if (tx instanceof web3_js_1.Transaction) {
                    tx.partialSign(this.wallet);
                }
                return tx;
            },
            signAllTransactions: async (txs) => {
                txs.forEach((tx) => {
                    if (tx instanceof web3_js_1.Transaction)
                        tx.partialSign(this.wallet);
                });
                return txs;
            },
        }, { preflightCommitment: "confirmed" });
        this.program = new anchor_1.Program(idl_json_1.default, provider);
        this.connectors = new connectors_1.ConnectorRegistry();
        this.connectors.attachVault(this);
    }
    // ---- Read Operations ----
    /** Get team info for the current wallet */
    async getTeam() {
        const [teamPda] = (0, pda_1.findTeamPda)(this.wallet.publicKey, this.programId);
        try {
            const team = await this.program.account.team.fetch(teamPda);
            const [vaultPda] = (0, pda_1.findVaultPda)(teamPda, this.programId);
            let vaultBalance = 0;
            try {
                const bal = await this.connection.getTokenAccountBalance(vaultPda);
                vaultBalance = Number(bal.value.amount);
            }
            catch { }
            return {
                pda: teamPda,
                name: team.name,
                agentCount: team.memberCount,
                totalDisbursed: Number(team.totalDisbursed),
                paymentCount: team.paymentCount,
                vault: vaultPda,
                vaultBalance,
            };
        }
        catch {
            return null;
        }
    }
    /** Get all agents registered to this vault */
    async getAgents() {
        const [teamPda] = (0, pda_1.findTeamPda)(this.wallet.publicKey, this.programId);
        const members = await this.program.account.member.all([
            { memcmp: { offset: 8, bytes: teamPda.toBase58() } },
        ]);
        return members.map((m) => ({
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
    async getAgentBudget(agentWallet) {
        const [teamPda] = (0, pda_1.findTeamPda)(this.wallet.publicKey, this.programId);
        const [memberPda] = (0, pda_1.findMemberPda)(teamPda, agentWallet, this.programId);
        try {
            const member = await this.program.account.member.fetch(memberPda);
            const [vaultPda] = (0, pda_1.findVaultPda)(teamPda, this.programId);
            let vaultBalance = 0;
            try {
                const bal = await this.connection.getTokenAccountBalance(vaultPda);
                vaultBalance = Number(bal.value.amount);
            }
            catch { }
            return {
                agent: agentWallet,
                role: member.role,
                limit: Number(member.ratePerDelivery),
                spent: Number(member.totalEarned),
                remaining: vaultBalance,
                isActive: member.isActive,
                tasksCompleted: member.deliveriesCompleted,
            };
        }
        catch {
            return null;
        }
    }
    /** Get all payment receipts */
    async getReceipts() {
        const [teamPda] = (0, pda_1.findTeamPda)(this.wallet.publicKey, this.programId);
        const receipts = await this.program.account.paymentRecord.all([
            { memcmp: { offset: 8, bytes: teamPda.toBase58() } },
        ]);
        return receipts.map((r) => ({
            pda: r.publicKey,
            recipient: r.account.recipient,
            amount: Number(r.account.amount),
            timestamp: Number(r.account.timestamp),
            memo: r.account.memo,
            isMilestone: r.account.milestone.toBase58() !==
                "11111111111111111111111111111111",
        }));
    }
    // ---- Write Operations ----
    /** Create a new agent vault (team + USDC vault) */
    async createVault(name) {
        const [teamPda] = (0, pda_1.findTeamPda)(this.wallet.publicKey, this.programId);
        const [vaultPda] = (0, pda_1.findVaultPda)(teamPda, this.programId);
        const sig = await this.program.methods
            .createTeam(name)
            .accounts({
            creator: this.wallet.publicKey,
            team: teamPda,
            vault: vaultPda,
            mint: pda_1.USDC_DEVNET,
            tokenProgram: spl_token_1.TOKEN_PROGRAM_ID,
            systemProgram: web3_js_1.PublicKey.default,
        })
            .signers([this.wallet])
            .rpc();
        return sig;
    }
    /** Register an AI agent with a per-task budget limit */
    async registerAgent(agentWallet, role, ratePerTask) {
        const [teamPda] = (0, pda_1.findTeamPda)(this.wallet.publicKey, this.programId);
        const [memberPda] = (0, pda_1.findMemberPda)(teamPda, agentWallet, this.programId);
        const sig = await this.program.methods
            .addMember(agentWallet, role, new anchor_1.BN(ratePerTask))
            .accounts({
            creator: this.wallet.publicKey,
            team: teamPda,
            member: memberPda,
            systemProgram: web3_js_1.PublicKey.default,
        })
            .signers([this.wallet])
            .rpc();
        return sig;
    }
    /** Fund the vault with USDC */
    async fundVault(amount) {
        const [teamPda] = (0, pda_1.findTeamPda)(this.wallet.publicKey, this.programId);
        const [vaultPda] = (0, pda_1.findVaultPda)(teamPda, this.programId);
        const creatorAta = (0, spl_token_1.getAssociatedTokenAddressSync)(pda_1.USDC_DEVNET, this.wallet.publicKey);
        const sig = await this.program.methods
            .fundVault(new anchor_1.BN(amount))
            .accounts({
            creator: this.wallet.publicKey,
            team: teamPda,
            vault: vaultPda,
            creatorTokenAccount: creatorAta,
            tokenProgram: spl_token_1.TOKEN_PROGRAM_ID,
        })
            .signers([this.wallet])
            .rpc();
        return sig;
    }
    /** Pay an agent directly from the vault (runs connector hooks) */
    async pay(agentWallet, amount, memo) {
        // Run connector beforePay hooks — any connector can block
        const preCheck = await this.connectors.runBeforePay(agentWallet.toBase58(), amount, memo);
        if (!preCheck.allow) {
            throw new Error(`Payment blocked by connector '${preCheck.blockedBy}': ${preCheck.reason}`);
        }
        const [teamPda] = (0, pda_1.findTeamPda)(this.wallet.publicKey, this.programId);
        const [vaultPda] = (0, pda_1.findVaultPda)(teamPda, this.programId);
        const [memberPda] = (0, pda_1.findMemberPda)(teamPda, agentWallet, this.programId);
        const recipientAta = (0, spl_token_1.getAssociatedTokenAddressSync)(pda_1.USDC_DEVNET, agentWallet);
        const teamAccount = await this.program.account.team.fetch(teamPda);
        const [receiptPda] = (0, pda_1.findReceiptPda)(teamPda, teamAccount.paymentCount, this.programId);
        const sig = await this.program.methods
            .directPay(new anchor_1.BN(amount), memo)
            .accounts({
            creator: this.wallet.publicKey,
            team: teamPda,
            vault: vaultPda,
            member: memberPda,
            contributorTokenAccount: recipientAta,
            receipt: receiptPda,
            tokenProgram: spl_token_1.TOKEN_PROGRAM_ID,
            systemProgram: web3_js_1.PublicKey.default,
        })
            .signers([this.wallet])
            .rpc();
        const receipt = {
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
    async killAgent(agentWallet) {
        const [teamPda] = (0, pda_1.findTeamPda)(this.wallet.publicKey, this.programId);
        const [memberPda] = (0, pda_1.findMemberPda)(teamPda, agentWallet, this.programId);
        const sig = await this.program.methods
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
    formatUsdc(amount) {
        return (0, pda_1.formatUsdc)(amount);
    }
}
exports.AgentVault = AgentVault;
//# sourceMappingURL=vault.js.map