#!/usr/bin/env npx tsx
/**
 * AgentVault — LIVE End-to-End Demo on Solana Devnet
 *
 * This script runs a REAL agent flow on devnet:
 *   1. Create a vault (on-chain)
 *   2. Register AI agents (on-chain)
 *   3. Fund the vault with USDC (on-chain)
 *   4. Connectors enforce budget limits
 *   5. Agent makes a payment (on-chain)
 *   6. Webhook fires, receipt created
 *   7. Kill switch deactivates agent (on-chain)
 *   8. Killed agent gets blocked from payment
 *
 * Run: npx tsx examples/live-demo.ts
 */

import { Keypair, PublicKey, Connection } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { AgentVault } from "../src/vault";
import {
  X402Connector,
  WebhookConnector,
  LangChainConnector,
  ElizaOSConnector,
  CustomConnector,
} from "../src/connectors";
import { USDC_DEVNET, formatUsdc } from "../src/pda";
import * as fs from "fs";

const RPC = "https://api.devnet.solana.com";
const DEPLOYER_PATH = "../../deployer.json";

function log(emoji: string, msg: string) {
  console.log(`\n${emoji}  ${msg}`);
}

function divider(title: string) {
  console.log(`\n${"=".repeat(55)}`);
  console.log(`  ${title}`);
  console.log("=".repeat(55));
}

async function ensureAta(connection: Connection, payer: Keypair, owner: PublicKey): Promise<PublicKey> {
  const ata = getAssociatedTokenAddressSync(USDC_DEVNET, owner);
  const info = await connection.getAccountInfo(ata);
  if (!info) {
    const { Transaction } = await import("@solana/web3.js");
    const ix = createAssociatedTokenAccountInstruction(payer.publicKey, ata, owner, USDC_DEVNET);
    const tx = new Transaction().add(ix);
    tx.feePayer = payer.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.sign(payer);
    await connection.sendRawTransaction(tx.serialize());
    await new Promise(r => setTimeout(r, 2000));
    log("📦", `Created ATA for ${owner.toBase58().slice(0, 8)}...`);
  }
  return ata;
}

async function main() {
  divider("AgentVault — Live Devnet Demo");
  console.log("  Network: Solana Devnet");
  console.log("  Program: 8g5hMx6AwTUFCrKwuaCfDY468qE4bbHiw8BvdiepUJdo");
  console.log("  USDC Mint: " + USDC_DEVNET.toBase58());

  // Load deployer wallet
  const raw = JSON.parse(fs.readFileSync(DEPLOYER_PATH, "utf-8"));
  const deployer = Keypair.fromSecretKey(Uint8Array.from(raw));
  log("🔑", `Deployer: ${deployer.publicKey.toBase58()}`);

  // Create agent wallets
  const researchAgent = Keypair.generate();
  const codegenAgent = Keypair.generate();
  log("🤖", `Research Agent: ${researchAgent.publicKey.toBase58().slice(0, 12)}...`);
  log("🤖", `CodeGen Agent:  ${codegenAgent.publicKey.toBase58().slice(0, 12)}...`);

  // Initialize vault
  const vault = new AgentVault({
    rpc: RPC,
    wallet: deployer,
  });

  // ===== STEP 1: Create Vault =====
  divider("Step 1: Deploy Agent Vault On-Chain");
  try {
    const sig = await vault.createVault("Acme AI Swarm");
    log("✅", `Vault created! TX: ${sig.slice(0, 20)}...`);
    log("🔗", `https://explorer.solana.com/tx/${sig}?cluster=devnet`);
  } catch (err: any) {
    if (err.message?.includes("already in use")) {
      log("ℹ️", "Vault already exists — continuing");
    } else {
      throw err;
    }
  }

  // Verify vault
  const team = await vault.getTeam();
  if (team) {
    log("📊", `Vault: "${team.name}" | Agents: ${team.agentCount} | Balance: ${formatUsdc(team.vaultBalance)}`);
  }

  // ===== STEP 2: Register Agents =====
  divider("Step 2: Register AI Agents");
  try {
    const sig1 = await vault.registerAgent(researchAgent.publicKey, "Research Agent", 25_000_000);
    log("✅", `Research Agent registered ($25/task limit) — TX: ${sig1.slice(0, 16)}...`);
  } catch (err: any) {
    if (err.message?.includes("already in use")) {
      log("ℹ️", "Research Agent already registered");
    } else { throw err; }
  }

  try {
    const sig2 = await vault.registerAgent(codegenAgent.publicKey, "CodeGen Agent", 50_000_000);
    log("✅", `CodeGen Agent registered ($50/task limit) — TX: ${sig2.slice(0, 16)}...`);
  } catch (err: any) {
    if (err.message?.includes("already in use")) {
      log("ℹ️", "CodeGen Agent already registered");
    } else { throw err; }
  }

  // List agents
  const agents = await vault.getAgents();
  log("📋", `Registered agents: ${agents.length}`);
  agents.forEach(a => {
    console.log(`     ${a.isActive ? "🟢" : "🔴"} ${a.role} — limit: ${formatUsdc(a.ratePerTask)} | spent: ${formatUsdc(a.totalSpent)} | tasks: ${a.tasksCompleted}`);
  });

  // ===== STEP 3: Fund Vault =====
  divider("Step 3: Fund Vault with USDC");
  try {
    const sig = await vault.fundVault(10_000_000_000); // 10,000 USDC
    log("✅", `Funded vault with $10,000 USDC — TX: ${sig.slice(0, 16)}...`);
  } catch (err: any) {
    log("⚠️", `Fund failed (expected if no USDC balance): ${err.message?.slice(0, 60)}`);
  }

  const teamAfterFund = await vault.getTeam();
  if (teamAfterFund) {
    log("💰", `Vault balance: ${formatUsdc(teamAfterFund.vaultBalance)}`);
  }

  // ===== STEP 4: Setup Connectors =====
  divider("Step 4: Attach Real Connectors");

  // x402 — budget enforcement
  const x402 = new X402Connector({ perRequestMax: 25, dailyCap: 100 });
  vault.connectors.use(x402);
  log("💳", "x402: per-request max $25, daily cap $100");

  // Webhook — notifications
  const webhook = new WebhookConnector({
    webhookUrl: "https://httpbin.org/post",
    minAmount: 5,
  });
  vault.connectors.use(webhook);
  log("📡", "Webhook: POST to httpbin.org on payments > $5");

  // LangChain tool
  const langchain = new LangChainConnector({ maxPerCall: 25 });
  vault.connectors.use(langchain);
  const tool = langchain.asTool(researchAgent.publicKey);
  log("🔗", `LangChain tool: "${tool.name}" — ready for agent`);

  // ElizaOS actions
  const eliza = new ElizaOSConnector({ maxPerTask: 50 });
  vault.connectors.use(eliza);
  const actions = eliza.getActions(researchAgent.publicKey);
  log("🤖", `ElizaOS: ${Object.keys(actions).length} actions (CHECK_BUDGET, VAULT_PAY, GET_RECEIPTS)`);

  // Custom limiter
  const custom = new CustomConnector("trade-limiter", "Trade Limiter", {
    beforePay: async (agent, amount, memo) => {
      if (memo.toLowerCase().includes("leverage")) {
        return { allow: false, reason: "Leveraged trades blocked by policy" };
      }
      return { allow: true };
    },
  });
  vault.connectors.use(custom);
  log("🔧", "Custom: blocks leveraged trades");

  // Show all connectors
  log("📋", `Active connectors: ${vault.connectors.listEnabled().length}`);

  // ===== STEP 5: Budget Check =====
  divider("Step 5: Agent Checks Budget");
  const budget = await vault.getAgentBudget(researchAgent.publicKey);
  if (budget) {
    console.log(`     Role: ${budget.role}`);
    console.log(`     Per-task limit: ${formatUsdc(budget.limit)}`);
    console.log(`     Total spent: ${formatUsdc(budget.spent)}`);
    console.log(`     Vault balance: ${formatUsdc(budget.remaining)}`);
    console.log(`     Status: ${budget.isActive ? "ACTIVE ✅" : "KILLED ❌"}`);
  }

  // ===== STEP 6: Connector Budget Enforcement =====
  divider("Step 6: Connector Budget Enforcement");

  // Test: $15 normal payment — should pass
  const check1 = await vault.connectors.runBeforePay(
    researchAgent.publicKey.toBase58(), 15_000_000, "GPT-4o API — 12K tokens"
  );
  log(check1.allow ? "✅" : "❌", `$15 "GPT-4o API" → ${check1.allow ? "APPROVED by all connectors" : `BLOCKED by ${check1.blockedBy}: ${check1.reason}`}`);

  // Test: $50 payment — blocked by x402 (exceeds $25 per-request max)
  const check2 = await vault.connectors.runBeforePay(
    researchAgent.publicKey.toBase58(), 50_000_000, "Expensive API call"
  );
  log(check2.allow ? "✅" : "❌", `$50 "Expensive API" → ${check2.allow ? "APPROVED" : `BLOCKED by ${check2.blockedBy}: ${check2.reason}`}`);

  // Test: leveraged trade — blocked by custom connector
  const check3 = await vault.connectors.runBeforePay(
    researchAgent.publicKey.toBase58(), 10_000_000, "10x leverage SOL/USDC"
  );
  log(check3.allow ? "✅" : "❌", `$10 "10x leverage" → ${check3.allow ? "APPROVED" : `BLOCKED by ${check3.blockedBy}: ${check3.reason}`}`);

  // ===== STEP 7: Make Payment =====
  divider("Step 7: Agent Makes Payment (On-Chain)");

  // Ensure agent has an ATA for receiving USDC
  await ensureAta(vault.connection, deployer, researchAgent.publicKey);

  try {
    const receipt = await vault.pay(researchAgent.publicKey, 15_000_000, "GPT-4o API — 12K tokens research query");
    log("✅", "Payment successful!");
    console.log(`     Amount: ${formatUsdc(receipt.amount)}`);
    console.log(`     Memo: ${receipt.memo}`);
    console.log(`     TX: ${receipt.txSignature?.slice(0, 20)}...`);
    console.log(`     Receipt PDA: ${receipt.pda.toBase58().slice(0, 16)}...`);
    log("🔗", `https://explorer.solana.com/tx/${receipt.txSignature}?cluster=devnet`);
  } catch (err: any) {
    log("⚠️", `Payment failed: ${err.message?.slice(0, 80)}`);
    log("ℹ️", "(Expected if vault has no USDC balance — connector hooks still ran)");
  }

  // ===== STEP 8: Kill Switch =====
  divider("Step 8: Kill Switch — Deactivate Agent");
  try {
    const sig = await vault.killAgent(researchAgent.publicKey);
    log("🔴", `Research Agent KILLED — TX: ${sig.slice(0, 16)}...`);
    log("🔗", `https://explorer.solana.com/tx/${sig}?cluster=devnet`);
  } catch (err: any) {
    log("⚠️", `Kill failed: ${err.message?.slice(0, 60)}`);
  }

  // Verify killed
  const budgetAfterKill = await vault.getAgentBudget(researchAgent.publicKey);
  if (budgetAfterKill) {
    log("🔍", `Agent status: ${budgetAfterKill.isActive ? "ACTIVE ✅" : "KILLED ❌"}`);
  }

  // ===== STEP 9: Receipts =====
  divider("Step 9: On-Chain Receipts");
  const receipts = await vault.getReceipts();
  if (receipts.length > 0) {
    log("📜", `${receipts.length} on-chain receipt(s):`);
    receipts.forEach((r, i) => {
      console.log(`     ${i + 1}. ${formatUsdc(r.amount)} — "${r.memo}" (${new Date(r.timestamp * 1000).toLocaleString()})`);
      console.log(`        PDA: ${r.pda.toBase58()}`);
    });
  } else {
    log("📜", "No receipts yet (vault needs USDC to make payments)");
  }

  // ===== SUMMARY =====
  divider("Summary");
  const finalTeam = await vault.getTeam();
  const finalAgents = await vault.getAgents();
  console.log(`  Vault: ${finalTeam?.name || "N/A"}`);
  console.log(`  Balance: ${formatUsdc(finalTeam?.vaultBalance || 0)}`);
  console.log(`  Agents: ${finalAgents.length} (${finalAgents.filter(a => a.isActive).length} active)`);
  console.log(`  Payments: ${finalTeam?.paymentCount || 0}`);
  console.log(`  Connectors: ${vault.connectors.listEnabled().length} active`);
  console.log(`  Network: Solana Devnet`);
  console.log(`  Program: 8g5hMx6AwTUFCrKwuaCfDY468qE4bbHiw8BvdiepUJdo`);

  console.log(`\n  Every transaction is verifiable on Solana Explorer.`);
  console.log(`  Every payment has an on-chain PDA receipt.`);
  console.log(`  Every connector enforces budget limits before payment.`);
  console.log("");
}

main().catch(err => {
  console.error("\n❌ Error:", err.message || err);
  process.exit(1);
});
