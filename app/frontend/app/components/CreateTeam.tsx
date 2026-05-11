"use client";

import { useState } from "react";
import { useWallet } from "./WalletProvider";
import { createTeam } from "@/lib/anchor";

export default function CreateTeam({ onCreated }: { onCreated: () => void }) {
  const { wallet } = useWallet();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate() {
    if (!wallet || !name.trim()) return;
    setLoading(true);
    setError("");
    try {
      await createTeam(wallet, name.trim());
      onCreated();
    } catch (err: any) {
      setError(err.message || "Failed to create vault");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="animate-fade-in flex flex-col items-center justify-center min-h-[60vh] gap-8">
      <div className="text-center space-y-3">
        <h1 className="text-4xl font-bold tracking-tight">
          Deploy Your <span className="text-accent">AgentVault</span>
        </h1>
        <p className="text-muted text-lg max-w-md">
          Create a USDC treasury vault for your AI agent swarm. Set budgets, track spending, get on-chain receipts.
        </p>
      </div>

      <div className="w-full max-w-md space-y-4">
        <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
          <label className="block text-sm font-medium text-muted">Vault Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder='e.g. "Acme AI Swarm"'
            maxLength={64}
            className="w-full bg-surface-2 border border-border rounded-lg px-4 py-3 text-foreground placeholder:text-muted/50 focus:outline-none focus:border-accent transition-colors"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            onClick={handleCreate}
            disabled={loading || !name.trim()}
            className="w-full bg-accent text-black font-semibold py-3 rounded-lg hover:bg-accent-dim transition-colors disabled:opacity-50"
          >
            {loading ? "Deploying Vault..." : "Deploy Vault"}
          </button>
        </div>
        <p className="text-xs text-center text-muted">
          Deploys your agent treasury on Solana devnet. Vault accepts USDC.
        </p>
      </div>
    </div>
  );
}
