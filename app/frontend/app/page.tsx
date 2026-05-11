"use client";

import { useState, useEffect, useCallback } from "react";
import { WalletProvider, useWallet } from "./components/WalletProvider";
import ConnectButton from "./components/ConnectButton";
import DemoDashboard from "./components/DemoDashboard";
import { fetchTeam } from "@/lib/anchor";

function AppContent() {
  const { wallet } = useWallet();
  const [demoMode, setDemoMode] = useState(false);

  if (demoMode) return <DemoDashboard />;

  // Landing page
  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] gap-8 animate-fade-in">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-2 bg-accent/10 text-accent text-sm font-medium px-4 py-1.5 rounded-full border border-accent/20">
          <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          Live on Solana Devnet
        </div>
        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight">
          Agent<span className="text-accent">Vault</span>
        </h1>
        <p className="text-muted text-lg max-w-xl mx-auto">
          Treasury & budget protocol for autonomous AI agents.
          Give your agents a USDC budget, set spending limits,
          and get on-chain receipts for every transaction.
        </p>
        <p className="text-muted/60 text-sm max-w-lg mx-auto">
          The missing layer between your AI agents and their money.
          Works with ElizaOS, Solana Agent Kit, x402/Pay.sh, and any custom framework.
        </p>
      </div>

      <div className="flex flex-col items-center gap-3">
        <ConnectButton />
        <button
          onClick={() => setDemoMode(true)}
          className="bg-surface-2 border border-accent/30 text-accent font-medium px-6 py-2.5 rounded-lg hover:bg-accent hover:text-black transition-colors text-sm"
        >
          Launch Demo Dashboard
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-8 text-center max-w-3xl">
        <Feature icon="🏦" title="Agent Treasury" desc="USDC vault with per-agent budgets and spending caps" />
        <Feature icon="🔌" title="Connectors" desc="Plug in ElizaOS, SAK, x402, or build your own" />
        <Feature icon="🛡️" title="Kill Switch" desc="Instantly revoke any agent's access to funds" />
        <Feature icon="📋" title="On-Chain Receipts" desc="Every agent payment is a verifiable PDA" />
      </div>

      {/* How it works */}
      <div className="w-full max-w-3xl mt-12 space-y-6">
        <h2 className="text-xl font-bold text-center">How It Works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Step num={1} title="Create Vault" desc="Deploy a USDC treasury on Solana for your AI agent swarm" />
          <Step num={2} title="Register Agents" desc="Add agent wallets with per-task spending limits" />
          <Step num={3} title="Connect" desc="Plug in ElizaOS, Agent Kit, x402, or your own connector" />
          <Step num={4} title="Monitor" desc="Track spending, approve milestones, kill rogue agents" />
        </div>
      </div>

      {/* Live Devnet Proof */}
      <div className="w-full max-w-3xl mt-12 space-y-4">
        <h2 className="text-xl font-bold text-center">Live on Solana Devnet</h2>
        <p className="text-xs text-muted text-center">Every transaction is verifiable on-chain. Click to view on Solana Explorer.</p>
        <div className="bg-surface border border-border rounded-xl p-4 space-y-2">
          {[
            { label: "Vault Created", tx: "4moZJ3iiiBE6h12wXSBqUh12m3AVz1sCbUgW9t41CLw4AN4FqibDPgGoeTRWpi6LxwG1pezkdFkXubEpLGM3joYU" },
            { label: "Agent Registered", tx: "51BVd89Rx2RJ5bh7SrF2Y7kkH5CpQx4WXiW3BhSJm65FkrfvZ6p4sVm1pQ6gxT1TsVAQsQq16kucFZi2nXgVhC5" },
            { label: "Vault Funded ($10,000 USDC)", tx: "447VF1BLWu6Twb2zdLDFnm6nzWN9d7RWp3jrNjhc5Yj6K5XVQV1TgP1hqaFxNBxPKHa2kxjZCZYfmchsWvqJzC" },
            { label: "Agent Payment ($15 USDC)", tx: "4XbQWg7oVTjqtkRLYajFyubMNKz7sM5Jqm96saevjVdxvcxsdxk8yZsSmhFmJtLdp33fsDwWgdCQDX7EM1zsFeSu" },
            { label: "Kill Switch (Agent Deactivated)", tx: "2cX9ZtuvD23P8CUJPbiY8JTurx1QKkyBULmA4GKigoyBjKQKvvoocAyrUNDsbmpviRD1KSBBBfEYx5w92ENuVpuj" },
          ].map((item) => (
            <a key={item.label} href={`https://explorer.solana.com/tx/${item.tx}?cluster=devnet`} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-surface-2 transition-colors group">
              <span className="text-sm text-foreground">{item.label}</span>
              <span className="text-xs text-accent font-mono group-hover:underline">{item.tx.slice(0, 12)}...&nbsp;↗</span>
            </a>
          ))}
        </div>
        <p className="text-xs text-center">
          <a href="https://explorer.solana.com/address/8g5hMx6AwTUFCrKwuaCfDY468qE4bbHiw8BvdiepUJdo?cluster=devnet" target="_blank" rel="noopener noreferrer"
            className="text-accent hover:underline">View Program on Solscan ↗</a>
        </p>
      </div>

      {/* Connector logos / badges */}
      <div className="mt-12 text-center space-y-3">
        <p className="text-xs text-muted uppercase tracking-wider">Works with</p>
        <div className="flex flex-wrap justify-center gap-3">
          {["ElizaOS", "Solana Agent Kit", "x402 / Pay.sh", "LangChain", "Vercel AI SDK", "Custom"].map((name) => (
            <span key={name} className="text-xs bg-surface border border-border rounded-full px-4 py-1.5 text-muted">
              {name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="space-y-2">
      <div className="text-3xl">{icon}</div>
      <h3 className="font-semibold text-sm">{title}</h3>
      <p className="text-xs text-muted">{desc}</p>
    </div>
  );
}

function Step({ num, title, desc }: { num: number; title: string; desc: string }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4 space-y-2 text-center">
      <div className="w-8 h-8 rounded-full bg-accent/10 text-accent font-bold text-sm flex items-center justify-center mx-auto">
        {num}
      </div>
      <h3 className="font-semibold text-sm">{title}</h3>
      <p className="text-xs text-muted">{desc}</p>
    </div>
  );
}

export default function Home() {
  const [demoFromHeader, setDemoFromHeader] = useState(false);

  return (
    <WalletProvider>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold">
              Agent<span className="text-accent">Vault</span>
            </span>
            <span className="text-[10px] bg-accent/10 text-accent px-2 py-0.5 rounded-full font-medium">
              devnet
            </span>
          </div>
          <div className="flex items-center gap-4">
            {!demoFromHeader ? (
              <button
                onClick={() => setDemoFromHeader(true)}
                className="text-xs text-muted hover:text-accent transition-colors"
              >
                Demo
              </button>
            ) : (
              <button
                onClick={() => setDemoFromHeader(false)}
                className="text-xs bg-accent/10 text-accent px-3 py-1 rounded-full font-medium"
              >
                Exit Demo
              </button>
            )}
            <ConnectButton />
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-8">
        {demoFromHeader ? <DemoDashboard /> : <AppContent />}
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-4 mt-auto">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between text-xs text-muted">
          <span>AgentVault — Colosseum Frontier Hackathon 2026</span>
          <a
            href={`https://solscan.io/account/8g5hMx6AwTUFCrKwuaCfDY468qE4bbHiw8BvdiepUJdo?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            Program on Solscan ↗
          </a>
        </div>
      </footer>
    </WalletProvider>
  );
}
