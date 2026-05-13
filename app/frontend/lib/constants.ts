import { clusterApiUrl } from "@solana/web3.js";

export const SOLANA_RPC = process.env.NEXT_PUBLIC_SOLANA_RPC || clusterApiUrl("devnet");

export const TEAM_MAX_MEMBERS = 15;
export const MAX_NAME_LEN = 64;
export const MAX_ROLE_LEN = 32;
export const MAX_DESC_LEN = 128;
