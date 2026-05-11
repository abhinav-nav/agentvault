"use client";

import { useState } from "react";
import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { formatUsdc, USDC_DECIMALS } from "@/lib/program";
import { MOCK_TEAM, MOCK_MEMBERS, MOCK_RECEIPTS, MOCK_VAULT_BALANCE } from "@/lib/mock-data";
import { BUILTIN_CONNECTORS, SDK_SNIPPETS } from "@/lib/connectors";
import type { AgentVaultConnector, ConnectorConfigField } from "@/lib/connectors";

const USDC = 10 ** USDC_DECIMALS;

export default function DemoDashboard() {
  const [activeTab, setActiveTab] = useState<"agents" | "connectors" | "activity" | "sdk">("agents");

  // Live state from mock data — everything mutates this
  const [members, setMembers] = useState(MOCK_MEMBERS.map(m => ({ ...m, account: { ...m.account } })));
  const [receipts, setReceipts] = useState([...MOCK_RECEIPTS]);
  const [vaultBalance, setVaultBalance] = useState(MOCK_VAULT_BALANCE);
  const [totalDisbursed, setTotalDisbursed] = useState(Number(MOCK_TEAM.totalDisbursed));
  const [paymentCount, setPaymentCount] = useState(MOCK_TEAM.paymentCount);
  const [connectors, setConnectors] = useState<AgentVaultConnector[]>(BUILTIN_CONNECTORS);
  const [showAddConnector, setShowAddConnector] = useState(false);
  const [showConnectorDetail, setShowConnectorDetail] = useState<string | null>(null);
  const [showAddAgent, setShowAddAgent] = useState(false);
  const [showEditLimits, setShowEditLimits] = useState(false);
  const [toast, setToast] = useState("");

  // Derived
  const activeAgents = members.filter(m => m.account.isActive);
  const connectedCount = connectors.filter(c => c.status === "connected").length;

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(""), 4000);
  }

  // ---- KILL SWITCH ----
  function handleKill(walletStr: string) {
    setMembers(prev => prev.map(m =>
      m.account.wallet.toBase58() === walletStr
        ? { ...m, account: { ...m.account, isActive: false } }
        : m
    ));
    const agent = members.find(m => m.account.wallet.toBase58() === walletStr);
    showToast(`Agent "${agent?.account.role}" deactivated. Access revoked.`);
  }

  // ---- REACTIVATE ----
  function handleReactivate(walletStr: string) {
    setMembers(prev => prev.map(m =>
      m.account.wallet.toBase58() === walletStr
        ? { ...m, account: { ...m.account, isActive: true } }
        : m
    ));
    const agent = members.find(m => m.account.wallet.toBase58() === walletStr);
    showToast(`Agent "${agent?.account.role}" reactivated.`);
  }

  // ---- FUND VAULT ----
  function handleFund(amount: number) {
    const raw = Math.round(amount * USDC);
    setVaultBalance(prev => prev + raw);
    showToast(`Deposited $${amount.toFixed(2)} USDC into vault`);
  }

  // ---- PAY AGENT ----
  function handlePay(walletStr: string, amount: number, memo: string) {
    const raw = Math.round(amount * USDC);
    if (raw > vaultBalance) {
      showToast("Insufficient vault balance!");
      return;
    }
    const agent = members.find(m => m.account.wallet.toBase58() === walletStr);
    if (!agent || !agent.account.isActive) {
      showToast("Agent not found or inactive!");
      return;
    }

    // Update balances
    setVaultBalance(prev => prev - raw);
    setTotalDisbursed(prev => prev + raw);
    setPaymentCount(prev => prev + 1);
    setMembers(prev => prev.map(m =>
      m.account.wallet.toBase58() === walletStr
        ? {
            ...m,
            account: {
              ...m.account,
              totalEarned: new BN(Number(m.account.totalEarned) + raw),
              deliveriesCompleted: m.account.deliveriesCompleted + 1,
            },
          }
        : m
    ));

    // Add receipt
    const newReceipt = {
      publicKey: PublicKey.unique(),
      account: {
        team: MOCK_TEAM.vault,
        member: agent.publicKey,
        milestone: PublicKey.default,
        recipient: agent.account.wallet,
        amount: new BN(raw),
        timestamp: new BN(Math.floor(Date.now() / 1000)),
        memo,
        bump: 200,
      },
    };
    setReceipts(prev => [newReceipt, ...prev]);
    showToast(`Sent $${amount.toFixed(2)} USDC to ${agent.account.role} — tx: ${randomTx()}`);
  }

  // ---- ADD AGENT ----
  function handleAddAgent(role: string, rate: number) {
    const newMember = {
      publicKey: PublicKey.unique(),
      account: {
        team: MOCK_TEAM.vault,
        wallet: PublicKey.unique(),
        role,
        ratePerDelivery: new BN(Math.round(rate * USDC)),
        totalEarned: new BN(0),
        deliveriesCompleted: 0,
        isActive: true,
        bump: 200,
      },
    };
    setMembers(prev => [...prev, newMember]);
    setShowAddAgent(false);
    showToast(`Agent "${role}" registered with $${rate}/task limit`);
  }

  const tabs = [
    { key: "agents" as const, label: "Agents", icon: "🤖" },
    { key: "connectors" as const, label: "Connectors", icon: "🔌" },
    { key: "activity" as const, label: "Activity", icon: "📋" },
    { key: "sdk" as const, label: "SDK / Docs", icon: "📦" },
  ];

  return (
    <div className="animate-fade-in space-y-6 relative">
      {/* Toast */}
      {toast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-accent/90 text-black px-5 py-2.5 rounded-lg text-sm font-medium shadow-lg animate-fade-in">
          {toast}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <StatCard label="Vault Balance" value={formatUsdc(vaultBalance)} accent />
        <StatCard label="Active Agents" value={`${activeAgents.length}/${members.length}`} />
        <StatCard label="Total Spent" value={formatUsdc(totalDisbursed)} />
        <StatCard label="Transactions" value={String(paymentCount)} />
        <StatCard label="Connectors" value={`${connectedCount} active`} />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface border border-border rounded-lg p-1">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.key ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground"
            }`}
          >
            <span>{tab.icon}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ===== AGENTS TAB ===== */}
      {activeTab === "agents" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Registered Agents</h3>
              <button
                onClick={() => setShowAddAgent(!showAddAgent)}
                className="text-xs bg-accent/10 text-accent px-3 py-1.5 rounded-lg hover:bg-accent/20 transition-colors"
              >
                {showAddAgent ? "Cancel" : "+ Register Agent"}
              </button>
            </div>

            {/* Add Agent Form */}
            {showAddAgent && <AddAgentForm onAdd={handleAddAgent} />}

            {/* Agent Cards */}
            {members.map(m => {
              const addr = m.account.wallet.toBase58();
              const short = addr.slice(0, 4) + "..." + addr.slice(-4);
              const spent = Number(m.account.totalEarned);
              const pctUsed = spent / (spent + 10_000 * USDC) * 100;
              return (
                <div key={addr} className="bg-surface border border-border rounded-xl p-4 hover:border-border/80 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full ${m.account.isActive ? "bg-accent animate-pulse" : "bg-red-400"}`} />
                      <div>
                        <span className="font-medium text-sm">{m.account.role}</span>
                        <span className="text-xs font-mono text-muted ml-2">{short}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {m.account.isActive ? (
                        <>
                          <span className="text-[10px] bg-accent/10 text-accent px-2 py-0.5 rounded-full">ACTIVE</span>
                          <button
                            onClick={() => handleKill(addr)}
                            className="text-xs text-red-400 hover:text-red-300 px-2 py-1 border border-red-400/20 rounded-lg hover:bg-red-400/10 transition-colors"
                          >
                            Kill Switch
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="text-[10px] bg-red-400/10 text-red-400 px-2 py-0.5 rounded-full">KILLED</span>
                          <button
                            onClick={() => handleReactivate(addr)}
                            className="text-xs text-accent hover:text-accent-dim px-2 py-1 border border-accent/20 rounded-lg hover:bg-accent/10 transition-colors"
                          >
                            Reactivate
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-xs">
                    <div>
                      <span className="text-muted">Per-task limit</span>
                      <p className="font-medium mt-0.5">{formatUsdc(Number(m.account.ratePerDelivery))}</p>
                    </div>
                    <div>
                      <span className="text-muted">Total spent</span>
                      <p className="font-medium mt-0.5 text-accent">{formatUsdc(spent)}</p>
                    </div>
                    <div>
                      <span className="text-muted">Tasks completed</span>
                      <p className="font-medium mt-0.5">{m.account.deliveriesCompleted}</p>
                    </div>
                  </div>
                  {m.account.isActive && (
                    <div className="mt-3">
                      <div className="flex justify-between text-[10px] text-muted mb-1">
                        <span>Budget utilization</span>
                        <span>{pctUsed.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                        <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${Math.min(pctUsed, 100)}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <FundVaultCard onFund={handleFund} />
            <GlobalLimitsCard showEdit={showEditLimits} setShowEdit={setShowEditLimits} onToast={showToast} />
            <QuickPayCard agents={activeAgents} onPay={handlePay} />
            <LiveFeedCard receipts={receipts} />
          </div>
        </div>
      )}

      {/* ===== CONNECTORS TAB ===== */}
      {activeTab === "connectors" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Connectors</h3>
              <p className="text-xs text-muted mt-0.5">Plug in any AI framework, payment rail, or monitoring tool</p>
            </div>
            <button
              onClick={() => setShowAddConnector(!showAddConnector)}
              className="bg-accent text-black font-semibold px-4 py-2 rounded-lg text-sm hover:bg-accent-dim transition-colors"
            >
              {showAddConnector ? "Cancel" : "+ Custom Connector"}
            </button>
          </div>

          {showAddConnector && (
            <AddCustomConnector
              onAdd={(c) => { setConnectors([...connectors, c]); setShowAddConnector(false); showToast(`Connector "${c.name}" created`); }}
              onCancel={() => setShowAddConnector(false)}
            />
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {connectors.map(c => (
              <div
                key={c.id}
                className={`bg-surface border rounded-xl p-4 transition-colors cursor-pointer hover:border-accent/40 ${
                  c.status === "connected" ? "border-border" : "border-border/50 opacity-70"
                }`}
                onClick={() => setShowConnectorDetail(showConnectorDetail === c.id ? null : c.id)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{c.icon}</span>
                    <div>
                      <h4 className="font-medium text-sm">{c.name}</h4>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                        c.type === "ai-framework" ? "bg-blue-400/10 text-blue-400"
                        : c.type === "payment-rail" ? "bg-purple-400/10 text-purple-400"
                        : c.type === "monitoring" ? "bg-yellow-400/10 text-yellow-400"
                        : "bg-accent/10 text-accent"
                      }`}>{c.type}</span>
                    </div>
                  </div>
                  <div className={`w-2.5 h-2.5 rounded-full ${
                    c.status === "connected" ? "bg-accent" : c.status === "error" ? "bg-red-400" : "bg-muted"
                  }`} />
                </div>
                <p className="text-xs text-muted mb-3 line-clamp-2">{c.description}</p>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div><span className="text-muted">Calls</span><p className="font-medium">{c.stats.totalCalls.toLocaleString()}</p></div>
                  <div><span className="text-muted">Spent</span><p className="font-medium">{formatUsdc(c.stats.totalSpent)}</p></div>
                  <div><span className="text-muted">Last used</span><p className="font-medium">{c.stats.lastUsed ? timeAgo(c.stats.lastUsed) : "never"}</p></div>
                </div>

                {showConnectorDetail === c.id && (
                  <div className="mt-4 pt-3 border-t border-border space-y-3 animate-fade-in" onClick={e => e.stopPropagation()}>
                    <h5 className="text-xs font-semibold text-muted uppercase">Configuration</h5>
                    {c.configFields.map(f => (
                      <div key={f.key} className="flex items-center justify-between text-xs">
                        <span className="text-muted">{f.label}</span>
                        <span className="font-mono text-foreground">{String(c.config[f.key] ?? "—")}</span>
                      </div>
                    ))}
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => {
                          const newVal = prompt(`Edit config for ${c.name} (JSON):`, JSON.stringify(c.config));
                          if (newVal) {
                            try {
                              const parsed = JSON.parse(newVal);
                              setConnectors(connectors.map(cc => cc.id === c.id ? { ...cc, config: parsed } : cc));
                              showToast(`${c.name} config updated`);
                            } catch { showToast("Invalid JSON"); }
                          }
                        }}
                        className="flex-1 text-xs bg-surface-2 border border-border rounded-lg py-1.5 hover:border-accent transition-colors"
                      >
                        Edit Config
                      </button>
                      <button
                        onClick={() => {
                          setConnectors(connectors.map(cc =>
                            cc.id === c.id ? { ...cc, enabled: !cc.enabled, status: cc.enabled ? "disconnected" : "connected" } : cc
                          ));
                          showToast(`${c.name} ${c.enabled ? "disabled" : "enabled"}`);
                        }}
                        className={`flex-1 text-xs rounded-lg py-1.5 border transition-colors ${
                          c.enabled ? "border-red-400/30 text-red-400 hover:bg-red-400/10" : "border-accent/30 text-accent hover:bg-accent/10"
                        }`}
                      >
                        {c.enabled ? "Disable" : "Enable"}
                      </button>
                      {c.type === "custom" && (
                        <button
                          onClick={() => {
                            setConnectors(connectors.filter(cc => cc.id !== c.id));
                            setShowConnectorDetail(null);
                            showToast(`${c.name} deleted`);
                          }}
                          className="text-xs border border-red-400/30 text-red-400 hover:bg-red-400/10 rounded-lg px-3 py-1.5 transition-colors"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== ACTIVITY TAB ===== */}
      {activeTab === "activity" && (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="font-semibold text-sm">Agent Transaction Log</h3>
            <span className="text-xs text-muted">{receipts.length} transactions</span>
          </div>
          {receipts.length === 0 ? (
            <div className="p-8 text-center text-muted">No transactions yet. Pay an agent to see receipts here.</div>
          ) : (
            <div className="divide-y divide-border">
              {receipts.map((r, i) => {
                const addr = r.account.recipient.toBase58();
                const short = addr.slice(0, 4) + "..." + addr.slice(-4);
                const member = members.find(m => m.publicKey.toBase58() === r.account.member.toBase58());
                const role = member?.account.role || "Agent";
                const ts = new Date(Number(r.account.timestamp) * 1000);
                const hasMilestone = r.account.milestone.toBase58() !== PublicKey.default.toBase58() && r.account.milestone.toBase58() !== "11111111111111111111111111111111";
                return (
                  <div key={i} className="px-4 py-3 hover:bg-surface-2 transition-colors">
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
                          <p className="text-xs text-muted mt-0.5">{r.account.memo}{hasMilestone && " (milestone)"}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-sm text-accent">{formatUsdc(Number(r.account.amount))}</p>
                        <p className="text-xs text-muted">{ts.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===== SDK TAB ===== */}
      {activeTab === "sdk" && (
        <div className="space-y-6">
          <div>
            <h3 className="font-semibold">SDK & Integration Docs</h3>
            <p className="text-xs text-muted mt-1">Real connectors with lifecycle hooks. Connect any AI agent to your vault in minutes.</p>
          </div>
          <CodeBlock title="Install" code={SDK_SNIPPETS.install} />
          <CodeBlock title="Initialize Vault" code={SDK_SNIPPETS.initVault} />
          <CodeBlock title="Check Agent Budget" code={SDK_SNIPPETS.checkBudget} />
          <div className="border-t border-border pt-4">
            <h4 className="font-semibold text-sm mb-3 text-accent">Connector Integrations</h4>
          </div>
          <CodeBlock title="x402 / Pay.sh — Budget-Controlled API Payments" code={SDK_SNIPPETS.x402Wrap} />
          <CodeBlock title="ElizaOS Plugin — 3 Agent Actions" code={SDK_SNIPPETS.elizaPlugin} />
          <CodeBlock title="LangChain / Vercel AI SDK Tool" code={SDK_SNIPPETS.langchainTool} />
          <CodeBlock title="Solana Agent Kit — agentVaultPay()" code={SDK_SNIPPETS.sakAction} />
          <CodeBlock title="Webhook Monitor — Real-time Notifications" code={SDK_SNIPPETS.webhookSetup} />
          <CodeBlock title="Build a Custom Connector" code={SDK_SNIPPETS.customConnector} />
        </div>
      )}
    </div>
  );
}

// ===== SUB-COMPONENTS =====

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`bg-surface border border-border rounded-xl p-3 ${accent ? "glow-green" : ""}`}>
      <p className="text-[10px] text-muted uppercase tracking-wider">{label}</p>
      <p className={`text-xl font-bold mt-1 ${accent ? "text-accent" : "text-foreground"}`}>{value}</p>
    </div>
  );
}

function AddAgentForm({ onAdd }: { onAdd: (role: string, rate: number) => void }) {
  const [role, setRole] = useState("");
  const [rate, setRate] = useState("");
  return (
    <div className="bg-surface border-2 border-accent/30 rounded-xl p-4 space-y-3 animate-fade-in">
      <h4 className="font-semibold text-sm">Register New Agent</h4>
      <div className="grid grid-cols-2 gap-3">
        <input type="text" value={role} onChange={e => setRole(e.target.value)} placeholder="Role (e.g. Research Agent)"
          className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:border-accent" />
        <input type="number" value={rate} onChange={e => setRate(e.target.value)} placeholder="Rate per task (USDC)"
          className="bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:border-accent" />
      </div>
      <button onClick={() => { if (role && rate) onAdd(role, parseFloat(rate)); }}
        disabled={!role || !rate}
        className="w-full bg-accent text-black font-semibold py-2 rounded-lg text-sm hover:bg-accent-dim transition-colors disabled:opacity-50">
        Register Agent
      </button>
    </div>
  );
}

function FundVaultCard({ onFund }: { onFund: (amount: number) => void }) {
  const [amount, setAmount] = useState("");
  return (
    <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
      <h3 className="font-semibold text-sm">Fund Vault</h3>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">$</span>
        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00"
          className="w-full bg-surface-2 border border-border rounded-lg pl-7 pr-16 py-2 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:border-accent transition-colors" />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted text-xs">USDC</span>
      </div>
      <button onClick={() => { if (amount) { onFund(parseFloat(amount)); setAmount(""); } }}
        disabled={!amount}
        className="w-full bg-accent text-black font-semibold py-2 rounded-lg text-sm hover:bg-accent-dim transition-colors disabled:opacity-50">
        Deposit USDC
      </button>
    </div>
  );
}

function GlobalLimitsCard({ showEdit, setShowEdit, onToast }: { showEdit: boolean; setShowEdit: (v: boolean) => void; onToast: (msg: string) => void }) {
  const [dailyCap, setDailyCap] = useState("1000");
  const [perTx, setPerTx] = useState("100");
  const [autoApprove, setAutoApprove] = useState("50");
  return (
    <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
      <h3 className="font-semibold text-sm">Global Limits</h3>
      {!showEdit ? (
        <>
          <div className="space-y-2">
            <div className="flex justify-between text-xs"><span className="text-muted">Daily cap (all agents)</span><span className="font-medium">${dailyCap}</span></div>
            <div className="flex justify-between text-xs"><span className="text-muted">Per-tx max</span><span className="font-medium">${perTx}</span></div>
            <div className="flex justify-between text-xs"><span className="text-muted">Auto-approve under</span><span className="font-medium text-accent">${autoApprove}</span></div>
          </div>
          <button onClick={() => setShowEdit(true)}
            className="w-full text-xs text-muted hover:text-foreground border border-border rounded-lg py-2 transition-colors">
            Edit Limits
          </button>
        </>
      ) : (
        <div className="space-y-2 animate-fade-in">
          <div><label className="text-[10px] text-muted">Daily Cap (USDC)</label>
            <input type="number" value={dailyCap} onChange={e => setDailyCap(e.target.value)}
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-accent" /></div>
          <div><label className="text-[10px] text-muted">Per-Tx Max (USDC)</label>
            <input type="number" value={perTx} onChange={e => setPerTx(e.target.value)}
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-accent" /></div>
          <div><label className="text-[10px] text-muted">Auto-Approve Under (USDC)</label>
            <input type="number" value={autoApprove} onChange={e => setAutoApprove(e.target.value)}
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-1.5 text-sm text-foreground focus:outline-none focus:border-accent" /></div>
          <button onClick={() => { setShowEdit(false); onToast(`Limits updated: $${dailyCap}/day, $${perTx}/tx, auto-approve <$${autoApprove}`); }}
            className="w-full bg-accent text-black font-semibold py-2 rounded-lg text-sm hover:bg-accent-dim transition-colors">
            Save Limits
          </button>
        </div>
      )}
    </div>
  );
}

function QuickPayCard({ agents, onPay }: { agents: any[]; onPay: (wallet: string, amount: number, memo: string) => void }) {
  const [sel, setSel] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  return (
    <div className="bg-surface border border-border rounded-xl p-4 space-y-3">
      <h3 className="font-semibold text-sm">Quick Pay</h3>
      <select value={sel} onChange={e => setSel(e.target.value)}
        className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent appearance-none">
        <option value="">Select agent</option>
        {agents.map(m => {
          const addr = m.account.wallet.toBase58();
          return <option key={addr} value={addr}>{m.account.role} ({addr.slice(0, 4)}...)</option>;
        })}
      </select>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">$</span>
        <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00"
          className="w-full bg-surface-2 border border-border rounded-lg pl-7 pr-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:border-accent" />
      </div>
      <input type="text" value={memo} onChange={e => setMemo(e.target.value)} placeholder="Memo (e.g. API batch #47)"
        className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:border-accent" />
      <button onClick={() => { if (sel && amount) { onPay(sel, parseFloat(amount), memo || "Direct payment"); setAmount(""); setMemo(""); setSel(""); } }}
        disabled={!sel || !amount}
        className="w-full bg-accent text-black font-semibold py-2 rounded-lg text-sm hover:bg-accent-dim transition-colors disabled:opacity-50">
        Send Payment
      </button>
    </div>
  );
}

function LiveFeedCard({ receipts }: { receipts: any[] }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <h3 className="font-semibold text-sm mb-2">Live Feed</h3>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {receipts.slice(0, 5).map((r, i) => (
          <div key={i} className="flex items-center justify-between text-xs py-1">
            <span className="text-muted truncate max-w-[160px]">{r.account.memo}</span>
            <span className="text-accent font-medium">{formatUsdc(Number(r.account.amount))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CodeBlock({ title, code }: { title: string; code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <span className="text-xs font-medium">{title}</span>
        <button onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="text-[10px] text-muted hover:text-accent transition-colors">{copied ? "Copied!" : "Copy"}</button>
      </div>
      <pre className="p-4 text-xs font-mono overflow-x-auto leading-relaxed" style={{ color: "#a6e3a1", backgroundColor: "#111" }}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

function AddCustomConnector({ onAdd, onCancel }: { onAdd: (c: AgentVaultConnector) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("🔌");
  const [connType, setConnType] = useState<"ai-framework" | "payment-rail" | "monitoring" | "custom">("custom");
  const [fields, setFields] = useState<ConnectorConfigField[]>([]);
  const [fKey, setFKey] = useState(""); const [fLabel, setFLabel] = useState(""); const [fType, setFType] = useState<"text"|"number"|"boolean"|"select">("text");
  const [showCode, setShowCode] = useState(false);
  const [maxAmount, setMaxAmount] = useState("100");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const connId = name ? `custom-${name.toLowerCase().replace(/\s+/g, "-")}` : "custom-my-connector";

  function generateCode(): string {
    const lines: string[] = [];
    lines.push(`import { CustomConnector } from "@agentvault/sdk";`);
    lines.push(``);
    lines.push(`const ${connId.replace(/[^a-zA-Z0-9]/g, "_")} = new CustomConnector(`);
    lines.push(`  "${connId}",`);
    lines.push(`  "${name || "My Connector"}",`);
    lines.push(`  {`);
    lines.push(`    // Budget enforcement — return { allow: false } to block`);
    lines.push(`    beforePay: async (agent, amount, memo) => {`);
    if (maxAmount) {
      lines.push(`      const usdc = amount / 1_000_000;`);
      lines.push(`      if (usdc > ${maxAmount}) {`);
      lines.push(`        return { allow: false, reason: "Max $${maxAmount} per transaction" };`);
      lines.push(`      }`);
    }
    lines.push(`      return { allow: true };`);
    lines.push(`    },`);
    if (webhookUrl) {
      lines.push(`    // Notify on every payment`);
      lines.push(`    afterPay: async (receipt) => {`);
      lines.push(`      await fetch("${webhookUrl}", {`);
      lines.push(`        method: "POST",`);
      lines.push(`        headers: { "Content-Type": "application/json" },`);
      lines.push(`        body: JSON.stringify({`);
      lines.push(`          agent: receipt.recipient.toBase58(),`);
      lines.push(`          amount: receipt.amount / 1_000_000,`);
      lines.push(`          memo: receipt.memo,`);
      lines.push(`          tx: receipt.txSignature,`);
      lines.push(`        }),`);
      lines.push(`      });`);
      lines.push(`    },`);
    } else {
      lines.push(`    // Called after every successful payment`);
      lines.push(`    afterPay: async (receipt) => {`);
      lines.push(`      console.log("Payment:", receipt.memo, receipt.txSignature);`);
      lines.push(`    },`);
    }
    lines.push(`  }`);
    lines.push(`);`);
    lines.push(``);
    lines.push(`// Attach to vault — hooks run on every vault.pay()`);
    lines.push(`vault.connectors.use(${connId.replace(/[^a-zA-Z0-9]/g, "_")});`);
    return lines.join("\n");
  }

  return (
    <div className="bg-surface border-2 border-accent/30 rounded-xl p-5 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-sm">Create Custom Connector</h4>
        <button onClick={onCancel} className="text-xs text-muted hover:text-foreground">Cancel</button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label className="text-xs text-muted block mb-1">Name *</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. My Trading Bot"
            className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:border-accent" /></div>
        <div><label className="text-xs text-muted block mb-1">Type</label>
          <select value={connType} onChange={e => setConnType(e.target.value as any)}
            className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-accent">
            <option value="ai-framework">AI Framework</option><option value="payment-rail">Payment Rail</option>
            <option value="monitoring">Monitoring</option><option value="custom">Custom</option>
          </select></div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="sm:col-span-3"><label className="text-xs text-muted block mb-1">Description</label>
          <input type="text" value={description} onChange={e => setDescription(e.target.value)} placeholder="What does this connector do?"
            className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:border-accent" /></div>
        <div><label className="text-xs text-muted block mb-1">Icon</label>
          <input type="text" value={icon} onChange={e => setIcon(e.target.value)}
            className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground text-center focus:outline-none focus:border-accent" /></div>
      </div>

      {/* Budget & Webhook Config */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div><label className="text-xs text-muted block mb-1">Max Amount per Tx (USDC)</label>
          <input type="number" value={maxAmount} onChange={e => setMaxAmount(e.target.value)} placeholder="100"
            className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:border-accent" /></div>
        <div><label className="text-xs text-muted block mb-1">Webhook URL (optional)</label>
          <input type="text" value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} placeholder="https://your-server.com/hook"
            className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted/50 focus:outline-none focus:border-accent" /></div>
      </div>

      {/* Config Fields */}
      <div>
        <label className="text-xs text-muted block mb-2">Extra Config Fields</label>
        {fields.length > 0 && <div className="space-y-1 mb-3">{fields.map((f, i) => (
          <div key={i} className="flex items-center justify-between bg-surface-2 rounded-lg px-3 py-1.5 text-xs">
            <span><span className="font-mono text-accent">{f.key}</span><span className="text-muted ml-2">({f.type})</span> — {f.label}</span>
            <button onClick={() => setFields(fields.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-300">x</button>
          </div>
        ))}</div>}
        <div className="flex gap-2">
          <input type="text" value={fKey} onChange={e => setFKey(e.target.value)} placeholder="key"
            className="flex-1 bg-surface-2 border border-border rounded-lg px-3 py-1.5 text-xs font-mono text-foreground placeholder:text-muted/50 focus:outline-none focus:border-accent" />
          <input type="text" value={fLabel} onChange={e => setFLabel(e.target.value)} placeholder="Label"
            className="flex-1 bg-surface-2 border border-border rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-muted/50 focus:outline-none focus:border-accent" />
          <select value={fType} onChange={e => setFType(e.target.value as any)}
            className="bg-surface-2 border border-border rounded-lg px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-accent">
            <option value="text">text</option><option value="number">number</option><option value="boolean">bool</option><option value="select">select</option>
          </select>
          <button onClick={() => { if (fKey && fLabel) { setFields([...fields, { key: fKey, label: fLabel, type: fType }]); setFKey(""); setFLabel(""); } }}
            disabled={!fKey || !fLabel}
            className="bg-surface-2 border border-accent/30 text-accent px-3 py-1.5 rounded-lg text-xs hover:bg-accent/10 transition-colors disabled:opacity-50">Add</button>
        </div>
      </div>

      {/* Generated Code Preview */}
      {name && (
        <div>
          <button onClick={() => setShowCode(!showCode)}
            className="text-xs text-accent hover:text-accent-dim transition-colors flex items-center gap-1">
            {showCode ? "▼" : "▶"} {showCode ? "Hide" : "Show"} generated SDK code
          </button>
          {showCode && (
            <div className="mt-2 relative">
              <pre className="text-xs font-mono p-4 rounded-lg overflow-x-auto" style={{ color: "#a6e3a1", backgroundColor: "#111" }}>
                {generateCode()}
              </pre>
              <button
                onClick={() => { navigator.clipboard.writeText(generateCode()); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                className="absolute top-2 right-2 text-xs text-muted hover:text-foreground bg-surface-2 px-2 py-1 rounded transition-colors"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={() => { if (!name) return; onAdd({ id: connId, name, description: description || `Custom ${connType} connector`, icon, type: connType, enabled: true, configFields: fields, config: {}, status: "connected", stats: { totalCalls: 0, totalSpent: 0, lastUsed: null } }); }}
          disabled={!name}
          className="flex-1 bg-accent text-black font-semibold py-2.5 rounded-lg text-sm hover:bg-accent-dim transition-colors disabled:opacity-50">
          Create Connector
        </button>
      </div>
      <p className="text-[10px] text-muted text-center">Creates the connector in your dashboard. Use the generated code to integrate it in your agent&apos;s codebase.</p>
    </div>
  );
}

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function randomTx(): string {
  const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("") + "...";
}
