// Vault Rush — Solana Blitz v10 (MagicBlock)
// Entertainment Finance: open a collectible pack (MagicBlock VRF rarity),
// then play a 60 second skill trading run on an Ephemeral Rollup.
// Devnet only. No mainnet. No token mint, no USDC movement in this program:
// the $1,000 USDC prize pool is paid out off program by the operator;
// this program records packs, rarity, scores and profit honestly onchain.
//
// Security notes (see PROGRAM.md):
// - Scoped VRF identity only (#[vrf] / #[vrf_callback]), never the legacy
//   global identity 9irBy75QS2BN81FUgXuHcjqceJJRuc9oDkAe8TKVvvAw.
// - One pending VRF request at a time; callback binds to request_seed and
//   clears pending, so a duplicate / late callback cannot double count.
// - client_seed is caller entropy only; rarity comes from oracle randomness
//   (randomness[0] % 101), not from the seed, so seed grinding cannot pick
//   a rarity directly. Each request also costs the VRF fee on base.
// - All score / profit updates are owner only, checked arithmetic, bounded.

use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::{
    anchor::{commit, delegate, ephemeral, vrf, vrf_callback},
    cpi::DelegateConfig,
    ephem::MagicIntentBundleBuilder,
    vrf::{
        self,
        consts::program_identity_pubkey,
        instructions::{
            create_request_high_priority_scoped_randomness_ix_const,
            RequestRandomnessParams,
        },
        types::SerializableAccountMeta,
    },
};

declare_id!("GDCTM7AVo58kywzpf5RWVgQNAygo3W7ttm1a4pKGhEH8");

/// Scoped VRF requester identity for this program (SDK 0.18 `_const` API).
const PROGRAM_IDENTITY: Pubkey = program_identity_pubkey(&crate::ID);

pub const MAX_SCORE: u64 = 100_000;
pub const MAX_PROFIT_ABS: i64 = 1_000_000;
/// 60 second run, in seconds, enforced by the client / operator.
/// Onchain we record the run, not wall clock; see PROGRAM.md limits.
pub const RUN_SECONDS: u64 = 60;

pub const RARITY_COMMON: u8 = 0;
pub const RARITY_RARE: u8 = 1;
pub const RARITY_EPIC: u8 = 2;
pub const RARITY_LEGENDARY: u8 = 3;

pub const RUN_CREATED: u8 = 0;
pub const RUN_ACTIVE: u8 = 1;
pub const RUN_SUBMITTED: u8 = 2;
pub const RUN_SETTLED: u8 = 3;

/// Rarity from oracle randomness.
/// Uses the first two bytes as a u16, reduced mod 101, so the spec ranges
/// 0-59 / 60-84 / 85-96 / 97-100 map exactly, with probabilities
/// ~60% / ~25% / ~12% / ~4%. Two bytes cut the mod bias to under 0.1%.
pub fn rarity_from_randomness(randomness: &[u8; 32]) -> u8 {
    let v = u16::from_le_bytes([randomness[0], randomness[1]]) % 101;
    if v <= 59 {
        RARITY_COMMON
    } else if v <= 84 {
        RARITY_RARE
    } else if v <= 96 {
        RARITY_EPIC
    } else {
        RARITY_LEGENDARY
    }
}

pub fn rarity_from_byte(byte: u8) -> u8 {
    let mut buf = [0u8; 32];
    buf[0] = byte;
    buf[1] = byte;
    rarity_from_randomness(&buf)
}

#[ephemeral]
#[program]
pub mod vault_rush {
    use super::*;

    pub fn init_player(ctx: Context<InitPlayer>) -> Result<()> {
        let player = &mut ctx.accounts.player;
        player.owner = ctx.accounts.payer.key();
        player.packs_opened = 0;
        player.best_score = 0;
        player.total_profit = 0;
        player.last_rarity = RARITY_COMMON;
        player.pending_request = false;
        player.request_seed = 0;
        player.last_randomness = [0u8; 32];
        player.bump = ctx.bumps.player;
        Ok(())
    }

    /// Request VRF randomness for one pack. Base layer: pass DEFAULT_QUEUE.
    /// Inside the Ephemeral Rollup: pass DEFAULT_EPHEMERAL_QUEUE.
    /// One pending request at a time; the caller pays the VRF fee on base
    /// (500_000 lamports regular; the delegated ephemeral queue is fee exempt).
    pub fn open_pack(ctx: Context<OpenPack>, client_seed: u8) -> Result<()> {
        let payer_key = ctx.accounts.payer.key();
        let player_key = ctx.accounts.player.key();
        let oracle_queue_key = ctx.accounts.oracle_queue.key();
        let player = &mut ctx.accounts.player;
        require!(!player.pending_request, VaultRushError::AlreadyPending);
        require_keys_eq!(player.owner, payer_key, VaultRushError::Unauthorized);

        let params = RequestRandomnessParams {
            payer: payer_key,
            oracle_queue: oracle_queue_key,
            callback_program_id: ID,
            callback_discriminator: instruction::CallbackRollPack::DISCRIMINATOR.to_vec(),
            caller_seed: [client_seed; 32],
            accounts_metas: Some(vec![SerializableAccountMeta {
                pubkey: player_key,
                is_signer: false,
                is_writable: true,
            }]),
            callback_args: Some(vec![client_seed]),
            ..Default::default()
        };
        // High priority request, fee 800000 lamports. Regular priority
        // requests were accepted on devnet twice with no callback landing,
        // so this version tries the high priority queue path.
        let ix =
            create_request_high_priority_scoped_randomness_ix_const(params, PROGRAM_IDENTITY);

        // Mark pending BEFORE invoking, so a re-entrant / duplicate path
        // cannot open a second request for the same player in this call.
        player.pending_request = true;
        player.request_seed = client_seed;

        ctx.accounts
            .invoke_signed_vrf(&ctx.accounts.payer.to_account_info(), &ix)?;
        Ok(())
    }

    /// VRF callback. Authenticated by #[vrf_callback] (scoped identity).
    /// Idempotent in the economic sense: if there is no pending request, or
    /// the seed does not match the pending request, it errors and changes
    /// nothing, so a duplicate or late callback cannot double count a pack.
    pub fn callback_roll_pack(
        ctx: Context<CallbackRollPack>,
        randomness: [u8; 32],
        client_seed: u8,
    ) -> Result<()> {
        let player = &mut ctx.accounts.player;
        require!(player.pending_request, VaultRushError::NoPendingRequest);
        require_eq!(
            player.request_seed,
            client_seed,
            VaultRushError::SeedMismatch
        );
        let rarity = rarity_from_randomness(&randomness);
        player.last_rarity = rarity;
        player.last_randomness = randomness;
        player.packs_opened = player
            .packs_opened
            .checked_add(1)
            .ok_or(VaultRushError::ArithmeticOverflow)?;
        player.pending_request = false;
        player.request_seed = 0;
        Ok(())
    }

    /// Owner only cancel for a stuck VRF request. If a request is purged
    /// after about 121 seconds, pending stays true with no callback coming.
    /// Cancel clears pending and seed, so the player can open again.
    /// A late callback after cancel errors with NoPendingRequest, so it
    /// cannot double count. Cancelling before fulfilment loses the VRF fee.
    pub fn cancel_pack(ctx: Context<CancelPack>) -> Result<()> {
        let player = &mut ctx.accounts.player;
        require!(player.pending_request, VaultRushError::NoPendingRequest);
        player.pending_request = false;
        player.request_seed = 0;
        Ok(())
    }

    pub fn start_run(ctx: Context<StartRun>, run_id: u64) -> Result<()> {
        let run = &mut ctx.accounts.run;
        run.player = ctx.accounts.player.key();
        run.run_id = run_id;
        run.score = 0;
        run.profit = 0;
        run.status = RUN_ACTIVE;
        run.bump = ctx.bumps.run;
        Ok(())
    }

    /// Submit a finished run. Runs on the Ephemeral Rollup while the Run
    /// account is delegated. Only the delegated Run account is written
    /// here: the Player account is not delegated, so writing it on the
    /// rollup fails with Account is immutable. Player totals are settled
    /// on base by settle_run after undelegation. Owner only, bounded.
    pub fn submit_score(ctx: Context<SubmitScore>, score: u64, profit: i64) -> Result<()> {
        require!(score <= MAX_SCORE, VaultRushError::ScoreTooHigh);
        require!(
            profit >= -MAX_PROFIT_ABS && profit <= MAX_PROFIT_ABS,
            VaultRushError::ProfitOutOfBounds
        );
        let run = &mut ctx.accounts.run;
        require_eq!(run.status, RUN_ACTIVE, VaultRushError::InvalidRunStatus);
        require_keys_eq!(
            run.player,
            ctx.accounts.player.key(),
            VaultRushError::Unauthorized
        );
        require_keys_eq!(
            ctx.accounts.player.owner,
            ctx.accounts.owner.key(),
            VaultRushError::Unauthorized
        );

        run.score = score;
        run.profit = profit;
        run.status = RUN_SUBMITTED;
        Ok(())
    }

    /// Settle a submitted run on base, after undelegation. Updates the
    /// Player best score and total profit once, then marks the run Settled
    /// so a second settle cannot double count.
    pub fn settle_run(ctx: Context<SettleRun>) -> Result<()> {
        let run = &mut ctx.accounts.run;
        require_eq!(run.status, RUN_SUBMITTED, VaultRushError::InvalidRunStatus);
        let score = run.score;
        let profit = run.profit;
        run.status = RUN_SETTLED;
        let player = &mut ctx.accounts.player;
        if score > player.best_score {
            player.best_score = score;
        }
        player.total_profit = player
            .total_profit
            .checked_add(profit)
            .ok_or(VaultRushError::ArithmeticOverflow)?;
        Ok(())
    }

    /// Delegate the Run account to the Ephemeral Rollup (base layer).
    pub fn delegate_run(ctx: Context<DelegateRun>, run_id: u64) -> Result<()> {
        let run_id_bytes = run_id.to_le_bytes();
        let player_key = ctx.accounts.player.key();
        ctx.accounts.delegate_run(
            &ctx.accounts.payer,
            &[b"run", player_key.as_ref(), run_id_bytes.as_ref()],
            DelegateConfig::default(),
        )?;
        Ok(())
    }

    /// Commit the delegated Run account back to base, staying delegated.
    /// At most 10 plain commits per delegation on the live validators;
    /// Vault Rush commits once per run, then undelegates.
    pub fn commit_run(ctx: Context<CommitRun>) -> Result<()> {
        MagicIntentBundleBuilder::new(
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit(&[ctx.accounts.run.to_account_info()])
        .build_and_invoke()?;
        Ok(())
    }

    /// Commit and undelegate the Run account (Ephemeral Rollup).
    pub fn undelegate_run(ctx: Context<UndelegateRun>) -> Result<()> {
        MagicIntentBundleBuilder::new(
            ctx.accounts.payer.to_account_info(),
            ctx.accounts.magic_context.to_account_info(),
            ctx.accounts.magic_program.to_account_info(),
        )
        .commit_and_undelegate(&[ctx.accounts.run.to_account_info()])
        .build_and_invoke()?;
        Ok(())
    }
}

#[account]
pub struct PlayerState {
    pub owner: Pubkey,
    pub packs_opened: u32,
    pub best_score: u64,
    pub total_profit: i64,
    pub last_rarity: u8,
    pub pending_request: bool,
    pub request_seed: u8,
    pub last_randomness: [u8; 32],
    pub bump: u8,
}

impl PlayerState {
    pub const SPACE: usize = 8 + 32 + 4 + 8 + 8 + 1 + 1 + 1 + 32 + 1;
}

#[account]
pub struct RunState {
    pub player: Pubkey,
    pub run_id: u64,
    pub score: u64,
    pub profit: i64,
    pub status: u8,
    pub bump: u8,
}

impl RunState {
    pub const SPACE: usize = 8 + 32 + 8 + 8 + 8 + 1 + 1;
}

#[derive(Accounts)]
pub struct InitPlayer<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        init,
        payer = payer,
        space = PlayerState::SPACE,
        seeds = [b"player", payer.key().as_ref()],
        bump
    )]
    pub player: Account<'info, PlayerState>,
    pub system_program: Program<'info, System>,
}

#[vrf]
#[derive(Accounts)]
pub struct OpenPack<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        mut,
        seeds = [b"player", payer.key().as_ref()],
        bump = player.bump,
        constraint = player.owner == payer.key()
    )]
    pub player: Account<'info, PlayerState>,
    /// CHECK: validated against the known VRF queues below.
    #[account(
        mut,
        constraint =
            oracle_queue.key() == vrf::consts::DEFAULT_QUEUE ||
            oracle_queue.key() == vrf::consts::DEFAULT_EPHEMERAL_QUEUE ||
            oracle_queue.key() == vrf::consts::DEFAULT_TEST_QUEUE ||
            oracle_queue.key() == vrf::consts::DEFAULT_EPHEMERAL_TEST_QUEUE
    )]
    pub oracle_queue: UncheckedAccount<'info>,
}

#[vrf_callback]
#[derive(Accounts)]
pub struct CallbackRollPack<'info> {
    #[account(mut)]
    pub player: Account<'info, PlayerState>,
}

#[derive(Accounts)]
pub struct CancelPack<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [b"player", owner.key().as_ref()],
        bump = player.bump,
        has_one = owner
    )]
    pub player: Account<'info, PlayerState>,
}

#[derive(Accounts)]
#[instruction(run_id: u64)]
pub struct StartRun<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [b"player", owner.key().as_ref()],
        bump = player.bump,
        has_one = owner
    )]
    pub player: Account<'info, PlayerState>,
    #[account(
        init,
        payer = owner,
        space = RunState::SPACE,
        seeds = [b"run", player.key().as_ref(), run_id.to_le_bytes().as_ref()],
        bump
    )]
    pub run: Account<'info, RunState>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(score: u64, profit: i64)]
pub struct SubmitScore<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    // Read only on the rollup: Player is not delegated, so it must not
    // be marked writable here, or the ER rejects the tx as immutable.
    #[account(
        seeds = [b"player", owner.key().as_ref()],
        bump = player.bump,
        has_one = owner
    )]
    pub player: Account<'info, PlayerState>,
    #[account(
        mut,
        seeds = [b"run", player.key().as_ref(), run.run_id.to_le_bytes().as_ref()],
        bump = run.bump,
        has_one = player
    )]
    pub run: Account<'info, RunState>,
}

#[derive(Accounts)]
pub struct SettleRun<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(
        mut,
        seeds = [b"player", owner.key().as_ref()],
        bump = player.bump,
        has_one = owner
    )]
    pub player: Account<'info, PlayerState>,
    #[account(
        mut,
        seeds = [b"run", player.key().as_ref(), run.run_id.to_le_bytes().as_ref()],
        bump = run.bump,
        has_one = player
    )]
    pub run: Account<'info, RunState>,
}

#[delegate]
#[derive(Accounts)]
#[instruction(run_id: u64)]
pub struct DelegateRun<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        seeds = [b"player", payer.key().as_ref()],
        bump = player.bump,
        constraint = player.owner == payer.key()
    )]
    pub player: Account<'info, PlayerState>,
    /// CHECK: delegated account; `del` requires AccountInfo / UncheckedAccount.
    #[account(
        mut,
        del,
        seeds = [b"run", player.key().as_ref(), run_id.to_le_bytes().as_ref()],
        bump
    )]
    pub run: AccountInfo<'info>,
}

#[commit]
#[derive(Accounts)]
pub struct CommitRun<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        seeds = [b"player", payer.key().as_ref()],
        bump = player.bump,
        constraint = player.owner == payer.key()
    )]
    pub player: Account<'info, PlayerState>,
    #[account(
        mut,
        seeds = [b"run", player.key().as_ref(), run.run_id.to_le_bytes().as_ref()],
        bump = run.bump,
        has_one = player
    )]
    pub run: Account<'info, RunState>,
}

#[commit]
#[derive(Accounts)]
pub struct UndelegateRun<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        seeds = [b"player", payer.key().as_ref()],
        bump = player.bump,
        constraint = player.owner == payer.key()
    )]
    pub player: Account<'info, PlayerState>,
    #[account(
        mut,
        seeds = [b"run", player.key().as_ref(), run.run_id.to_le_bytes().as_ref()],
        bump = run.bump,
        has_one = player
    )]
    pub run: Account<'info, RunState>,
}

#[error_code]
pub enum VaultRushError {
    #[msg("A VRF pack request is already pending")]
    AlreadyPending,
    #[msg("No VRF pack request is pending")]
    NoPendingRequest,
    #[msg("VRF callback seed does not match the pending request")]
    SeedMismatch,
    #[msg("Caller is not the player owner")]
    Unauthorized,
    #[msg("Score exceeds the maximum for a 60 second run")]
    ScoreTooHigh,
    #[msg("Profit is outside the allowed bounds")]
    ProfitOutOfBounds,
    #[msg("Run is not active")]
    InvalidRunStatus,
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rarity_mapping_covers_spec_ranges() {
        // 0-59 Common, 60-84 Rare, 85-96 Epic, 97-100 Legendary, via u16 % 101.
        let make = |v: u16| {
            let mut r = [0u8; 32];
            r[0] = (v & 0xff) as u8;
            r[1] = (v >> 8) as u8;
            r
        };
        assert_eq!(rarity_from_randomness(&make(0)), RARITY_COMMON);
        assert_eq!(rarity_from_randomness(&make(59)), RARITY_COMMON);
        assert_eq!(rarity_from_randomness(&make(60)), RARITY_RARE);
        assert_eq!(rarity_from_randomness(&make(84)), RARITY_RARE);
        assert_eq!(rarity_from_randomness(&make(85)), RARITY_EPIC);
        assert_eq!(rarity_from_randomness(&make(96)), RARITY_EPIC);
        assert_eq!(rarity_from_randomness(&make(97)), RARITY_LEGENDARY);
        assert_eq!(rarity_from_randomness(&make(100)), RARITY_LEGENDARY);
        assert_eq!(rarity_from_randomness(&make(101)), RARITY_COMMON);
        assert_eq!(rarity_from_randomness(&make(201)), RARITY_LEGENDARY);
    }

    #[test]
    fn score_and_profit_bounds() {
        assert!(MAX_SCORE == 100_000);
        assert!((-MAX_PROFIT_ABS..=MAX_PROFIT_ABS).contains(&0));
        assert!(!(-MAX_PROFIT_ABS..=MAX_PROFIT_ABS).contains(&(MAX_PROFIT_ABS + 1)));
        // Checked total_profit accumulation.
        let total: i64 = 900_000;
        assert!(total.checked_add(200_000).is_some());
        assert!(i64::MAX.checked_add(1).is_none());
    }

    #[test]
    fn account_sizes_fit_commit_limit() {
        // Delegated accounts over 10,240 bytes cannot commit; ours are tiny.
        assert!(PlayerState::SPACE < 10_240);
        assert!(RunState::SPACE < 10_240);
        assert_eq!(PlayerState::SPACE, 96);
        assert_eq!(RunState::SPACE, 66);
    }
}
