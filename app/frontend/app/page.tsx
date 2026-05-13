"use client";

import { useState } from "react";
import { WalletProvider, useWallet } from "./components/WalletProvider";
import ConnectButton from "./components/ConnectButton";
import DemoDashboard from "./components/DemoDashboard";

const PROGRAM_ID = "8g5hMx6AwTUFCrKwuaCfDY468qE4bbHiw8BvdiepUJdo";

const DEVNET_TXS = [
  { label: "Vault Created", tx: "4moZJ3iiiBE6h12wXSBqUh12m3AVz1sCbUgW9t41CLw4AN4FqibDPgGoeTRWpi6LxwG1pezkdFkXubEpLGM3joYU" },
  { label: "Agent Registered", tx: "51BVd89Rx2RJ5bh7SrF2Y7kkH5CpQx4WXiW3BhSJm65FkrfvZ6p4sVm1pQ6gxT1TsVAQsQq16kucFZi2nXgVhC5" },
  { label: "Vault Funded ($10,000 USDC)", tx: "447VF1BLWu6Twb2zdLDFnm6nzWN9d7RWp3jrNjhc5Yj6K5XVQV1TgP1hqaFxNBxPKHa2kxjZCZYfmchsWvqJzC" },
  { label: "Agent Payment ($15 USDC)", tx: "4XbQWg7oVTjqtkRLYajFyubMNKz7sM5Jqm96saevjVdxvcxsdxk8yZsSmhFmJtLdp33fsDwWgdCQDX7EM1zsFeSu" },
  { label: "Kill Switch Activated", tx: "2cX9ZtuvD23P8CUJPbiY8JTurx1QKkyBULmA4GKigoyBjKQKvvoocAyrUNDsbmpviRD1KSBBBfEYx5w92ENuVpuj" },
];

function LandingPage({ onLaunchDemo }: { onLaunchDemo: () => void }) {
  return (
    <div className="space-y-24 pb-20 animate-fade-in">
      {/* Hero */}
      <section className="flex flex-col items-center text-center pt-12 sm:pt-20 gap-6">
        <div className="inline-flex items-center gap-2 bg-accent/10 text-accent text-xs font-medium px-4 py-1.5 rounded-full border border-accent/20">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          Live on Solana Devnet
        </div>

        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1]">
          Budget control for
          <br />
          <span className="text-accent">autonomous agents</span>
        </h1>

        <p className="text-muted text-base sm:text-lg max-w-2xl leading-relaxed">
          Give your AI agents a USDC treasury with per-task spending limits,
          a kill switch, and on-chain receipts for every transaction.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3 mt-2">
          <button
            onClick={onLaunchDemo}
            className="bg-accent text-black font-semibold px-8 py-3 rounded-xl hover:bg-accent-dim transition-colors text-sm"
          >
            Launch Dashboard
          </button>
          <a
            href={`https://github.com/abhinav-nav/agentvault`}
            target="_blank"
            rel="noopener noreferrer"
            className="border border-border text-foreground font-medium px-8 py-3 rounded-xl hover:border-accent/40 hover:text-accent transition-colors text-sm"
          >
            View on GitHub
          </a>
        </div>

        {/* Terminal preview */}
        <div className="w-full max-w-2xl mt-8">
          <div className="bg-[#0d0d0d] border border-border rounded-xl overflow-hidden shadow-2xl">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
                <div className="w-3 h-3 rounded-full bg-[#28c840]" />
              </div>
              <span className="text-[10px] text-muted ml-2 font-mono">agentvault</span>
            </div>
            <pre className="p-4 text-xs sm:text-sm font-mono leading-relaxed overflow-x-auto" style={{ color: "#a6e3a1" }}>
{`$ agentvault create-vault --name "AI Swarm Alpha"
  Vault created on Solana devnet

$ agentvault register -r "Research Agent" -l 50
  Agent registered with $50/task budget

$ agentvault fund -a 10000
  Deposited $10,000.00 USDC into vault

$ agentvault pay -u 25 -m "GPT-4o API batch"
  Payment sent. TX: 4XbQWg...sFeSu
  On-chain receipt: DEBc2T...Qt7V

$ agentvault kill -a 7nYBm2...
  Agent deactivated. Access revoked.`}
            </pre>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-5xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12">How it works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { num: "01", title: "Create Vault", desc: "Deploy a USDC treasury on Solana. One vault, multiple agents.", icon: "vault" },
            { num: "02", title: "Register Agents", desc: "Add agent wallets with per-task spending limits and roles.", icon: "agent" },
            { num: "03", title: "Connect", desc: "Plug in ElizaOS, Agent Kit, x402, LangChain, or your own connector.", icon: "plug" },
            { num: "04", title: "Monitor", desc: "Track spending, approve milestones, kill rogue agents instantly.", icon: "shield" },
          ].map((step) => (
            <div key={step.num} className="group relative bg-surface border border-border rounded-2xl p-6 hover:border-accent/30 transition-all">
              <div className="text-accent/30 text-5xl font-bold absolute top-4 right-5 group-hover:text-accent/50 transition-colors">
                {step.num}
              </div>
              <div className="mt-8 space-y-2">
                <h3 className="font-semibold text-lg">{step.title}</h3>
                <p className="text-sm text-muted leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Architecture */}
      <section className="max-w-4xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-4">Architecture</h2>
        <p className="text-muted text-center text-sm mb-8">Every payment runs through connector hooks before hitting the chain</p>
        <div className="bg-[#0d0d0d] border border-border rounded-2xl p-6 sm:p-8 overflow-x-auto">
          <pre className="text-xs sm:text-sm font-mono leading-relaxed whitespace-pre" style={{ color: "#a6e3a1" }}>
{`  Agent calls vault.pay(wallet, amount, memo)
          |
          v
  +-- beforePay() hooks -------------------------+
  |  x402: check per-request + daily cap         |
  |  ElizaOS: verify task authorization           |  <-- ANY connector
  |  Custom: your own budget logic                |      can BLOCK
  +----------------------------------------------+
          |  all approved
          v
  +-- ON-CHAIN (Solana) -------------------------+
  |  directPay instruction                        |
  |  USDC transfer from vault PDA                 |
  |  PaymentRecord PDA created (receipt)          |
  +----------------------------------------------+
          |  success
          v
  +-- afterPay() hooks --------------------------+
  |  Webhook: POST to your URL                    |
  |  Analytics: log to dashboard                  |
  |  x402: update daily spend tracker             |
  +----------------------------------------------+`}
          </pre>
        </div>
      </section>

      {/* Features grid */}
      <section className="max-w-5xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12">Built for agent developers</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <FeatureCard
            icon="&#x1F3E6;"
            title="USDC Treasury"
            desc="Deploy a vault on Solana. Fund it once, agents draw from it. Full SPL token support."
          />
          <FeatureCard
            icon="&#x1F4B0;"
            title="Per-Agent Budgets"
            desc="Set max spend per task for each agent. Connector hooks enforce limits before every payment."
          />
          <FeatureCard
            icon="&#x1F6E1;"
            title="Kill Switch"
            desc="One call to deactivate any agent. Instant revocation. Payment history preserved on-chain."
          />
          <FeatureCard
            icon="&#x1F4CB;"
            title="On-Chain Receipts"
            desc="Every payment creates a PDA receipt. Verifiable audit trail on Solana Explorer."
          />
          <FeatureCard
            icon="&#x1F50C;"
            title="6 Real Connectors"
            desc="ElizaOS, Solana Agent Kit, x402/Pay.sh, LangChain, Webhook, and Custom. Not stubs."
          />
          <FeatureCard
            icon="&#x2318;"
            title="SDK + CLI"
            desc="TypeScript SDK with Anchor integration. 12 CLI commands. npm install and go."
          />
        </div>
      </section>

      {/* Connectors */}
      <section className="max-w-5xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-4">Works with everything</h2>
        <p className="text-muted text-center text-sm mb-10">Real connector classes with beforePay/afterPay lifecycle hooks</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { name: "ElizaOS", type: "AI Framework", color: "text-blue-400" },
            { name: "Agent Kit", type: "AI Framework", color: "text-purple-400" },
            { name: "x402 / Pay.sh", type: "Payment Rail", color: "text-amber-400" },
            { name: "LangChain", type: "AI Framework", color: "text-green-400" },
            { name: "Webhook", type: "Monitoring", color: "text-red-400" },
            { name: "Custom", type: "Build Your Own", color: "text-accent" },
          ].map((c) => (
            <div key={c.name} className="bg-surface border border-border rounded-xl p-4 text-center hover:border-accent/30 transition-colors">
              <p className="font-medium text-sm">{c.name}</p>
              <p className={`text-[10px] mt-1 ${c.color}`}>{c.type}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Live Devnet Proof */}
      <section className="max-w-3xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-4">Verified on Solana</h2>
        <p className="text-muted text-center text-sm mb-8">Every transaction below is live on devnet. Click to verify.</p>
        <div className="bg-surface border border-border rounded-2xl divide-y divide-border overflow-hidden">
          {DEVNET_TXS.map((item) => (
            <a
              key={item.label}
              href={`https://explorer.solana.com/tx/${item.tx}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between py-3 px-5 hover:bg-surface-2 transition-colors group"
            >
              <span className="text-sm text-foreground">{item.label}</span>
              <span className="text-xs text-accent font-mono group-hover:underline">
                {item.tx.slice(0, 8)}...{item.tx.slice(-4)} &#8599;
              </span>
            </a>
          ))}
        </div>
        <div className="text-center mt-4">
          <a
            href={`https://explorer.solana.com/address/${PROGRAM_ID}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-accent hover:underline"
          >
            View Program on Solana Explorer &#8599;
          </a>
        </div>
      </section>

      {/* CTA */}
      <section className="text-center space-y-6">
        <h2 className="text-2xl sm:text-3xl font-bold">Ready to control your agent spend?</h2>
        <p className="text-muted max-w-lg mx-auto text-sm">
          Connect your Phantom wallet to create a real vault on devnet,
          or explore the interactive demo dashboard.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <ConnectButton />
          <button
            onClick={onLaunchDemo}
            className="border border-accent/30 text-accent font-medium px-6 py-2.5 rounded-xl hover:bg-accent/10 transition-colors text-sm"
          >
            Try Demo Dashboard
          </button>
        </div>
      </section>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-6 space-y-3 hover:border-accent/20 transition-colors">
      <div className="text-2xl" dangerouslySetInnerHTML={{ __html: icon }} />
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-muted leading-relaxed">{desc}</p>
    </div>
  );
}

function AppShell() {
  const { wallet } = useWallet();
  const [showDashboard, setShowDashboard] = useState(false);

  return (
    <>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setShowDashboard(false)} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <span className="text-lg font-bold tracking-tight">
                Agent<span className="text-accent">Vault</span>
              </span>
            </button>
            <span className="text-[10px] bg-accent/10 text-accent px-2 py-0.5 rounded-full font-medium">
              devnet
            </span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/abhinav-nav/agentvault"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted hover:text-foreground transition-colors hidden sm:block"
            >
              GitHub
            </a>
            {showDashboard ? (
              <button
                onClick={() => setShowDashboard(false)}
                className="text-xs text-muted hover:text-foreground transition-colors"
              >
                Home
              </button>
            ) : (
              <button
                onClick={() => setShowDashboard(true)}
                className="text-xs text-muted hover:text-accent transition-colors"
              >
                Dashboard
              </button>
            )}
            <ConnectButton />
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-8">
        {showDashboard ? (
          <DemoDashboard />
        ) : (
          <LandingPage onLaunchDemo={() => setShowDashboard(true)} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted">
          <span>AgentVault &mdash; Colosseum Frontier Hackathon 2026</span>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/abhinav-nav/agentvault"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              GitHub &#8599;
            </a>
            <a
              href={`https://explorer.solana.com/address/${PROGRAM_ID}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground transition-colors"
            >
              Solana Explorer &#8599;
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}

export default function Home() {
  return (
    <WalletProvider>
      <AppShell />
    </WalletProvider>
  );
}
