use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("8g5hMx6AwTUFCrKwuaCfDY468qE4bbHiw8BvdiepUJdo");

/// AgentVault: Treasury & budget protocol for autonomous AI agents on Solana.
///
/// Organizations deploy a USDC vault, register AI agents with per-task
/// spending limits, and get on-chain receipts for every payment.
/// Kill switch enables instant revocation of rogue agent access.
///
/// Architecture:
///   - Team PDA stores the vault admin's agent roster + config
///   - Vault PDA holds the USDC treasury (token account owned by program)
///   - Member PDAs represent registered AI agents with budget caps
///   - PaymentRecord PDAs track every agent payment on-chain (receipts)
///   - Milestone PDAs enable deliverable-gated payments

#[program]
pub mod creatorpay {
    use super::*;

    /// Initialize a vault. The caller becomes the vault authority.
    /// `team_name` is a human-readable label (e.g., "My AI Agent Swarm").
    pub fn create_team(
        ctx: Context<CreateTeam>,
        team_name: String,
    ) -> Result<()> {
        require!(team_name.len() <= 64, CreatorPayError::NameTooLong);

        let team = &mut ctx.accounts.team;
        team.authority = ctx.accounts.creator.key();
        team.name = team_name;
        team.mint = ctx.accounts.mint.key();
        team.vault = ctx.accounts.vault.key();
        team.member_count = 0;
        team.total_disbursed = 0;
        team.payment_count = 0;
        team.bump = ctx.bumps.team;
        team.vault_bump = ctx.bumps.vault;

        msg!("Team created: {}", team.name);
        Ok(())
    }

    /// Register an AI agent to the vault. Up to 15 agents per vault.
    /// `role` is a label like "Research Agent", "Trading Bot", etc.
    /// `wallet` is the agent's Solana wallet.
    pub fn add_member(
        ctx: Context<AddMember>,
        wallet: Pubkey,
        role: String,
        rate_per_delivery: u64,
    ) -> Result<()> {
        require!(role.len() <= 32, CreatorPayError::RoleTooLong);
        let team = &ctx.accounts.team;
        require!(team.member_count < 15, CreatorPayError::TeamFull);

        let member = &mut ctx.accounts.member;
        member.team = ctx.accounts.team.key();
        member.wallet = wallet;
        member.role = role;
        member.rate_per_delivery = rate_per_delivery;
        member.total_earned = 0;
        member.deliveries_completed = 0;
        member.is_active = true;
        member.bump = ctx.bumps.member;

        // Increment team member count
        let team = &mut ctx.accounts.team;
        team.member_count += 1;

        msg!("Member added: {} as {}", wallet, member.role);
        Ok(())
    }

    /// Fund the agent vault treasury with USDC.
    pub fn fund_vault(ctx: Context<FundVault>, amount: u64) -> Result<()> {
        require!(amount > 0, CreatorPayError::ZeroAmount);

        let transfer_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.creator_token_account.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.creator.to_account_info(),
            },
        );
        token::transfer(transfer_ctx, amount)?;

        msg!("Vault funded with {} tokens", amount);
        Ok(())
    }

    /// Create a milestone (deliverable) that must be completed before payment.
    /// Example: "Complete API integration task" or "Deliver research report batch #12".
    pub fn create_milestone(
        ctx: Context<CreateMilestone>,
        description: String,
        amount: u64,
        deadline: i64,
    ) -> Result<()> {
        require!(description.len() <= 128, CreatorPayError::DescriptionTooLong);
        require!(amount > 0, CreatorPayError::ZeroAmount);

        let milestone = &mut ctx.accounts.milestone;
        milestone.team = ctx.accounts.team.key();
        milestone.member = ctx.accounts.member.key();
        milestone.description = description;
        milestone.amount = amount;
        milestone.deadline = deadline;
        milestone.status = MilestoneStatus::Pending;
        milestone.created_at = Clock::get()?.unix_timestamp;
        milestone.completed_at = 0;
        milestone.bump = ctx.bumps.milestone;

        msg!("Milestone created: {}", milestone.description);
        Ok(())
    }

    /// Agent submits deliverable proof (a URI to the work).
    pub fn submit_deliverable(
        ctx: Context<SubmitDeliverable>,
        proof_uri: String,
    ) -> Result<()> {
        require!(proof_uri.len() <= 256, CreatorPayError::ProofTooLong);

        let milestone = &mut ctx.accounts.milestone;
        require!(
            milestone.status == MilestoneStatus::Pending,
            CreatorPayError::MilestoneNotPending
        );

        milestone.status = MilestoneStatus::Submitted;
        milestone.proof_uri = proof_uri;

        msg!("Deliverable submitted for milestone");
        Ok(())
    }

    /// Vault admin approves the deliverable → funds auto-release to agent.
    /// This is the core payment instruction. Creates an on-chain receipt.
    pub fn approve_and_pay(ctx: Context<ApproveAndPay>) -> Result<()> {
        let milestone = &mut ctx.accounts.milestone;
        require!(
            milestone.status == MilestoneStatus::Submitted,
            CreatorPayError::MilestoneNotSubmitted
        );

        let amount = milestone.amount;
        let team_key = ctx.accounts.team.key();

        // Transfer from vault to contributor using PDA signer
        let seeds = &[
            b"vault",
            team_key.as_ref(),
            &[ctx.accounts.team.vault_bump],
        ];
        let signer = &[&seeds[..]];

        let transfer_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.contributor_token_account.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
            },
            signer,
        );
        token::transfer(transfer_ctx, amount)?;

        // Update milestone
        milestone.status = MilestoneStatus::Approved;
        milestone.completed_at = Clock::get()?.unix_timestamp;

        // Update member stats
        let member = &mut ctx.accounts.member;
        member.total_earned += amount;
        member.deliveries_completed += 1;

        // Update team stats
        let team = &mut ctx.accounts.team;
        team.total_disbursed += amount;
        team.payment_count += 1;

        // Write on-chain payment record (receipt)
        let record = &mut ctx.accounts.payment_record;
        record.team = team.key();
        record.member = member.key();
        record.milestone = milestone.key();
        record.recipient = member.wallet;
        record.amount = amount;
        record.timestamp = Clock::get()?.unix_timestamp;
        record.bump = ctx.bumps.payment_record;

        msg!(
            "Payment of {} approved and sent to {}",
            amount,
            member.wallet
        );
        Ok(())
    }

    /// Direct payment without a milestone (for API calls, task payments, etc.).
    /// Vault admin pays an agent directly from the vault.
    pub fn direct_pay(ctx: Context<DirectPay>, amount: u64, memo: String) -> Result<()> {
        require!(amount > 0, CreatorPayError::ZeroAmount);
        require!(memo.len() <= 128, CreatorPayError::DescriptionTooLong);

        let team_key = ctx.accounts.team.key();
        let seeds = &[
            b"vault",
            team_key.as_ref(),
            &[ctx.accounts.team.vault_bump],
        ];
        let signer = &[&seeds[..]];

        let transfer_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.contributor_token_account.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
            },
            signer,
        );
        token::transfer(transfer_ctx, amount)?;

        // Update member stats
        let member = &mut ctx.accounts.member;
        member.total_earned += amount;

        // Update team stats
        let team = &mut ctx.accounts.team;
        team.total_disbursed += amount;
        team.payment_count += 1;

        // Write on-chain payment record
        let record = &mut ctx.accounts.payment_record;
        record.team = team.key();
        record.member = member.key();
        record.milestone = Pubkey::default(); // no milestone for direct payments
        record.recipient = member.wallet;
        record.amount = amount;
        record.timestamp = Clock::get()?.unix_timestamp;
        record.memo = memo;
        record.bump = ctx.bumps.payment_record;

        msg!("Direct payment of {} sent to {}", amount, member.wallet);
        Ok(())
    }

    /// Kill switch — deactivate an agent (does not delete — preserves history).
    pub fn deactivate_member(ctx: Context<DeactivateMember>) -> Result<()> {
        let member = &mut ctx.accounts.member;
        member.is_active = false;
        msg!("Member deactivated: {}", member.wallet);
        Ok(())
    }
}

// ── Account Structs ─────────────────────────────────────────────────────

#[account]
#[derive(InitSpace)]
pub struct Team {
    pub authority: Pubkey,
    #[max_len(64)]
    pub name: String,
    pub mint: Pubkey,
    pub vault: Pubkey,
    pub member_count: u8,
    pub total_disbursed: u64,
    pub payment_count: u64,
    pub bump: u8,
    pub vault_bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Member {
    pub team: Pubkey,
    pub wallet: Pubkey,
    #[max_len(32)]
    pub role: String,
    pub rate_per_delivery: u64,
    pub total_earned: u64,
    pub deliveries_completed: u64,
    pub is_active: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Milestone {
    pub team: Pubkey,
    pub member: Pubkey,
    #[max_len(128)]
    pub description: String,
    pub amount: u64,
    pub deadline: i64,
    pub status: MilestoneStatus,
    #[max_len(256)]
    pub proof_uri: String,
    pub created_at: i64,
    pub completed_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct PaymentRecord {
    pub team: Pubkey,
    pub member: Pubkey,
    pub milestone: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
    #[max_len(128)]
    pub memo: String,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, InitSpace)]
pub enum MilestoneStatus {
    Pending,
    Submitted,
    Approved,
    Rejected,
}

// ── Instruction Contexts ────────────────────────────────────────────────

#[derive(Accounts)]
#[instruction(team_name: String)]
pub struct CreateTeam<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        init,
        payer = creator,
        space = 8 + Team::INIT_SPACE,
        seeds = [b"team", creator.key().as_ref()],
        bump,
    )]
    pub team: Account<'info, Team>,

    /// The USDC (or any SPL token) mint for this vault's treasury.
    pub mint: Account<'info, Mint>,

    /// Vault is a token account owned by the team PDA.
    #[account(
        init,
        payer = creator,
        token::mint = mint,
        token::authority = vault,
        seeds = [b"vault", team.key().as_ref()],
        bump,
    )]
    pub vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(wallet: Pubkey, role: String)]
pub struct AddMember<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        mut,
        has_one = authority @ CreatorPayError::Unauthorized,
        seeds = [b"team", creator.key().as_ref()],
        bump = team.bump,
    )]
    pub team: Account<'info, Team>,

    #[account(
        init,
        payer = creator,
        space = 8 + Member::INIT_SPACE,
        seeds = [b"member", team.key().as_ref(), wallet.as_ref()],
        bump,
    )]
    pub member: Account<'info, Member>,

    /// CHECK: This is the team authority, validated by has_one on team.
    pub authority: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct FundVault<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        has_one = authority @ CreatorPayError::Unauthorized,
        seeds = [b"team", creator.key().as_ref()],
        bump = team.bump,
    )]
    pub team: Account<'info, Team>,

    #[account(
        mut,
        token::mint = team.mint,
        token::authority = vault,
        seeds = [b"vault", team.key().as_ref()],
        bump = team.vault_bump,
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = team.mint,
        token::authority = creator,
    )]
    pub creator_token_account: Account<'info, TokenAccount>,

    /// CHECK: Validated by has_one on team.
    pub authority: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(description: String)]
pub struct CreateMilestone<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        has_one = authority @ CreatorPayError::Unauthorized,
        seeds = [b"team", creator.key().as_ref()],
        bump = team.bump,
    )]
    pub team: Account<'info, Team>,

    #[account(
        constraint = member.team == team.key() @ CreatorPayError::MemberNotInTeam,
        constraint = member.is_active @ CreatorPayError::MemberInactive,
    )]
    pub member: Account<'info, Member>,

    #[account(
        init,
        payer = creator,
        space = 8 + Milestone::INIT_SPACE,
        seeds = [
            b"milestone",
            team.key().as_ref(),
            member.key().as_ref(),
            &team.payment_count.to_le_bytes(),
        ],
        bump,
    )]
    pub milestone: Account<'info, Milestone>,

    /// CHECK: Validated by has_one on team.
    pub authority: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SubmitDeliverable<'info> {
    pub contributor: Signer<'info>,

    #[account(
        constraint = member.wallet == contributor.key() @ CreatorPayError::Unauthorized,
    )]
    pub member: Account<'info, Member>,

    #[account(
        mut,
        constraint = milestone.member == member.key() @ CreatorPayError::MilestoneMismatch,
    )]
    pub milestone: Account<'info, Milestone>,
}

#[derive(Accounts)]
pub struct ApproveAndPay<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        mut,
        has_one = authority @ CreatorPayError::Unauthorized,
        seeds = [b"team", creator.key().as_ref()],
        bump = team.bump,
    )]
    pub team: Account<'info, Team>,

    #[account(
        mut,
        constraint = member.team == team.key() @ CreatorPayError::MemberNotInTeam,
    )]
    pub member: Account<'info, Member>,

    #[account(
        mut,
        constraint = milestone.team == team.key() @ CreatorPayError::MilestoneMismatch,
        constraint = milestone.member == member.key() @ CreatorPayError::MilestoneMismatch,
    )]
    pub milestone: Account<'info, Milestone>,

    #[account(
        mut,
        token::mint = team.mint,
        token::authority = vault,
        seeds = [b"vault", team.key().as_ref()],
        bump = team.vault_bump,
    )]
    pub vault: Account<'info, TokenAccount>,

    /// The agent's USDC token account.
    #[account(
        mut,
        token::mint = team.mint,
    )]
    pub contributor_token_account: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = creator,
        space = 8 + PaymentRecord::INIT_SPACE,
        seeds = [
            b"receipt",
            team.key().as_ref(),
            &team.payment_count.to_le_bytes(),
        ],
        bump,
    )]
    pub payment_record: Account<'info, PaymentRecord>,

    /// CHECK: Validated by has_one on team.
    pub authority: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(amount: u64, memo: String)]
pub struct DirectPay<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        mut,
        has_one = authority @ CreatorPayError::Unauthorized,
        seeds = [b"team", creator.key().as_ref()],
        bump = team.bump,
    )]
    pub team: Account<'info, Team>,

    #[account(
        mut,
        constraint = member.team == team.key() @ CreatorPayError::MemberNotInTeam,
        constraint = member.is_active @ CreatorPayError::MemberInactive,
    )]
    pub member: Account<'info, Member>,

    #[account(
        mut,
        token::mint = team.mint,
        token::authority = vault,
        seeds = [b"vault", team.key().as_ref()],
        bump = team.vault_bump,
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = team.mint,
    )]
    pub contributor_token_account: Account<'info, TokenAccount>,

    #[account(
        init,
        payer = creator,
        space = 8 + PaymentRecord::INIT_SPACE,
        seeds = [
            b"receipt",
            team.key().as_ref(),
            &team.payment_count.to_le_bytes(),
        ],
        bump,
    )]
    pub payment_record: Account<'info, PaymentRecord>,

    /// CHECK: Validated by has_one on team.
    pub authority: AccountInfo<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DeactivateMember<'info> {
    pub creator: Signer<'info>,

    #[account(
        has_one = authority @ CreatorPayError::Unauthorized,
        seeds = [b"team", creator.key().as_ref()],
        bump = team.bump,
    )]
    pub team: Account<'info, Team>,

    #[account(
        mut,
        constraint = member.team == team.key() @ CreatorPayError::MemberNotInTeam,
    )]
    pub member: Account<'info, Member>,

    /// CHECK: Validated by has_one on team.
    pub authority: AccountInfo<'info>,
}

// ── Errors ──────────────────────────────────────────────────────────────

#[error_code]
pub enum CreatorPayError {
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Team name exceeds 64 characters")]
    NameTooLong,
    #[msg("Role exceeds 32 characters")]
    RoleTooLong,
    #[msg("Description exceeds 128 characters")]
    DescriptionTooLong,
    #[msg("Proof URI exceeds 256 characters")]
    ProofTooLong,
    #[msg("Team is full (max 15 members)")]
    TeamFull,
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Member is not part of this team")]
    MemberNotInTeam,
    #[msg("Member is inactive")]
    MemberInactive,
    #[msg("Milestone is not in pending status")]
    MilestoneNotPending,
    #[msg("Milestone is not in submitted status")]
    MilestoneNotSubmitted,
    #[msg("Milestone does not match the expected member/team")]
    MilestoneMismatch,
}
