"use client";

import { PublicKey } from "@solana/web3.js";
import { formatUsdc } from "@/lib/program";
import { useWallet } from "./WalletProvider";
import { deactivateMember } from "@/lib/anchor";
import { useState } from "react";

interface MemberAccount {
  publicKey: PublicKey;
  account: {
    team: PublicKey;
    wallet: PublicKey;
    role: string;
    ratePerDelivery: any;
    totalEarned: any;
    deliveriesCompleted: number;
    isActive: boolean;
    bump: number;
  };
}

export default function MemberList({
  members,
  onRefresh,
}: {
  members: MemberAccount[];
  onRefresh: () => void;
}) {
  const { wallet } = useWallet();
  const [deactivating, setDeactivating] = useState<string | null>(null);

  async function handleDeactivate(memberWallet: PublicKey) {
    if (!wallet) return;
    setDeactivating(memberWallet.toBase58());
    try {
      await deactivateMember(wallet, memberWallet);
      onRefresh();
    } catch (err) {
      console.error("Deactivate failed:", err);
    } finally {
      setDeactivating(null);
    }
  }

  if (members.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-xl p-8 text-center">
        <p className="text-muted text-lg">No agents registered yet</p>
        <p className="text-muted/60 text-sm mt-1">Register your first AI agent to get started</p>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="font-semibold text-sm">Registered Agents</h3>
      </div>
      <div className="divide-y divide-border">
        {members.map((m) => {
          const addr = m.account.wallet.toBase58();
          const short = addr.slice(0, 4) + "..." + addr.slice(-4);
          return (
            <div key={addr} className="flex items-center justify-between px-4 py-3 hover:bg-surface-2 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-2 h-2 rounded-full ${m.account.isActive ? "bg-accent" : "bg-red-400"}`} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{m.account.role}</span>
                    <span className="text-xs font-mono text-muted">{short}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted mt-0.5">
                    <span>Rate: {formatUsdc(Number(m.account.ratePerDelivery))}</span>
                    <span>Earned: {formatUsdc(Number(m.account.totalEarned))}</span>
                    <span>Deliveries: {m.account.deliveriesCompleted}</span>
                  </div>
                </div>
              </div>
              {m.account.isActive && (
                <button
                  onClick={() => handleDeactivate(m.account.wallet)}
                  disabled={deactivating === addr}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors px-2 py-1"
                >
                  {deactivating === addr ? "..." : "Remove"}
                </button>
              )}
              {!m.account.isActive && (
                <span className="text-xs text-red-400/60 px-2">Inactive</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
