import { PublicKey } from "@solana/web3.js";
export declare const DEFAULT_PROGRAM_ID: PublicKey;
export declare const USDC_DEVNET: PublicKey;
export declare const USDC_DECIMALS = 6;
export declare function findTeamPda(creator: PublicKey, programId?: PublicKey): [PublicKey, number];
export declare function findVaultPda(team: PublicKey, programId?: PublicKey): [PublicKey, number];
export declare function findMemberPda(team: PublicKey, wallet: PublicKey, programId?: PublicKey): [PublicKey, number];
export declare function findMilestonePda(team: PublicKey, member: PublicKey, paymentCount: number, programId?: PublicKey): [PublicKey, number];
export declare function findReceiptPda(team: PublicKey, paymentCount: number, programId?: PublicKey): [PublicKey, number];
export declare function formatUsdc(rawAmount: number): string;
//# sourceMappingURL=pda.d.ts.map