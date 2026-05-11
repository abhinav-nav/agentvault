// @ts-nocheck
"use client";

import { Program, AnchorProvider, Idl, BN } from "@coral-xyz/anchor";
import { Connection, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { PROGRAM_ID, USDC_MINT, findTeamPda, findVaultPda, findMemberPda, findMilestonePda, findReceiptPda } from "./program";
import { SOLANA_RPC } from "./constants";
import IDL_JSON from "./creatorpay.json";

const IDL = IDL_JSON as Idl;

// Wallet adapter interface for Privy
interface WalletAdapter {
  publicKey: PublicKey;
  signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T>;
  signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]>;
}

export function getProvider(wallet: WalletAdapter): AnchorProvider {
  const connection = new Connection(SOLANA_RPC, "confirmed");
  return new AnchorProvider(connection, wallet as any, {
    preflightCommitment: "confirmed",
  });
}

export function getProgram(wallet: WalletAdapter): Program<any> {
  const provider = getProvider(wallet);
  return new Program(IDL, provider) as any;
}

export function getReadOnlyProgram(): Program<any> {
  const connection = new Connection(SOLANA_RPC, "confirmed");
  // Read-only provider with dummy wallet
  const provider = new AnchorProvider(connection, {
    publicKey: PublicKey.default,
    signTransaction: async (tx: any) => tx,
    signAllTransactions: async (txs: any) => txs,
  } as any, { preflightCommitment: "confirmed" });
  return new Program(IDL, provider) as any;
}

// ---- Instruction builders ----

export async function createTeam(
  wallet: WalletAdapter,
  name: string,
) {
  const program = getProgram(wallet);
  const [teamPda] = findTeamPda(wallet.publicKey);
  const [vaultPda] = findVaultPda(teamPda);

  return program.methods
    .createTeam(name)
    .accounts({
      creator: wallet.publicKey,
      team: teamPda,
      vault: vaultPda,
      mint: USDC_MINT,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: PublicKey.default,
    } as any)
    .rpc();
}

export async function addMember(
  wallet: WalletAdapter,
  memberWallet: PublicKey,
  role: string,
  ratePerDelivery: number,
) {
  const program = getProgram(wallet);
  const [teamPda] = findTeamPda(wallet.publicKey);
  const [memberPda] = findMemberPda(teamPda, memberWallet);

  return program.methods
    .addMember(memberWallet, role, new BN(ratePerDelivery))
    .accounts({
      creator: wallet.publicKey,
      team: teamPda,
      member: memberPda,
      systemProgram: PublicKey.default,
    } as any)
    .rpc();
}

export async function fundVault(
  wallet: WalletAdapter,
  amount: number,
) {
  const program = getProgram(wallet);
  const [teamPda] = findTeamPda(wallet.publicKey);
  const [vaultPda] = findVaultPda(teamPda);
  const creatorAta = getAssociatedTokenAddressSync(USDC_MINT, wallet.publicKey);

  return program.methods
    .fundVault(new BN(amount))
    .accounts({
      creator: wallet.publicKey,
      team: teamPda,
      vault: vaultPda,
      creatorTokenAccount: creatorAta,
      tokenProgram: TOKEN_PROGRAM_ID,
    } as any)
    .rpc();
}

export async function createMilestone(
  wallet: WalletAdapter,
  memberWallet: PublicKey,
  description: string,
  amount: number,
  deadline: number,
) {
  const program = getProgram(wallet);
  const [teamPda] = findTeamPda(wallet.publicKey);
  const [memberPda] = findMemberPda(teamPda, memberWallet);

  // Fetch member to get payment count
  const memberAccount = await program.account.member.fetch(memberPda);
  const paymentCount = (memberAccount as any).deliveriesCompleted;
  const [milestonePda] = findMilestonePda(teamPda, memberPda, paymentCount);

  return program.methods
    .createMilestone(description, new BN(amount), new BN(deadline))
    .accounts({
      creator: wallet.publicKey,
      team: teamPda,
      member: memberPda,
      milestone: milestonePda,
      systemProgram: PublicKey.default,
    } as any)
    .rpc();
}

export async function submitDeliverable(
  wallet: WalletAdapter,
  teamCreator: PublicKey,
  milestonePda: PublicKey,
  proofUri: string,
) {
  const program = getProgram(wallet);
  const [teamPda] = findTeamPda(teamCreator);
  const [memberPda] = findMemberPda(teamPda, wallet.publicKey);

  return program.methods
    .submitDeliverable(proofUri)
    .accounts({
      contributor: wallet.publicKey,
      team: teamPda,
      member: memberPda,
      milestone: milestonePda,
    } as any)
    .rpc();
}

export async function approveAndPay(
  wallet: WalletAdapter,
  memberWallet: PublicKey,
  milestonePda: PublicKey,
) {
  const program = getProgram(wallet);
  const [teamPda] = findTeamPda(wallet.publicKey);
  const [vaultPda] = findVaultPda(teamPda);
  const [memberPda] = findMemberPda(teamPda, memberWallet);
  const recipientAta = getAssociatedTokenAddressSync(USDC_MINT, memberWallet);

  const teamAccount = await program.account.team.fetch(teamPda);
  const paymentCount = (teamAccount as any).paymentCount;
  const [receiptPda] = findReceiptPda(teamPda, paymentCount);

  return program.methods
    .approveAndPay()
    .accounts({
      creator: wallet.publicKey,
      team: teamPda,
      vault: vaultPda,
      member: memberPda,
      milestone: milestonePda,
      contributorTokenAccount: recipientAta,
      receipt: receiptPda,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: PublicKey.default,
    } as any)
    .rpc();
}

export async function directPay(
  wallet: WalletAdapter,
  memberWallet: PublicKey,
  amount: number,
  memo: string,
) {
  const program = getProgram(wallet);
  const [teamPda] = findTeamPda(wallet.publicKey);
  const [vaultPda] = findVaultPda(teamPda);
  const [memberPda] = findMemberPda(teamPda, memberWallet);
  const recipientAta = getAssociatedTokenAddressSync(USDC_MINT, memberWallet);

  const teamAccount = await program.account.team.fetch(teamPda);
  const paymentCount = (teamAccount as any).paymentCount;
  const [receiptPda] = findReceiptPda(teamPda, paymentCount);

  return program.methods
    .directPay(new BN(amount), memo)
    .accounts({
      creator: wallet.publicKey,
      team: teamPda,
      vault: vaultPda,
      member: memberPda,
      contributorTokenAccount: recipientAta,
      receipt: receiptPda,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: PublicKey.default,
    } as any)
    .rpc();
}

export async function deactivateMember(
  wallet: WalletAdapter,
  memberWallet: PublicKey,
) {
  const program = getProgram(wallet);
  const [teamPda] = findTeamPda(wallet.publicKey);
  const [memberPda] = findMemberPda(teamPda, memberWallet);

  return program.methods
    .deactivateMember()
    .accounts({
      creator: wallet.publicKey,
      team: teamPda,
      member: memberPda,
    } as any)
    .rpc();
}

// ---- Account fetchers ----

export async function fetchTeam(creator: PublicKey) {
  const program = getReadOnlyProgram();
  const [teamPda] = findTeamPda(creator);
  try {
    return await program.account.team.fetch(teamPda);
  } catch {
    return null;
  }
}

export async function fetchMember(team: PublicKey, wallet: PublicKey) {
  const program = getReadOnlyProgram();
  const [memberPda] = findMemberPda(team, wallet);
  try {
    return await program.account.member.fetch(memberPda);
  } catch {
    return null;
  }
}

export async function fetchAllMembers(teamPda: PublicKey) {
  const program = getReadOnlyProgram();
  const allMembers = await program.account.member.all([
    { memcmp: { offset: 8, bytes: teamPda.toBase58() } },
  ]);
  return allMembers;
}

export async function fetchAllReceipts(teamPda: PublicKey) {
  const program = getReadOnlyProgram();
  const allReceipts = await program.account.paymentRecord.all([
    { memcmp: { offset: 8, bytes: teamPda.toBase58() } },
  ]);
  return allReceipts;
}

export async function fetchVaultBalance(teamPda: PublicKey): Promise<number> {
  const connection = new Connection(SOLANA_RPC, "confirmed");
  const [vaultPda] = findVaultPda(teamPda);
  try {
    const balance = await connection.getTokenAccountBalance(vaultPda);
    return Number(balance.value.amount);
  } catch {
    return 0;
  }
}
