"use client";

import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "./WalletProvider";
import { addMember } from "@/lib/anchor";
import { USDC_DECIMALS } from "@/lib/program";

export default function AddMember({ onAdded }: { onAdded: () => void }) {
  const { wallet } = useWallet();
  const [walletAddr, setWalletAddr] = useState("");
  const [role, setRole] = useState("");
  const [rate, setRate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleAdd() {
    if (!wallet || !walletAddr || !role || !rate) return;
    setLoading(true);
    setError("");
    setSuccess(false);
    try {
      const memberPubkey = new PublicKey(walletAddr.trim());
      const rateInUsdc = Math.round(parseFloat(rate) * 10 ** USDC_DECIMALS);
      await addMember(wallet, memberPubkey, role.trim(), rateInUsdc);
      setSuccess(true);
      setWalletAddr("");
      setRole("");
      setRate("");
      onAdded();
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to add member");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
      <h3 className="font-semibold text-sm">Add Member</h3>
      <input
        type="text"
        value={walletAddr}
        onChange={(e) => setWalletAddr(e.target.value)}
        placeholder="Wallet address"
        className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:border-accent transition-colors font-mono"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="Role (e.g. Editor)"
          maxLength={32}
          className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:border-accent transition-colors"
        />
        <input
          type="number"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          placeholder="Rate (USDC)"
          className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:border-accent transition-colors"
        />
      </div>
      {error && <p className="text-red-400 text-xs">{error}</p>}
      {success && <p className="text-accent text-xs">Member added successfully!</p>}
      <button
        onClick={handleAdd}
        disabled={loading || !walletAddr || !role || !rate}
        className="w-full bg-accent text-black font-semibold py-2 rounded-lg text-sm hover:bg-accent-dim transition-colors disabled:opacity-50"
      >
        {loading ? "Adding..." : "Add to Team"}
      </button>
    </div>
  );
}
