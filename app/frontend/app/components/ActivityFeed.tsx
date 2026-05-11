"use client";

import { PublicKey } from "@solana/web3.js";
import { formatUsdc } from "@/lib/program";

interface Receipt {
  publicKey: PublicKey;
  account: {
    team: PublicKey;
    member: PublicKey;
    milestone: PublicKey;
    recipient: PublicKey;
    amount: any;
    timestamp: any;
    memo: string;
    bump: number;
  };
}

export default function ActivityFeed({
  receipts,
  members,
}: {
  receipts: Receipt[];
  members: any[];
}) {
  // Sort by timestamp descending
  const sorted = [...receipts].sort(
    (a, b) => Number(b.account.timestamp) - Number(a.account.timestamp)
  );

  // Build a lookup: member PDA -> role
  const memberRoles: Record<string, string> = {};
  members.forEach((m) => {
    memberRoles[m.publicKey.toBase58()] = m.account.role;
  });

  if (sorted.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-xl p-8 text-center">
        <p className="text-muted text-lg">No agent activity yet</p>
        <p className="text-muted/60 text-sm mt-1">
          Agent transactions will appear here as on-chain receipts
        </p>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold text-sm">Agent Transaction Log</h3>
        <span className="text-xs text-muted">{sorted.length} transactions</span>
      </div>
      <div className="divide-y divide-border">
        {sorted.map((r) => {
          const addr = r.account.recipient.toBase58();
          const short = addr.slice(0, 4) + "..." + addr.slice(-4);
          const role = memberRoles[r.account.member.toBase58()] || "Unknown";
          const ts = new Date(Number(r.account.timestamp) * 1000);
          const hasMilestone =
            r.account.milestone.toBase58() !== PublicKey.default.toBase58() &&
            r.account.milestone.toBase58() !== "11111111111111111111111111111111";

          return (
            <div key={r.publicKey.toBase58()} className="px-4 py-3 hover:bg-surface-2 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent text-sm">
                    {hasMilestone ? "🎯" : "💰"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{role}</span>
                      <span className="text-xs font-mono text-muted">{short}</span>
                    </div>
                    <p className="text-xs text-muted mt-0.5">
                      {r.account.memo}
                      {hasMilestone && " (milestone)"}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-sm text-accent">
                    {formatUsdc(Number(r.account.amount))}
                  </p>
                  <p className="text-xs text-muted">
                    {ts.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
