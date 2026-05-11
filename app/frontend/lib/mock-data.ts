import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

const USDC = 1_000_000; // 6 decimals

// Fake but valid-looking pubkeys
const CREATOR = new PublicKey("9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM");
const TEAM_PDA = new PublicKey("5kFHzn6V3fGzQzXjHTUqXKvyMb5sRb3fk2tZPBfRY8dE");
const VAULT_PDA = new PublicKey("3Ysmnwi9tBUfKbYxkHTHFCUbGMnQi6WDGPZBV7Z4K6rW");

const AGENT_1 = new PublicKey("7nYBm2PH8FnK1U3wFTGPstfJsKALjm8MaL2EqP9RGsNz");
const AGENT_2 = new PublicKey("4rL2RCz8B1JQvGTvEt2trMvKEhJFMxBbfVRctxjzSt3E");
const AGENT_3 = new PublicKey("6pG8n1Rk9yfYJSbKj1LEamPqvQQHVpNt5ByqEFreZ1mC");
const AGENT_4 = new PublicKey("2hJ6K3tVYXqGvDpX3b5DtxHfWLq7pT7vKiNcgMN9VyRB");

export const MOCK_TEAM = {
  authority: CREATOR,
  name: "Acme AI Swarm",
  mint: new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"),
  vault: VAULT_PDA,
  memberCount: 4,
  totalDisbursed: new BN(16_220 * USDC),
  paymentCount: 47,
  bump: 255,
  vaultBump: 254,
};

export const MOCK_VAULT_BALANCE = 83_780 * USDC; // $83,780

export const MOCK_MEMBERS = [
  {
    publicKey: new PublicKey("8JkR1NL3Fw5vYG5ZqPvHpQqz5GNP1dFLqk3AevBrUWzK"),
    account: {
      team: TEAM_PDA,
      wallet: AGENT_1,
      role: "Research Agent",
      ratePerDelivery: new BN(25 * USDC),
      totalEarned: new BN(8_125 * USDC),
      deliveriesCompleted: 325,
      isActive: true,
      bump: 253,
    },
  },
  {
    publicKey: new PublicKey("CuieVDEDtLo7FypA9SbLM9saXFdb1dsshEkyErMqkRQq"),
    account: {
      team: TEAM_PDA,
      wallet: AGENT_2,
      role: "Code Gen Agent",
      ratePerDelivery: new BN(50 * USDC),
      totalEarned: new BN(5_200 * USDC),
      deliveriesCompleted: 104,
      isActive: true,
      bump: 252,
    },
  },
  {
    publicKey: new PublicKey("BjKtVgqRKjMrDrPsBr3FLre5MhMb4wnAJR4JXm3vfzxM"),
    account: {
      team: TEAM_PDA,
      wallet: AGENT_3,
      role: "Data Pipeline Agent",
      ratePerDelivery: new BN(10 * USDC),
      totalEarned: new BN(2_340 * USDC),
      deliveriesCompleted: 234,
      isActive: true,
      bump: 251,
    },
  },
  {
    publicKey: new PublicKey("HN7cABqLq46Es1jh92dQQisAi5YqmmJBcEqnqPWMBDAE"),
    account: {
      team: TEAM_PDA,
      wallet: AGENT_4,
      role: "Trading Bot",
      ratePerDelivery: new BN(5 * USDC),
      totalEarned: new BN(555 * USDC),
      deliveriesCompleted: 111,
      isActive: false,
      bump: 250,
    },
  },
];

const now = Math.floor(Date.now() / 1000);
const MIN = 60;
const HOUR = 3600;

export const MOCK_RECEIPTS = [
  {
    publicKey: new PublicKey("9a1bYfT6vKj2Pg7ePLvNzfWmX5EWbqhCkR9UuGvK1nLr"),
    account: {
      team: TEAM_PDA,
      member: MOCK_MEMBERS[0].publicKey,
      milestone: PublicKey.default,
      recipient: AGENT_1,
      amount: new BN(25 * USDC),
      timestamp: new BN(now - 2 * MIN),
      memo: "GPT-4o API — 12K tokens research query",
      bump: 249,
    },
  },
  {
    publicKey: new PublicKey("4kR7UxbVfE1sP3mN8jWqLt9ZhYcDgX2Fa6nKvBw5HdTe"),
    account: {
      team: TEAM_PDA,
      member: MOCK_MEMBERS[2].publicKey,
      milestone: PublicKey.default,
      recipient: AGENT_3,
      amount: new BN(10 * USDC),
      timestamp: new BN(now - 8 * MIN),
      memo: "Snowflake query — user analytics pipeline",
      bump: 248,
    },
  },
  {
    publicKey: new PublicKey("6vN8KxmWfG3tR5pL2jYaHe7DqZbCn4Fs9wUiXkE1BcVr"),
    account: {
      team: TEAM_PDA,
      member: MOCK_MEMBERS[1].publicKey,
      milestone: new PublicKey("3Ysmnwi9tBUfKbYxkHTHFCUbGMnQi6WDGPZBV7Z4K6rW"),
      recipient: AGENT_2,
      amount: new BN(50 * USDC),
      timestamp: new BN(now - 25 * MIN),
      memo: "Milestone: auth service refactor complete",
      bump: 247,
    },
  },
  {
    publicKey: new PublicKey("2hJ6K3tVYXqGvDpX3b5DtxHfWLq7pT7vKiNcgMN9VyRD"),
    account: {
      team: TEAM_PDA,
      member: MOCK_MEMBERS[0].publicKey,
      milestone: PublicKey.default,
      recipient: AGENT_1,
      amount: new BN(25 * USDC),
      timestamp: new BN(now - 1 * HOUR),
      memo: "Claude API — competitor analysis report",
      bump: 246,
    },
  },
  {
    publicKey: new PublicKey("7nYBm2PH8FnK1U3wFTGPstfJsKALjm8MaL2EqP9RGsNa"),
    account: {
      team: TEAM_PDA,
      member: MOCK_MEMBERS[2].publicKey,
      milestone: PublicKey.default,
      recipient: AGENT_3,
      amount: new BN(10 * USDC),
      timestamp: new BN(now - 2 * HOUR),
      memo: "BigQuery — ETL job batch #892",
      bump: 245,
    },
  },
  {
    publicKey: new PublicKey("4rL2RCz8B1JQvGTvEt2trMvKEhJFMxBbfVRctxjzSt3F"),
    account: {
      team: TEAM_PDA,
      member: MOCK_MEMBERS[1].publicKey,
      milestone: PublicKey.default,
      recipient: AGENT_2,
      amount: new BN(50 * USDC),
      timestamp: new BN(now - 3 * HOUR),
      memo: "GitHub Copilot — PR #234 code generation",
      bump: 244,
    },
  },
  {
    publicKey: new PublicKey("6pG8n1Rk9yfYJSbKj1LEamPqvQQHVpNt5ByqEFreZ1mD"),
    account: {
      team: TEAM_PDA,
      member: MOCK_MEMBERS[3].publicKey,
      milestone: PublicKey.default,
      recipient: AGENT_4,
      amount: new BN(5 * USDC),
      timestamp: new BN(now - 5 * HOUR),
      memo: "Jupiter swap — SOL/USDC rebalance",
      bump: 243,
    },
  },
  {
    publicKey: new PublicKey("CuieVDEDtLo7FypA9SbLM9saXFdb1dsshEkyErMqkRQr"),
    account: {
      team: TEAM_PDA,
      member: MOCK_MEMBERS[0].publicKey,
      milestone: new PublicKey("5kFHzn6V3fGzQzXjHTUqXKvyMb5sRb3fk2tZPBfRY8dE"),
      recipient: AGENT_1,
      amount: new BN(75 * USDC),
      timestamp: new BN(now - 8 * HOUR),
      memo: "Milestone: weekly market report delivered",
      bump: 242,
    },
  },
];
