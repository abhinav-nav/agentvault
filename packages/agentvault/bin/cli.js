#!/usr/bin/env node

const { Command } = require("commander");
const chalk = require("chalk");
const fs = require("fs");
const path = require("path");
const { PublicKey, Keypair, Connection, clusterApiUrl } = require("@solana/web3.js");

const CONFIG_FILE = ".agentvault.json";
const PROGRAM_ID = "8g5hMx6AwTUFCrKwuaCfDY468qE4bbHiw8BvdiepUJdo";

const program = new Command();

program
  .name("agentvault")
  .description(
    chalk.green("AgentVault") +
      " — Treasury & budget protocol for autonomous AI agents on Solana"
  )
  .version("0.1.0");

// ---- INIT ----
program
  .command("init")
  .description("Initialize a new AgentVault project")
  .option("-n, --name <name>", "Vault name", "My Agent Swarm")
  .option("-r, --rpc <url>", "Solana RPC endpoint", "https://api.devnet.solana.com")
  .option("-w, --wallet <path>", "Wallet keypair path", "~/.config/solana/id.json")
  .action((opts) => {
    const config = {
      name: opts.name,
      rpc: opts.rpc,
      wallet: opts.wallet,
      programId: PROGRAM_ID,
      connectors: {},
    };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    console.log(chalk.green("✓") + " Initialized AgentVault config");
    console.log(chalk.gray("  Config: ") + CONFIG_FILE);
    console.log(chalk.gray("  Vault:  ") + opts.name);
    console.log(chalk.gray("  RPC:    ") + opts.rpc);
    console.log(chalk.gray("  Wallet: ") + opts.wallet);
    console.log();
    console.log("Next steps:");
    console.log(chalk.cyan("  agentvault create-vault") + "  — deploy your vault on-chain");
    console.log(chalk.cyan("  agentvault register") + "     — add an AI agent");
    console.log(chalk.cyan("  agentvault fund") + "         — deposit USDC");
  });

// ---- STATUS ----
program
  .command("status")
  .description("Show vault status, agents, and balances")
  .action(async () => {
    const config = loadConfig();
    console.log(chalk.green("\n  AgentVault") + chalk.gray(" — " + config.name));
    console.log(chalk.gray("  Program: ") + config.programId);
    console.log(chalk.gray("  RPC:     ") + config.rpc);

    try {
      const { AgentVault } = require("../dist/vault");
      const vault = new AgentVault({
        rpc: config.rpc,
        programId: config.programId,
        wallet: expandPath(config.wallet),
      });

      const team = await vault.getTeam();
      if (!team) {
        console.log(chalk.yellow("\n  No vault found. Run: agentvault create-vault"));
        return;
      }

      console.log(chalk.green("\n  ┌─ Vault ─────────────────────────────┐"));
      console.log(
        chalk.green("  │") +
          `  Balance:  ${chalk.bold.green(vault.formatUsdc(team.vaultBalance))}`.padEnd(46) +
          chalk.green("│")
      );
      console.log(
        chalk.green("  │") +
          `  Agents:   ${team.agentCount}`.padEnd(38) +
          chalk.green("│")
      );
      console.log(
        chalk.green("  │") +
          `  Spent:    ${vault.formatUsdc(team.totalDisbursed)}`.padEnd(38) +
          chalk.green("│")
      );
      console.log(
        chalk.green("  │") +
          `  Payments: ${team.paymentCount}`.padEnd(38) +
          chalk.green("│")
      );
      console.log(chalk.green("  └───────────────────────────────────────┘\n"));

      const agents = await vault.getAgents();
      if (agents.length > 0) {
        console.log(chalk.bold("  Agents:"));
        for (const a of agents) {
          const status = a.isActive
            ? chalk.green("● active")
            : chalk.red("● killed");
          const addr = a.wallet.toBase58();
          console.log(
            `    ${status}  ${chalk.bold(a.role.padEnd(20))} ${chalk.gray(addr.slice(0, 4) + "..." + addr.slice(-4))}  ${chalk.cyan(vault.formatUsdc(a.totalSpent))} spent  ${a.tasksCompleted} tasks`
          );
        }
      }

      // Show connectors
      const connectorConfig = config.connectors || {};
      const connectorIds = Object.keys(connectorConfig);
      if (connectorIds.length > 0) {
        console.log(chalk.bold("\n  Connectors:"));
        for (const id of connectorIds) {
          const c = connectorConfig[id];
          const status = c.enabled
            ? chalk.green("● enabled")
            : chalk.gray("○ disabled");
          console.log(`    ${status}  ${chalk.bold(id)}`);
        }
      }

      console.log();
    } catch (err) {
      console.error(chalk.red("  Error: ") + err.message);
    }
  });

// ---- CREATE VAULT ----
program
  .command("create-vault")
  .description("Deploy a new vault on-chain")
  .option("-n, --name <name>", "Vault name")
  .action(async (opts) => {
    const config = loadConfig();
    const name = opts.name || config.name;
    console.log(chalk.gray(`  Creating vault "${name}"...`));
    try {
      const { AgentVault } = require("../dist/vault");
      const vault = new AgentVault({
        rpc: config.rpc,
        programId: config.programId,
        wallet: expandPath(config.wallet),
      });
      const sig = await vault.createVault(name);
      console.log(chalk.green("  ✓ Vault created!"));
      console.log(chalk.gray("  tx: ") + sig);
    } catch (err) {
      console.error(chalk.red("  Error: ") + err.message);
    }
  });

// ---- REGISTER AGENT ----
program
  .command("register")
  .description("Register an AI agent with a per-task budget")
  .requiredOption("-a, --agent <pubkey>", "Agent wallet public key")
  .requiredOption("-r, --role <role>", "Agent role (e.g. 'Research Agent')")
  .option("-l, --limit <usdc>", "Per-task USDC limit", "25")
  .action(async (opts) => {
    const config = loadConfig();
    const amount = Math.round(parseFloat(opts.limit) * 1_000_000);
    console.log(
      chalk.gray(
        `  Registering "${opts.role}" (${opts.agent.slice(0, 8)}...) with ${opts.limit} USDC/task...`
      )
    );
    try {
      const { AgentVault } = require("../dist/vault");
      const vault = new AgentVault({
        rpc: config.rpc,
        programId: config.programId,
        wallet: expandPath(config.wallet),
      });
      const sig = await vault.registerAgent(
        new PublicKey(opts.agent),
        opts.role,
        amount
      );
      console.log(chalk.green("  ✓ Agent registered!"));
      console.log(chalk.gray("  tx: ") + sig);
    } catch (err) {
      console.error(chalk.red("  Error: ") + err.message);
    }
  });

// ---- FUND ----
program
  .command("fund")
  .description("Deposit USDC into the vault")
  .requiredOption("-a, --amount <usdc>", "Amount in USDC")
  .action(async (opts) => {
    const config = loadConfig();
    const amount = Math.round(parseFloat(opts.amount) * 1_000_000);
    console.log(chalk.gray(`  Funding vault with $${opts.amount} USDC...`));
    try {
      const { AgentVault } = require("../dist/vault");
      const vault = new AgentVault({
        rpc: config.rpc,
        programId: config.programId,
        wallet: expandPath(config.wallet),
      });
      const sig = await vault.fundVault(amount);
      console.log(chalk.green("  ✓ Vault funded!"));
      console.log(chalk.gray("  tx: ") + sig);
    } catch (err) {
      console.error(chalk.red("  Error: ") + err.message);
    }
  });

// ---- PAY ----
program
  .command("pay")
  .description("Pay an agent from the vault")
  .requiredOption("-a, --agent <pubkey>", "Agent wallet public key")
  .requiredOption("-u, --amount <usdc>", "Amount in USDC")
  .option("-m, --memo <memo>", "Payment memo", "Direct payment")
  .action(async (opts) => {
    const config = loadConfig();
    const amount = Math.round(parseFloat(opts.amount) * 1_000_000);
    console.log(
      chalk.gray(`  Paying ${opts.agent.slice(0, 8)}... $${opts.amount} USDC...`)
    );
    try {
      const { AgentVault } = require("../dist/vault");
      const vault = new AgentVault({
        rpc: config.rpc,
        programId: config.programId,
        wallet: expandPath(config.wallet),
      });
      const receipt = await vault.pay(new PublicKey(opts.agent), amount, opts.memo);
      console.log(chalk.green("  ✓ Payment sent!"));
      console.log(chalk.gray("  tx:      ") + receipt.txSignature);
      console.log(chalk.gray("  receipt: ") + receipt.pda.toBase58());
    } catch (err) {
      console.error(chalk.red("  Error: ") + err.message);
    }
  });

// ---- KILL ----
program
  .command("kill")
  .description("Kill switch — deactivate an agent immediately")
  .requiredOption("-a, --agent <pubkey>", "Agent wallet public key")
  .action(async (opts) => {
    const config = loadConfig();
    console.log(chalk.red(`  ⚠ Killing agent ${opts.agent.slice(0, 8)}...`));
    try {
      const { AgentVault } = require("../dist/vault");
      const vault = new AgentVault({
        rpc: config.rpc,
        programId: config.programId,
        wallet: expandPath(config.wallet),
      });
      const sig = await vault.killAgent(new PublicKey(opts.agent));
      console.log(chalk.red("  ✓ Agent deactivated!"));
      console.log(chalk.gray("  tx: ") + sig);
    } catch (err) {
      console.error(chalk.red("  Error: ") + err.message);
    }
  });

// ---- CONNECTOR ADD ----
program
  .command("connector:add")
  .description("Add a connector (built-in or custom)")
  .requiredOption("-i, --id <id>", "Connector ID (e.g. elizaos, x402, or custom-mybot)")
  .option("-n, --name <name>", "Connector name (for custom)")
  .option("-t, --type <type>", "Type: ai-framework | payment-rail | monitoring | custom", "custom")
  .option("-c, --config <json>", "Config as JSON string", "{}")
  .action((opts) => {
    const config = loadConfig();
    const connConfig = JSON.parse(opts.config);
    config.connectors = config.connectors || {};
    config.connectors[opts.id] = {
      name: opts.name || opts.id,
      type: opts.type,
      config: connConfig,
      enabled: true,
    };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    console.log(chalk.green("  ✓") + ` Connector '${opts.id}' added and enabled`);
    if (Object.keys(connConfig).length > 0) {
      console.log(chalk.gray("  Config: ") + JSON.stringify(connConfig));
    }
  });

// ---- CONNECTOR CONFIG ----
program
  .command("connector:config")
  .description("Update connector configuration")
  .requiredOption("-i, --id <id>", "Connector ID")
  .requiredOption("-c, --config <json>", "Config as JSON string")
  .action((opts) => {
    const config = loadConfig();
    if (!config.connectors?.[opts.id]) {
      console.error(chalk.red(`  Connector '${opts.id}' not found`));
      return;
    }
    const newConfig = JSON.parse(opts.config);
    config.connectors[opts.id].config = {
      ...config.connectors[opts.id].config,
      ...newConfig,
    };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    console.log(chalk.green("  ✓") + ` Connector '${opts.id}' updated`);
    console.log(chalk.gray("  Config: ") + JSON.stringify(config.connectors[opts.id].config));
  });

// ---- CONNECTOR LIST ----
program
  .command("connector:list")
  .description("List all connectors")
  .action(() => {
    const config = loadConfig();
    const connectors = config.connectors || {};
    const ids = Object.keys(connectors);
    if (ids.length === 0) {
      console.log(chalk.gray("  No connectors configured."));
      console.log(chalk.gray("  Built-in options: elizaos, solana-agent-kit, x402, langchain, webhook"));
      console.log(chalk.cyan("  agentvault connector:add -i elizaos -c '{\"agentId\":\"my-agent\"}'"));
      return;
    }
    console.log(chalk.bold("\n  Connectors:\n"));
    for (const id of ids) {
      const c = connectors[id];
      const status = c.enabled ? chalk.green("●") : chalk.gray("○");
      console.log(`  ${status} ${chalk.bold(id.padEnd(22))} ${chalk.gray(c.type || "custom")}`);
      if (c.config && Object.keys(c.config).length > 0) {
        for (const [k, v] of Object.entries(c.config)) {
          console.log(chalk.gray(`      ${k}: `) + String(v));
        }
      }
    }
    console.log();
  });

// ---- CONNECTOR REMOVE ----
program
  .command("connector:remove")
  .description("Remove a connector")
  .requiredOption("-i, --id <id>", "Connector ID")
  .action((opts) => {
    const config = loadConfig();
    if (config.connectors?.[opts.id]) {
      delete config.connectors[opts.id];
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
      console.log(chalk.green("  ✓") + ` Connector '${opts.id}' removed`);
    } else {
      console.error(chalk.red(`  Connector '${opts.id}' not found`));
    }
  });

// ---- RECEIPTS ----
program
  .command("receipts")
  .description("Show on-chain payment receipts")
  .option("-l, --limit <n>", "Number of receipts to show", "10")
  .action(async (opts) => {
    const config = loadConfig();
    try {
      const { AgentVault } = require("../dist/vault");
      const vault = new AgentVault({
        rpc: config.rpc,
        programId: config.programId,
        wallet: expandPath(config.wallet),
      });
      const receipts = await vault.getReceipts();
      const sorted = receipts
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, parseInt(opts.limit));

      if (sorted.length === 0) {
        console.log(chalk.gray("  No receipts yet."));
        return;
      }

      console.log(chalk.bold("\n  Recent Payments:\n"));
      for (const r of sorted) {
        const addr = r.recipient.toBase58();
        const time = new Date(r.timestamp * 1000).toLocaleString();
        const tag = r.isMilestone ? chalk.yellow(" [milestone]") : "";
        console.log(
          `  ${chalk.green(vault.formatUsdc(r.amount).padEnd(12))} → ${chalk.gray(addr.slice(0, 4) + "..." + addr.slice(-4))}  ${r.memo}${tag}`
        );
        console.log(chalk.gray(`${"".padEnd(14)}${time}  ${r.pda.toBase58().slice(0, 12)}...\n`));
      }
    } catch (err) {
      console.error(chalk.red("  Error: ") + err.message);
    }
  });

// ---- Helpers ----

function loadConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    console.error(
      chalk.red("  No .agentvault.json found. Run: agentvault init")
    );
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
}

function expandPath(p) {
  if (p.startsWith("~")) {
    return path.join(require("os").homedir(), p.slice(1));
  }
  return p;
}

program.parse();
