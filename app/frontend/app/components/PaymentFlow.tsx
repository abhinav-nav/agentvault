"use client";

import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "./WalletProvider";
import { directPay } from "@/lib/anchor";
import { formatUsdc, USDC_DECIMALS } from "@/lib/program";

export default function PaymentFlow({
  members,
  onPaid,
}: {
  members: any[];
  onPaid: () => void;
}) {
  const { wallet } = useWallet();
  const [selectedMember, setSelectedMember] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const activeMembers = members.filter((m) => m.account.isActive);

  async function handlePay() {
    if (!wallet || !selectedMember || !amount) return;
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const memberWallet = new PublicKey(selectedMember);
      const amountInUsdc = Math.round(parseFloat(amount) * 10 ** USDC_DECIMALS);
      await directPay(wallet, memberWallet, amountInUsdc, memo || "Direct payment");
      const member = activeMembers.find(
        (m) => m.account.wallet.toBase58() === selectedMember
      );
      setSuccess(
        `Sent ${formatUsdc(amountInUsdc)} to ${member?.account.role || "member"}`
      );
      setAmount("");
      setMemo("");
      setSelectedMember("");
      onPaid();
      setTimeout(() => setSuccess(""), 5000);
    } catch (err: any) {
      setError(err.message || "Payment failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Direct Pay */}
      <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
        <div>
          <h3 className="font-semibold">Direct Payment</h3>
          <p className="text-xs text-muted mt-1">
            Send USDC instantly from your treasury to any team member
          </p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted block mb-1">Recipient</label>
            <select
              value={selectedMember}
              onChange={(e) => setSelectedMember(e.target.value)}
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-accent transition-colors appearance-none"
            >
              <option value="">Select team member</option>
              {activeMembers.map((m) => {
                const addr = m.account.wallet.toBase58();
                return (
                  <option key={addr} value={addr}>
                    {m.account.role} ({addr.slice(0, 4)}...{addr.slice(-4)})
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label className="text-xs text-muted block mb-1">Amount (USDC)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">$</span>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-surface-2 border border-border rounded-lg pl-7 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:border-accent transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-muted block mb-1">Memo (optional)</label>
            <input
              type="text"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder='e.g. "March video editing"'
              maxLength={128}
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:border-accent transition-colors"
            />
          </div>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}
        {success && (
          <div className="bg-accent/10 border border-accent/30 rounded-lg p-3 text-accent text-sm">
            {success}
          </div>
        )}

        <button
          onClick={handlePay}
          disabled={loading || !selectedMember || !amount}
          className="w-full bg-accent text-black font-semibold py-3 rounded-lg hover:bg-accent-dim transition-colors disabled:opacity-50"
        >
          {loading ? "Processing..." : "Send Payment"}
        </button>
      </div>

      {/* Quick Pay Cards */}
      <div className="space-y-3">
        <h3 className="font-semibold">Quick Pay</h3>
        <p className="text-xs text-muted">
          Pay a member their standard rate for one delivery
        </p>
        {activeMembers.length === 0 ? (
          <p className="text-muted text-sm">No active members</p>
        ) : (
          <div className="space-y-2">
            {activeMembers.map((m) => {
              const addr = m.account.wallet.toBase58();
              return (
                <QuickPayCard
                  key={addr}
                  role={m.account.role}
                  wallet={m.account.wallet}
                  rate={Number(m.account.ratePerDelivery)}
                  onPaid={onPaid}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function QuickPayCard({
  role,
  wallet: memberWallet,
  rate,
  onPaid,
}: {
  role: string;
  wallet: PublicKey;
  rate: number;
  onPaid: () => void;
}) {
  const { wallet } = useWallet();
  const [loading, setLoading] = useState(false);

  async function handleQuickPay() {
    if (!wallet) return;
    setLoading(true);
    try {
      await directPay(wallet, memberWallet, rate, `${role} delivery`);
      onPaid();
    } catch (err) {
      console.error("Quick pay failed:", err);
    } finally {
      setLoading(false);
    }
  }

  const addr = memberWallet.toBase58();
  return (
    <div className="bg-surface border border-border rounded-xl p-4 flex items-center justify-between">
      <div>
        <p className="font-medium text-sm">{role}</p>
        <p className="text-xs text-muted font-mono">
          {addr.slice(0, 4)}...{addr.slice(-4)}
        </p>
      </div>
      <button
        onClick={handleQuickPay}
        disabled={loading}
        className="bg-accent/10 text-accent border border-accent/30 px-4 py-2 rounded-lg text-sm font-medium hover:bg-accent hover:text-black transition-colors disabled:opacity-50"
      >
        {loading ? "..." : `Pay ${formatUsdc(rate)}`}
      </button>
    </div>
  );
}
