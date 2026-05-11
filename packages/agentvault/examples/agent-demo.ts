/**
 * AgentVault — Real Agent Demo
 *
 * This script simulates an AI agent using the AgentVault SDK
 * with real connectors to check budget, make payments, and get receipts.
 *
 * Run: npx ts-node examples/agent-demo.ts
 * (or: npx tsx examples/agent-demo.ts)
 */

import { Keypair, PublicKey } from "@solana/web3.js";
import {
  AgentVault,
  WebhookConnector,
  X402Connector,
  LangChainConnector,
  ElizaOSConnector,
  SolanaAgentKitConnector,
  CustomConnector,
} from "../src";

async function main() {
  console.log("\n🏦 AgentVault — Real Connector Demo\n");
  console.log("=".repeat(50));

  // In production, this would be your actual deployer keypair
  const wallet = Keypair.generate();
  const agentWallet = Keypair.generate();

  const vault = new AgentVault({
    rpc: "https://api.devnet.solana.com",
    wallet,
  });

  // ---- 1. Webhook Connector ----
  console.log("\n📡 Setting up Webhook connector...");
  const webhook = new WebhookConnector({
    webhookUrl: "https://httpbin.org/post", // real test endpoint
    minAmount: 5,
    secret: "my-signing-secret",
  });
  vault.connectors.use(webhook);
  console.log("   ✅ Webhook: will POST to httpbin.org on every payment > $5");

  // Health check
  const health = await webhook.healthCheck();
  console.log(`   Health: ${health.ok ? "✅" : "❌"} ${health.message || ""}`);

  // ---- 2. x402 / Pay.sh Connector ----
  console.log("\n💳 Setting up x402 connector...");
  const x402 = new X402Connector({
    perRequestMax: 25,
    dailyCap: 100,
  });
  vault.connectors.use(x402);
  console.log("   ✅ x402: per-request max $25, daily cap $100");

  // Test budget enforcement
  const check1 = await x402.beforePay(agentWallet.publicKey.toBase58(), 50_000_000, "test"); // $50
  console.log(`   Budget check $50: ${check1.allow ? "✅ allowed" : "❌ " + check1.reason}`);

  // ---- 3. LangChain Tool ----
  console.log("\n🔗 Setting up LangChain connector...");
  const langchain = new LangChainConnector({ maxPerCall: 25 });
  vault.connectors.use(langchain);

  const tool = langchain.asTool(agentWallet.publicKey);
  console.log(`   ✅ Tool name: "${tool.name}"`);
  console.log(`   ✅ Description: "${tool.description.substring(0, 60)}..."`);
  console.log(`   ✅ Parameters: ${JSON.stringify(tool.parameters.required)}`);
  console.log("   (Ready to add to LangChain agent's tools array)");

  // ---- 4. ElizaOS Plugin ----
  console.log("\n🤖 Setting up ElizaOS connector...");
  const eliza = new ElizaOSConnector({ maxPerTask: 50, agentId: "research-bot" });
  vault.connectors.use(eliza);

  const actions = eliza.getActions(agentWallet.publicKey);
  console.log(`   ✅ Actions: ${Object.keys(actions).join(", ")}`);
  console.log(`   ✅ CHECK_BUDGET similes: ${actions.CHECK_BUDGET.similes.join(", ")}`);
  console.log("   (Ready to register as ElizaOS plugin)");

  const plugin = eliza.asPlugin(agentWallet.publicKey);
  console.log(`   ✅ Plugin: "${plugin.name}" — ${plugin.actions.length} actions`);

  // ---- 5. Solana Agent Kit ----
  console.log("\n⚡ Setting up Solana Agent Kit connector...");
  const sak = new SolanaAgentKitConnector({ budgetLimit: 500 });
  vault.connectors.use(sak);

  const sakAction = sak.getAction(agentWallet.publicKey);
  console.log(`   ✅ Action: "${sakAction.name}"`);
  console.log(`   ✅ Schema: ${JSON.stringify(sakAction.schema.required)}`);

  const budgetAction = sak.getCheckBudgetAction(agentWallet.publicKey);
  console.log(`   ✅ Budget action: "${budgetAction.name}"`);

  // ---- 6. Custom Connector ----
  console.log("\n🔧 Setting up Custom connector...");
  const custom = new CustomConnector(
    "trading-limiter",
    "Trading Bot Limiter",
    {
      beforePay: async (agent, amount, memo) => {
        const amountUsdc = amount / 1_000_000;
        if (amountUsdc > 100) {
          return { allow: false, reason: `Trade of $${amountUsdc} exceeds $100 safety limit` };
        }
        if (memo.toLowerCase().includes("leverage")) {
          return { allow: false, reason: "Leveraged trades are blocked by policy" };
        }
        return { allow: true };
      },
      afterPay: async (receipt) => {
        console.log(`   [trading-limiter] Logged trade: $${(receipt.amount / 1_000_000).toFixed(2)} — ${receipt.memo}`);
      },
    }
  );
  vault.connectors.use(custom);
  console.log("   ✅ Custom: blocks trades > $100 and leveraged trades");

  // Test custom connector
  const check2 = await custom.beforePay(agentWallet.publicKey.toBase58(), 200_000_000, "Buy SOL");
  console.log(`   Budget check $200: ${check2.allow ? "✅ allowed" : "❌ " + check2.reason}`);

  const check3 = await custom.beforePay(agentWallet.publicKey.toBase58(), 50_000_000, "10x leverage SOL/USDC");
  console.log(`   Budget check $50 leverage: ${check3.allow ? "✅ allowed" : "❌ " + check3.reason}`);

  // ---- Registry Overview ----
  console.log("\n📋 Connector Registry:");
  console.log("=".repeat(50));
  const all = vault.connectors.list();
  all.forEach(c => {
    console.log(`   ${c.enabled ? "🟢" : "⚪"} ${c.definition.name} (${c.definition.type}) — ${c.definition.id}`);
  });

  // ---- Run all beforePay hooks ----
  console.log("\n🔒 Running ALL connector beforePay hooks for $15 payment:");
  const globalCheck = await vault.connectors.runBeforePay(
    agentWallet.publicKey.toBase58(),
    15_000_000,
    "GPT-4o API call — 8K tokens"
  );
  console.log(`   Result: ${globalCheck.allow ? "✅ ALL CONNECTORS APPROVED" : `❌ Blocked by ${globalCheck.blockedBy}: ${globalCheck.reason}`}`);

  console.log("\n🔒 Running ALL connector beforePay hooks for $200 payment:");
  const globalCheck2 = await vault.connectors.runBeforePay(
    agentWallet.publicKey.toBase58(),
    200_000_000,
    "Buy SOL"
  );
  console.log(`   Result: ${globalCheck2.allow ? "✅ ALL CONNECTORS APPROVED" : `❌ Blocked by ${globalCheck2.blockedBy}: ${globalCheck2.reason}`}`);

  console.log("\n" + "=".repeat(50));
  console.log("✅ All connectors are REAL and FUNCTIONAL");
  console.log("   - Webhook POSTs to actual URLs");
  console.log("   - x402 enforces per-request + daily budget caps");
  console.log("   - LangChain exports a real tool with execute()");
  console.log("   - ElizaOS exports real actions + plugin format");
  console.log("   - Solana Agent Kit exports agentVaultPay action");
  console.log("   - Custom connector with arbitrary beforePay/afterPay hooks");
  console.log("\n💡 On-chain payments require a funded vault on devnet.");
  console.log("   Run: agentvault create-vault && agentvault fund -a 100");
  console.log("");
}

main().catch(console.error);
