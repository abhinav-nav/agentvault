"use client";

import { useState, useEffect, useCallback } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "./WalletProvider";
import { fetchTeam, fetchAllMembers, fetchAllReceipts, fetchVaultBalance } from "@/lib/anchor";
import { findTeamPda } from "@/lib/program";
import { formatUsdc } from "@/lib/program";
import MemberList from "./MemberList";
import AddMember from "./AddMember";
import FundVault from "./FundVault";
import PaymentFlow from "./PaymentFlow";
import ActivityFeed from "./ActivityFeed";

interface TeamData {
  authority: PublicKey;
  name: string;
  mint: PublicKey;
  vault: PublicKey;
  memberCount: number;
  totalDisbursed: any; // BN
  paymentCount: number;
  bump: number;
  vaultBump: number;
}

export default function TeamDashboard() {
  const { wallet } = useWallet();
  const [team, setTeam] = useState<TeamData | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [receipts, setReceipts] = useState<any[]>([]);
  const [vaultBalance, setVaultBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"team" | "pay" | "activity">("team");

  const refresh = useCallback(async () => {
    if (!wallet) return;
    try {
      const teamData = await fetchTeam(wallet.publicKey);
      if (!teamData) {
        setTeam(null);
        setLoading(false);
        return;
      }
      setTeam(teamData as any);

      const [teamPda] = findTeamPda(wallet.publicKey);
      const [membersData, receiptsData, balance] = await Promise.all([
        fetchAllMembers(teamPda),
        fetchAllReceipts(teamPda),
        fetchVaultBalance(teamPda),
      ]);
      setMembers(membersData);
      setReceipts(receiptsData);
      setVaultBalance(balance);
    } catch (err) {
      console.error("Failed to fetch team:", err);
    } finally {
      setLoading(false);
    }
  }, [wallet]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex items-center gap-3 text-muted">
          <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          Loading team...
        </div>
      </div>
    );
  }

  if (!team) return null; // CreateTeam handles this

  const tabs = [
    { key: "team" as const, label: "Team", icon: "👥" },
    { key: "pay" as const, label: "Payments", icon: "💸" },
    { key: "activity" as const, label: "Activity", icon: "📋" },
  ];

  return (
    <div className="animate-fade-in space-y-6">
      {/* Treasury Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard label="Treasury" value={formatUsdc(vaultBalance)} accent />
        <StatCard label="Team Members" value={String(team.memberCount)} />
        <StatCard label="Total Paid" value={formatUsdc(Number(team.totalDisbursed))} />
        <StatCard label="Payments" value={String(team.paymentCount)} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface border border-border rounded-lg p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-surface-2 text-foreground"
                : "text-muted hover:text-foreground"
            }`}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "team" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <MemberList members={members} onRefresh={refresh} />
            </div>
            <div className="space-y-4">
              <AddMember onAdded={refresh} />
              <FundVault onFunded={refresh} />
            </div>
          </div>
        </div>
      )}

      {activeTab === "pay" && (
        <PaymentFlow members={members} onPaid={refresh} />
      )}

      {activeTab === "activity" && (
        <ActivityFeed receipts={receipts} members={members} />
      )}
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`bg-surface border border-border rounded-xl p-4 ${accent ? "glow-green" : ""}`}>
      <p className="text-xs text-muted uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${accent ? "text-accent" : "text-foreground"}`}>
        {value}
      </p>
    </div>
  );
}
