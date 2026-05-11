"use client";

import { ReactNode, createContext, useContext, useMemo, useState, useCallback, useEffect } from "react";
import { Connection, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { SOLANA_RPC } from "@/lib/constants";

// Minimal wallet interface for Anchor
export interface SolanaWallet {
  publicKey: PublicKey;
  signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T>;
  signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]>;
  connected: boolean;
}

interface WalletContextValue {
  wallet: SolanaWallet | null;
  connecting: boolean;
  connectError: string;
  connect: () => Promise<void>;
  disconnect: () => void;
  connection: Connection;
}

const WalletContext = createContext<WalletContextValue>({
  wallet: null,
  connecting: false,
  connectError: "",
  connect: async () => {},
  disconnect: () => {},
  connection: new Connection(SOLANA_RPC),
});

export const useWallet = () => useContext(WalletContext);

// Use Phantom / Solflare browser wallet
export function WalletProvider({ children }: { children: ReactNode }) {
  const [wallet, setWallet] = useState<SolanaWallet | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState("");

  const connection = useMemo(() => new Connection(SOLANA_RPC, "confirmed"), []);

  const connect = useCallback(async () => {
    setConnecting(true);
    setConnectError("");
    try {
      const phantom = (window as any).phantom?.solana || (window as any).solana;
      if (!phantom) {
        throw new Error("Phantom wallet not found. Please install the Phantom browser extension and refresh this page.");
      }
      const resp = await phantom.connect();
      const pubkey = new PublicKey(resp.publicKey.toString());
      setWallet({
        publicKey: pubkey,
        connected: true,
        signTransaction: async (tx: any) => phantom.signTransaction(tx),
        signAllTransactions: async (txs: any) => phantom.signAllTransactions(txs),
      });
    } catch (err: any) {
      console.error("Wallet connect error:", err);
      setConnectError(err.message || "Failed to connect wallet");
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    const phantom = (window as any).phantom?.solana || (window as any).solana;
    phantom?.disconnect();
    setWallet(null);
  }, []);

  // Auto-reconnect if already approved
  useEffect(() => {
    const phantom = (window as any).phantom?.solana || (window as any).solana;
    if (phantom?.isConnected) {
      connect();
    }
  }, [connect]);

  return (
    <WalletContext.Provider value={{ wallet, connecting, connectError, connect, disconnect, connection }}>
      {children}
    </WalletContext.Provider>
  );
}
