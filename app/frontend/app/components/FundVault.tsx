"use client";

import { useState } from "react";
import { useWallet } from "./WalletProvider";
import { fundVault } from "@/lib/anchor";
import { USDC_DECIMALS } from "@/lib/program";

export default function FundVault({ onFunded }: { onFunded: () => void }) {
  const { wallet } = useWallet();
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleFund() {
    if (!wallet || !amount) return;
    setLoading(true);
    setError("");
    try {
      const amountInUsdc = Math.round(parseFloat(amount) * 10 ** USDC_DECIMALS);
      await fundVault(wallet, amountInUsdc);
      setAmount("");
      onFunded();
    } catch (err: any) {
      setError(err.message || "Failed to fund vault");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
      <h3 className="font-semibold text-sm">Fund Treasury</h3>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">$</span>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className="w-full bg-surface-2 border border-border rounded-lg pl-7 pr-16 py-2 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:border-accent transition-colors"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted text-xs">USDC</span>
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <button
        onClick={handleFund}
        disabled={loading || !amount}
        className="w-full bg-surface-2 border border-accent text-accent font-semibold py-2 rounded-lg text-sm hover:bg-accent hover:text-black transition-colors disabled:opacity-50"
      >
        {loading ? "Funding..." : "Deposit USDC"}
      </button>
    </div>
  );
}
