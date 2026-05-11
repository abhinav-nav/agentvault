import { PublicKey } from "@solana/web3.js";

export const DEFAULT_PROGRAM_ID = new PublicKey(
  "8g5hMx6AwTUFCrKwuaCfDY468qE4bbHiw8BvdiepUJdo"
);

export const USDC_DEVNET = new PublicKey(
  "2PoHEJR4wmF9zbeiUDobjo786F7ny3Vv6ivBX7FPJHZj"
);

export const USDC_DECIMALS = 6;

export function findTeamPda(
  creator: PublicKey,
  programId: PublicKey = DEFAULT_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("team"), creator.toBuffer()],
    programId
  );
}

export function findVaultPda(
  team: PublicKey,
  programId: PublicKey = DEFAULT_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), team.toBuffer()],
    programId
  );
}

export function findMemberPda(
  team: PublicKey,
  wallet: PublicKey,
  programId: PublicKey = DEFAULT_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("member"), team.toBuffer(), wallet.toBuffer()],
    programId
  );
}

export function findMilestonePda(
  team: PublicKey,
  member: PublicKey,
  paymentCount: number,
  programId: PublicKey = DEFAULT_PROGRAM_ID
): [PublicKey, number] {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(paymentCount));
  return PublicKey.findProgramAddressSync(
    [Buffer.from("milestone"), team.toBuffer(), member.toBuffer(), buf],
    programId
  );
}

export function findReceiptPda(
  team: PublicKey,
  paymentCount: number,
  programId: PublicKey = DEFAULT_PROGRAM_ID
): [PublicKey, number] {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(paymentCount));
  return PublicKey.findProgramAddressSync(
    [Buffer.from("receipt"), team.toBuffer(), buf],
    programId
  );
}

export function formatUsdc(rawAmount: number): string {
  return `$${(rawAmount / 10 ** USDC_DECIMALS).toFixed(2)}`;
}
