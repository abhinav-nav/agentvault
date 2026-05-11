import { PublicKey } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey(
  "8g5hMx6AwTUFCrKwuaCfDY468qE4bbHiw8BvdiepUJdo"
);

// Devnet USDC (test mint for AgentVault demo)
export const USDC_MINT = new PublicKey(
  "2PoHEJR4wmF9zbeiUDobjo786F7ny3Vv6ivBX7FPJHZj"
);

export const USDC_DECIMALS = 6;

export function findTeamPda(creator: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("team"), creator.toBuffer()],
    PROGRAM_ID
  );
}

export function findVaultPda(team: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), team.toBuffer()],
    PROGRAM_ID
  );
}

export function findMemberPda(
  team: PublicKey,
  wallet: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("member"), team.toBuffer(), wallet.toBuffer()],
    PROGRAM_ID
  );
}

export function findMilestonePda(
  team: PublicKey,
  member: PublicKey,
  paymentCount: number
): [PublicKey, number] {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(paymentCount));
  return PublicKey.findProgramAddressSync(
    [Buffer.from("milestone"), team.toBuffer(), member.toBuffer(), buf],
    PROGRAM_ID
  );
}

export function findReceiptPda(
  team: PublicKey,
  paymentCount: number
): [PublicKey, number] {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(paymentCount));
  return PublicKey.findProgramAddressSync(
    [Buffer.from("receipt"), team.toBuffer(), buf],
    PROGRAM_ID
  );
}

export function formatUsdc(amount: number): string {
  return `$${(amount / 10 ** USDC_DECIMALS).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
