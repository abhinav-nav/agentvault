"use client";

import { useWallet } from "./WalletProvider";

export default function ConnectButton() {
  const { wallet, connecting, connectError, connect, disconnect } = useWallet();

  if (wallet?.connected) {
    const addr = wallet.publicKey.toBase58();
    const short = addr.slice(0, 4) + "..." + addr.slice(-4);
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-surface-2 border border-border rounded-lg px-3 py-2">
          <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          <span className="text-sm font-mono text-foreground">{short}</span>
        </div>
        <button
          onClick={disconnect}
          className="text-sm text-muted hover:text-foreground transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={connect}
        disabled={connecting}
        className="bg-accent text-black font-semibold px-5 py-2.5 rounded-lg hover:bg-accent-dim transition-colors disabled:opacity-50 text-sm"
      >
        {connecting ? "Connecting..." : "Connect Wallet"}
      </button>
      {connectError && (
        <p className="text-red-400 text-xs max-w-[250px] text-right">{connectError}</p>
      )}
    </div>
  );
}
